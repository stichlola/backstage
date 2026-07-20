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

## 5. Invitare i membri della band

- **Impostazioni → sezione Backstage → "Invita un account per email"**:
  funziona anche se la persona non è ancora registrata.
- Quando quella persona accede (o si registra) con la stessa email, vede un
  banner con l'invito e un pulsante **Accetta**: entra nella band con il ruolo assegnato.
- I membri "solo nome" (senza account) restano nel roster per voce principale
  e "chi la sa suonare".

## 6. Sincronizzazione in tempo reale

Già attiva: ogni modifica (brani, stati, scaletta, roster) arriva agli altri
membri connessi in ~1 secondo tramite Supabase Realtime. Non serve configurare nulla.

## 7. Deploy in produzione (Vercel, gratuito)

1. Carica il progetto su GitHub.
2. Su https://vercel.com → **Add New → Project** → importa il repository
   (Vercel riconosce Vite da solo).
3. In **Environment Variables** aggiungi `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Deploy. Poi, con il dominio ottenuto (es. `https://backstage-tuonome.vercel.app`):
   - Supabase → **Authentication → URL Configuration**: imposta **Site URL** al dominio
     e aggiungilo ai **Redirect URLs** (serve anche per i link di reset password).

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

---

## 🔄 Aggiornamento alla v2 (setlist multiple, agenda, file, commenti…)

Se hai già l'app installata (Supabase + Vercel), l'aggiornamento è in 2 passi:

**1. Database** — Supabase → SQL Editor → New query → incolla tutto il contenuto di
`supabase/migration-v2.sql` → Run. La migrazione è sicura: non tocca i dati esistenti,
può essere rieseguita, e sposta automaticamente la vecchia scaletta nella nuova
"Scaletta principale". Crea anche il bucket Storage per registrazioni e spartiti.

**2. Codice** — su GitHub apri il repository → **Add file → Upload files** → trascina
tutto il contenuto della nuova cartella del progetto (sovrascrive i file con lo stesso
nome e aggiunge i nuovi) → **Commit changes**. Vercel rileva il commit e fa il deploy
da solo in ~1 minuto. Le variabili d'ambiente restano le stesse: non serve toccare nulla.

### Novità della v2
- **Setlist multiple** con data e locale, duplica e archivio storico dei concerti
- **Stampa/PDF** della scaletta e **link pubblico di sola lettura** per il fonico
- **Modalità palco**: auto-scroll a velocità regolabile (barra spazio) e vista
  🌑 anti-riflesso (nero puro, testo ingrandito)
- **✨ Generatore di scaletta**: minuti desiderati → sequenza di brani pronti,
  BPM alternati, mai due tonalità uguali di fila
- **Registrazioni delle prove** per brano (audio riascoltabile in app) e
  **allegati** spartiti/PDF, apribili anche dalla modalità palco
- **Import ChordPro** e **suggerimento capotasto** in base al transpose
- **Tag** sui brani con filtro nel repertorio
- **Discussione** per brano (commenti con minutaggio opzionale, es. ⏱ 1:20)
- **🔔 Centro attività**: registro in tempo reale di chi ha fatto cosa, con
  badge delle novità non lette

### v2.1
- Rimosse le sezioni Agenda e Studio (le tabelle nel database restano ma sono
  inerti: nessuna azione richiesta lato Supabase)
- Corretti gli inviti: il proprietario non vede più come propri gli inviti che
  ha mandato agli altri, e "Ignora" ora è persistente

### v2.2
- **Reset password**: "Password dimenticata?" nella schermata di accesso invia
  un'email con il link; il link riporta nell'app dove si imposta la nuova password.
  Le email partono dal servizio integrato di Supabase (nessuna configurazione,
  con un limite di poche email/ora sul piano Free — sufficiente per una band).
- Rimosso il login con Google.

### v2.3 — PWA (app installabile + offline)
Backstage ora è una Progressive Web App:
- **Installabile** su telefono e computer con icona propria, si apre a schermo
  intero come un'app nativa.
  - *Android/Chrome*: banner "Installa app" o menu ⋮ → "Aggiungi a schermata Home"
  - *iPhone/Safari*: Condividi → "Aggiungi alla schermata Home"
  - *Desktop Chrome/Edge*: icona di installazione nella barra degli indirizzi
- **Offline**: l'interfaccia e gli ultimi dati consultati (repertorio, scalette,
  testi e accordi) restano disponibili senza connessione — utile sul palco di un
  locale senza segnale. Un banner 📴 avvisa quando sei offline; al ritorno della
  rete i dati si risincronizzano da soli.
- **Aggiornamenti automatici**: a ogni nuovo deploy l'app installata si aggiorna
  da sola alla prossima apertura.

Limiti onesti dell'offline: si consultano i dati già visti (in sola lettura);
le modifiche e la ricerca di nuovi brani richiedono connessione, e la sessione
di accesso resta valida offline per la sua durata naturale (~1 ora dal l'ultimo
rinnovo). Consiglio pratico: apri l'app una volta col Wi-Fi prima del concerto.
