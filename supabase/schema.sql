-- ============================================================
-- BACKSTAGE — Schema Supabase completo
-- Da incollare nell'editor SQL di Supabase (in un colpo solo).
-- Include: tabelle, trigger, Row Level Security, inviti, realtime.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILI UTENTE
--    Estende auth.users (gestita da Supabase Auth) con i dati
--    dell'app: nome, colore avatar e impostazioni personali
--    (tema e modalità giorno/notte, che nella v5 sono per-utente).
-- ------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text not null,
  color      text not null default '#E8734A',
  theme      text not null default 'neon',
  mode       text not null default 'dark' check (mode in ('dark','light')),
  created_at timestamptz not null default now()
);

-- Alla registrazione (email o Google) crea automaticamente il profilo.
-- Con Google, full_name arriva già compilato dai metadati OAuth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 2. BAND (i "backstage")
-- ------------------------------------------------------------
create table public.bands (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  gap_sec    int  not null default 30,
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. MEMBRI DELLA BAND (roster con ruoli)
--    user_id è NULL per i membri senza account (solo nome nel
--    roster); diventa valorizzato quando la persona accetta
--    l'invito o viene collegata.
-- ------------------------------------------------------------
create table public.band_members (
  id      uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  nome    text not null,
  ruolo   text not null default 'Musicista',
  unique (band_id, nome)
);
create unique index band_members_band_user
  on public.band_members (band_id, user_id) where user_id is not null;

-- ------------------------------------------------------------
-- 4. BRANI — mappa 1:1 il modello della v5
-- ------------------------------------------------------------
create table public.songs (
  id          uuid primary key default gen_random_uuid(),
  band_id     uuid not null references public.bands(id) on delete cascade,
  titolo      text not null,
  artista     text not null default '',
  album       text not null default '',
  anno        int,
  api_id      text,                       -- es. 'itunes:1234567' / 'mb:uuid'
  tonalita    text not null default '',
  transpose   int  not null default 0,
  bpm         int,
  durata      int,                        -- secondi
  voce        text not null default '',   -- nome del membro (roster)
  stato       text not null default 'da_imparare'
              check (stato in ('da_imparare','in_prova','quasi_pronta','pronta')),
  priorita    boolean not null default false,
  note        text not null default '',
  sheet       text not null default '',   -- testo + accordi
  in_setlist  boolean not null default false,
  ordine      int not null default 0,
  preview_url text,
  artwork_url text,
  youtube_url text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index songs_band_idx on public.songs (band_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger songs_touch before update on public.songs
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- 5. "CHI LA SA SUONARE" (molti-a-molti brano <-> membro)
-- ------------------------------------------------------------
create table public.song_knowledge (
  song_id   uuid not null references public.songs(id) on delete cascade,
  member_id uuid not null references public.band_members(id) on delete cascade,
  primary key (song_id, member_id)
);

-- ------------------------------------------------------------
-- 6. INVITI (per dare accesso a un account tramite email,
--    anche se la persona non si è ancora registrata)
-- ------------------------------------------------------------
create table public.band_invites (
  id         uuid primary key default gen_random_uuid(),
  band_id    uuid not null references public.bands(id) on delete cascade,
  email      text not null,
  ruolo      text not null default 'Musicista',
  invited_by uuid references public.profiles(id),
  status     text not null default 'pending'
             check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique (band_id, email)
);

-- ------------------------------------------------------------
-- 7. FUNZIONI DI SUPPORTO per la RLS
--    security definer: evitano ricorsione tra policy.
-- ------------------------------------------------------------
create or replace function public.is_band_member(_band uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from band_members
    where band_id = _band and user_id = auth.uid()
  );
$$;

create or replace function public.is_band_owner(_band uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from bands where id = _band and owner_id = auth.uid()
  );
$$;

-- ------------------------------------------------------------
-- 8. ROW LEVEL SECURITY
--    Regola d'oro: vedi/modifichi solo ciò che riguarda le band
--    di cui fai parte. Il proprietario amministra roster e inviti.
-- ------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.bands          enable row level security;
alter table public.band_members   enable row level security;
alter table public.songs          enable row level security;
alter table public.song_knowledge enable row level security;
alter table public.band_invites   enable row level security;

-- PROFILES: leggibili agli utenti autenticati (servono nome/colore
-- dei compagni di band); ognuno modifica solo il proprio.
create policy "profiles: lettura autenticati"
  on public.profiles for select to authenticated using (true);
create policy "profiles: modifica propria"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- BANDS
create policy "bands: lettura ai membri"
  on public.bands for select to authenticated
  using (owner_id = auth.uid() or public.is_band_member(id));
create policy "bands: creazione"
  on public.bands for insert to authenticated
  with check (owner_id = auth.uid());
create policy "bands: modifica del proprietario"
  on public.bands for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "bands: eliminazione del proprietario"
  on public.bands for delete to authenticated
  using (owner_id = auth.uid());

-- BAND_MEMBERS: i membri vedono il roster; solo il proprietario
-- lo amministra; chiunque può rimuovere sé stesso (uscire).
create policy "members: lettura ai membri"
  on public.band_members for select to authenticated
  using (public.is_band_member(band_id) or public.is_band_owner(band_id));
create policy "members: gestione del proprietario"
  on public.band_members for insert to authenticated
  with check (public.is_band_owner(band_id));
create policy "members: modifica del proprietario"
  on public.band_members for update to authenticated
  using (public.is_band_owner(band_id));
create policy "members: rimozione (owner o sé stessi)"
  on public.band_members for delete to authenticated
  using (public.is_band_owner(band_id) or user_id = auth.uid());

-- SONGS: tutti i membri della band leggono e scrivono.
create policy "songs: lettura ai membri"
  on public.songs for select to authenticated
  using (public.is_band_member(band_id) or public.is_band_owner(band_id));
create policy "songs: scrittura ai membri"
  on public.songs for insert to authenticated
  with check (public.is_band_member(band_id) or public.is_band_owner(band_id));
create policy "songs: modifica ai membri"
  on public.songs for update to authenticated
  using (public.is_band_member(band_id) or public.is_band_owner(band_id));
create policy "songs: eliminazione ai membri"
  on public.songs for delete to authenticated
  using (public.is_band_member(band_id) or public.is_band_owner(band_id));

-- SONG_KNOWLEDGE: segue l'appartenenza alla band del brano.
create policy "knowledge: accesso ai membri"
  on public.song_knowledge for all to authenticated
  using (exists (
    select 1 from public.songs s
    where s.id = song_id
      and (public.is_band_member(s.band_id) or public.is_band_owner(s.band_id))
  ))
  with check (exists (
    select 1 from public.songs s
    where s.id = song_id
      and (public.is_band_member(s.band_id) or public.is_band_owner(s.band_id))
  ));

-- INVITES: il proprietario li crea e li vede; l'invitato vede i
-- propri (match sull'email del JWT) e può rispondere via RPC.
create policy "invites: lettura owner o invitato"
  on public.band_invites for select to authenticated
  using (
    public.is_band_owner(band_id)
    or lower(email) = lower(coalesce(auth.jwt()->>'email',''))
  );
create policy "invites: creazione del proprietario"
  on public.band_invites for insert to authenticated
  with check (public.is_band_owner(band_id));
create policy "invites: revoca del proprietario"
  on public.band_invites for delete to authenticated
  using (public.is_band_owner(band_id));

-- ------------------------------------------------------------
-- 9. RPC: creazione band + accettazione inviti
--    (operazioni multi-tabella, meglio atomiche e lato server)
-- ------------------------------------------------------------

-- Crea la band e aggiunge il creatore al roster in un colpo solo.
create or replace function public.create_band(_nome text, _ruolo text default 'Musicista')
returns uuid language plpgsql security definer set search_path = public as $$
declare _band uuid; _nome_utente text;
begin
  select nome into _nome_utente from profiles where id = auth.uid();
  insert into bands (nome, owner_id) values (_nome, auth.uid()) returning id into _band;
  insert into band_members (band_id, user_id, nome, ruolo)
  values (_band, auth.uid(), coalesce(_nome_utente, 'Io'), _ruolo);
  return _band;
end $$;

-- L'invitato accetta: diventa membro (o viene collegato a un
-- membro omonimo già nel roster) e l'invito passa ad 'accepted'.
create or replace function public.accept_invite(_invite uuid)
returns void language plpgsql security definer set search_path = public as $$
declare inv record; _nome_utente text;
begin
  select * into inv from band_invites
  where id = _invite and status = 'pending'
    and lower(email) = lower(coalesce(auth.jwt()->>'email',''));
  if not found then
    raise exception 'Invito non trovato o non destinato a questo account';
  end if;

  select nome into _nome_utente from profiles where id = auth.uid();

  -- se nel roster esiste già un membro con lo stesso nome, collegalo
  update band_members set user_id = auth.uid()
  where band_id = inv.band_id and user_id is null and nome = _nome_utente;

  if not found then
    insert into band_members (band_id, user_id, nome, ruolo)
    values (inv.band_id, auth.uid(), coalesce(_nome_utente,'Nuovo membro'), inv.ruolo)
    on conflict (band_id, nome) do nothing;
  end if;

  update band_invites set status = 'accepted' where id = _invite;
end $$;

-- ------------------------------------------------------------
-- 10. REALTIME: sincronizzazione tra i membri
--     Abilita la pubblicazione dei cambiamenti; il client si
--     iscrive filtrando per band_id.
-- ------------------------------------------------------------
alter publication supabase_realtime add table public.songs;
alter publication supabase_realtime add table public.band_members;
alter publication supabase_realtime add table public.bands;
alter publication supabase_realtime add table public.song_knowledge;
