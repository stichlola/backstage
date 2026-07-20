# 🎸 BACKSTAGE — Gestione repertorio band

App web per gestire il repertorio delle tue band: brani con stati (Da imparare → Pronta),
scaletta con modalità palco, testo e accordi con transpose automatico, metronomo,
ricerca brani su cataloghi mondiali, multi-band con ruoli e sincronizzazione in tempo reale.

Stack: **React + Vite** (frontend) e **Supabase** (autenticazione, database Postgres, realtime).

---

## 1. Prerequisiti

- **Node.js 18+** installato (verifica con `node -v`)
- Un account gratuito su **https://supabase.com**

## 2. Crea il progetto Supabase

1. Vai su https://supabase.com → **New project** (il piano Free basta).
2. Scegli nome e password del database, attendi la creazione (~1 minuto).
3. Apri **SQL Editor** → **New query**, incolla TUTTO il contenuto di
   `supabase/schema.sql` e premi **Run**. Deve terminare senza errori:
   crea tabelle, sicurezza (RLS), trigger, inviti e realtime.

## 3. Configura le chiavi nell'app

1. In Supabase: **Project Settings → API**. Copia **Project URL** e **anon public key**.
2. Nella cartella del progetto: copia `.env.example` in `.env` e incolla i due valori:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

## 4. Avvia in locale

```bash
npm install
npm run dev
```

Apri http://localhost:5173 — registrati con email e password e crea il primo backstage.

> Nota: di default Supabase richiede la **conferma dell'email** alla registrazione.
> Per lo sviluppo puoi disattivarla in **Authentication → Providers → Email →
> "Confirm email" OFF**, così l'accesso è immediato.

## 5. Login con Google (OAuth reale)

1. Vai su https://console.cloud.google.com → crea un progetto.
2. **API e servizi → Schermata consenso OAuth**: tipo *Esterno*, compila nome app ed email.
3. **API e servizi → Credenziali → Crea credenziali → ID client OAuth 2.0**:
   - Tipo: **Applicazione web**
   - *Origini JavaScript autorizzate*: `http://localhost:5173` (e in seguito il dominio di produzione)
   - *URI di reindirizzamento autorizzati*: `https://TUO-PROGETTO.supabase.co/auth/v1/callback`
4. Copia **Client ID** e **Client secret**.
5. In Supabase: **Authentication → Providers → Google** → abilita e incolla ID e secret.

Fatto: il pulsante "Continua con Google" nell'app ora esegue l'OAuth vero.

## 6. Invitare i membri della band

- **Impostazioni → sezione Backstage → "Invita un account per email"**:
  funziona anche se la persona non è ancora registrata.
- Quando quella persona accede (o si registra) con la stessa email, vede un
  banner con l'invito e un pulsante **Accetta**: entra nella band con il ruolo assegnato.
- I membri "solo nome" (senza account) restano nel roster per voce principale
  e "chi la sa suonare".

## 7. Sincronizzazione in tempo reale

Già attiva: ogni modifica (brani, stati, scaletta, roster) arriva agli altri
membri connessi in ~1 secondo tramite Supabase Realtime. Non serve configurare nulla.

## 8. Deploy in produzione (Vercel, gratuito)

1. Carica il progetto su GitHub.
2. Su https://vercel.com → **Add New → Project** → importa il repository
   (Vercel riconosce Vite da solo).
3. In **Environment Variables** aggiungi `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Deploy. Poi, con il dominio ottenuto (es. `https://backstage-tuonome.vercel.app`):
   - Supabase → **Authentication → URL Configuration**: imposta **Site URL** al dominio
     e aggiungilo ai **Redirect URLs**;
   - Google Cloud → credenziali OAuth: aggiungi il dominio alle *Origini JavaScript autorizzate*.

## Struttura del progetto

```
supabase/schema.sql      Schema completo del database (tabelle, RLS, trigger, realtime)
src/lib/supabase.js      Client Supabase
src/lib/db.js            Accesso ai dati (CRUD + realtime)
src/lib/musicTheory.js   Transpose, accordi, stima tonalità
src/lib/api.js           Ricerca brani (iTunes + MusicBrainz, gratuite senza chiave)
src/lib/themes.js        I 10 temi, stati e ruoli
src/components/          Schermate e modali
src/App.jsx              Logica principale (sessione, dati, azioni ottimistiche)
```

## Note sulla sicurezza

- Le password sono gestite da Supabase Auth (mai visibili all'app).
- La **Row Level Security** garantisce a livello di database che ognuno veda
  e modifichi solo le band di cui è membro — anche se qualcuno chiamasse le API a mano.
- La `anon key` è pensata per stare nel frontend: i permessi reali li decide la RLS.
