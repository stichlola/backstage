-- ============================================================
-- BACKSTAGE — MIGRAZIONE v2
-- Da eseguire nell'editor SQL di Supabase SOPRA il database
-- esistente. È sicura: non tocca i dati già inseriti e può
-- essere rieseguita più volte senza errori.
-- Aggiunge: setlist multiple, agenda eventi con disponibilità,
-- registrazioni/allegati (Storage), commenti, registro attività,
-- tag sui brani, link pubblico della scaletta.
-- ============================================================

-- ------------------------------------------------------------
-- 1. TAG SUI BRANI
-- ------------------------------------------------------------
alter table public.songs add column if not exists tags text[] not null default '{}';

-- ------------------------------------------------------------
-- 2. SETLIST MULTIPLE
-- ------------------------------------------------------------
create table if not exists public.setlists (
  id           uuid primary key default gen_random_uuid(),
  band_id      uuid not null references public.bands(id) on delete cascade,
  nome         text not null default 'Nuova scaletta',
  data         date,
  luogo        text not null default '',
  note         text not null default '',
  archived     boolean not null default false,
  public_token uuid not null default gen_random_uuid() unique,
  created_at   timestamptz not null default now()
);

create table if not exists public.setlist_songs (
  id         uuid primary key default gen_random_uuid(),
  setlist_id uuid not null references public.setlists(id) on delete cascade,
  song_id    uuid not null references public.songs(id) on delete cascade,
  ordine     int not null default 0,
  unique (setlist_id, song_id)
);

-- ------------------------------------------------------------
-- 3. AGENDA: EVENTI + DISPONIBILITÀ
-- ------------------------------------------------------------
create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  band_id    uuid not null references public.bands(id) on delete cascade,
  tipo       text not null default 'prova' check (tipo in ('prova','concerto','altro')),
  titolo     text not null default '',
  data       timestamptz not null,
  luogo      text not null default '',
  note       text not null default '',
  setlist_id uuid references public.setlists(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.event_availability (
  event_id  uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.band_members(id) on delete cascade,
  stato     text not null check (stato in ('si','no','forse')),
  primary key (event_id, member_id)
);

-- ------------------------------------------------------------
-- 4. FILE PER BRANO (registrazioni prove + spartiti/allegati)
-- ------------------------------------------------------------
create table if not exists public.song_files (
  id         uuid primary key default gen_random_uuid(),
  band_id    uuid not null references public.bands(id) on delete cascade,
  song_id    uuid not null references public.songs(id) on delete cascade,
  tipo       text not null check (tipo in ('audio','doc')),
  nome       text not null,
  path       text not null,
  mime       text not null default '',
  size       int,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. COMMENTI PER BRANO (con minutaggio opzionale)
-- ------------------------------------------------------------
create table if not exists public.song_comments (
  id            uuid primary key default gen_random_uuid(),
  band_id       uuid not null references public.bands(id) on delete cascade,
  song_id       uuid not null references public.songs(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete set null,
  autore        text not null default '',
  body          text not null,
  timestamp_sec int,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 6. REGISTRO ATTIVITÀ (alimenta il centro notifiche)
-- ------------------------------------------------------------
create table if not exists public.activity_log (
  id         uuid primary key default gen_random_uuid(),
  band_id    uuid not null references public.bands(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete set null,
  autore     text not null default '',
  azione     text not null,
  created_at timestamptz not null default now()
);
create index if not exists activity_band_idx on public.activity_log (band_id, created_at desc);

-- ------------------------------------------------------------
-- 7. ROW LEVEL SECURITY sulle nuove tabelle
-- ------------------------------------------------------------
alter table public.setlists           enable row level security;
alter table public.setlist_songs      enable row level security;
alter table public.events             enable row level security;
alter table public.event_availability enable row level security;
alter table public.song_files         enable row level security;
alter table public.song_comments      enable row level security;
alter table public.activity_log       enable row level security;

-- Accesso: membri (o owner) della band. drop+create per idempotenza.
drop policy if exists "setlists membri" on public.setlists;
create policy "setlists membri" on public.setlists for all to authenticated
  using (public.is_band_member(band_id) or public.is_band_owner(band_id))
  with check (public.is_band_member(band_id) or public.is_band_owner(band_id));

drop policy if exists "setlist_songs membri" on public.setlist_songs;
create policy "setlist_songs membri" on public.setlist_songs for all to authenticated
  using (exists (select 1 from public.setlists s where s.id = setlist_id
         and (public.is_band_member(s.band_id) or public.is_band_owner(s.band_id))))
  with check (exists (select 1 from public.setlists s where s.id = setlist_id
         and (public.is_band_member(s.band_id) or public.is_band_owner(s.band_id))));

drop policy if exists "events membri" on public.events;
create policy "events membri" on public.events for all to authenticated
  using (public.is_band_member(band_id) or public.is_band_owner(band_id))
  with check (public.is_band_member(band_id) or public.is_band_owner(band_id));

drop policy if exists "availability membri" on public.event_availability;
create policy "availability membri" on public.event_availability for all to authenticated
  using (exists (select 1 from public.events e where e.id = event_id
         and (public.is_band_member(e.band_id) or public.is_band_owner(e.band_id))))
  with check (exists (select 1 from public.events e where e.id = event_id
         and (public.is_band_member(e.band_id) or public.is_band_owner(e.band_id))));

drop policy if exists "song_files membri" on public.song_files;
create policy "song_files membri" on public.song_files for all to authenticated
  using (public.is_band_member(band_id) or public.is_band_owner(band_id))
  with check (public.is_band_member(band_id) or public.is_band_owner(band_id));

drop policy if exists "song_comments membri" on public.song_comments;
create policy "song_comments membri" on public.song_comments for all to authenticated
  using (public.is_band_member(band_id) or public.is_band_owner(band_id))
  with check (public.is_band_member(band_id) or public.is_band_owner(band_id));

drop policy if exists "activity membri" on public.activity_log;
create policy "activity membri" on public.activity_log for all to authenticated
  using (public.is_band_member(band_id) or public.is_band_owner(band_id))
  with check (public.is_band_member(band_id) or public.is_band_owner(band_id));

-- ------------------------------------------------------------
-- 8. STORAGE: bucket privato per registrazioni e spartiti
--    Percorso file: <band_id>/<song_id>/<nomefile>
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('band-files', 'band-files', false)
on conflict (id) do nothing;

drop policy if exists "band files select" on storage.objects;
create policy "band files select" on storage.objects for select to authenticated
  using (bucket_id = 'band-files'
    and (public.is_band_member((string_to_array(name,'/'))[1]::uuid)
      or public.is_band_owner((string_to_array(name,'/'))[1]::uuid)));

drop policy if exists "band files insert" on storage.objects;
create policy "band files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'band-files'
    and (public.is_band_member((string_to_array(name,'/'))[1]::uuid)
      or public.is_band_owner((string_to_array(name,'/'))[1]::uuid)));

drop policy if exists "band files delete" on storage.objects;
create policy "band files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'band-files'
    and (public.is_band_member((string_to_array(name,'/'))[1]::uuid)
      or public.is_band_owner((string_to_array(name,'/'))[1]::uuid)));

-- ------------------------------------------------------------
-- 9. LINK PUBBLICO DI SOLA LETTURA (per il fonico)
--    Funzione anonima: dato il token restituisce la scaletta
--    senza esporre nient'altro del database.
-- ------------------------------------------------------------
create or replace function public.get_public_setlist(_token uuid)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'band',   b.nome,
    'nome',   s.nome,
    'data',   s.data,
    'luogo',  s.luogo,
    'gapSec', b.gap_sec,
    'songs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'titolo', so.titolo, 'artista', so.artista,
        'tonalita', so.tonalita, 'transpose', so.transpose,
        'bpm', so.bpm, 'durata', so.durata, 'voce', so.voce,
        'ordine', ss.ordine
      ) order by ss.ordine)
      from setlist_songs ss join songs so on so.id = ss.song_id
      where ss.setlist_id = s.id
    ), '[]'::jsonb)
  ) into result
  from setlists s join bands b on b.id = s.band_id
  where s.public_token = _token;
  return result; -- null se il token non esiste
end $$;

grant execute on function public.get_public_setlist(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 10. MIGRAZIONE DATI: crea la "Scaletta principale" per ogni
--     band e ci sposta i brani che erano già in scaletta.
-- ------------------------------------------------------------
insert into public.setlists (band_id, nome)
select b.id, 'Scaletta principale'
from public.bands b
where not exists (select 1 from public.setlists s where s.band_id = b.id);

insert into public.setlist_songs (setlist_id, song_id, ordine)
select s.id, so.id, so.ordine
from public.setlists s
join public.songs so on so.band_id = s.band_id and so.in_setlist = true
where s.nome = 'Scaletta principale'
  and not exists (select 1 from public.setlist_songs ss
                  where ss.setlist_id = s.id and ss.song_id = so.id);

-- ------------------------------------------------------------
-- 11. REALTIME sulle nuove tabelle (ignora se già aggiunte)
-- ------------------------------------------------------------
do $$ begin alter publication supabase_realtime add table public.setlists;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.setlist_songs;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.events;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.event_availability;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.song_comments;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.activity_log;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.song_files;
exception when duplicate_object then null; end $$;
