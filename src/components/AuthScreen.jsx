import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { Equalizer } from "./common";

/* Schermata mostrata se .env non è configurato */
export function SetupScreen({ colors }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <Equalizer colors={colors} />
          <h1 className="logo">BACKSTAGE</h1>
          <p className="tagline">Configurazione necessaria</p>
        </div>
        <div className="tool-hint" style={{ lineHeight: 1.8 }}>
          Manca la configurazione di Supabase. Per avviare l'app:
          <br />1. Crea un progetto gratuito su <b>supabase.com</b>
          <br />2. Esegui <span className="mono">supabase/schema.sql</span> nell'editor SQL
          <br />3. Copia <span className="mono">.env.example</span> in <span className="mono">.env</span> e inserisci URL e anon key del progetto (Project Settings → API)
          <br />4. Riavvia con <span className="mono">npm run dev</span>
          <br /><br />Trovi tutti i dettagli nel <b>README.md</b>.
        </div>
      </div>
    </div>
  );
}

export function AuthScreen({ colors }) {
  const [mode, setMode] = useState("login"); // login | register | reset
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [nome, setNome] = useState("");
  const [err, setErr] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const go = (m) => { setMode(m); setErr(null); setInfo(null); };

  const submit = async () => {
    setErr(null); setInfo(null); setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) throw error;
      } else if (mode === "register") {
        if (!nome.trim()) throw new Error("Inserisci il tuo nome.");
        if (pw.length < 6) throw new Error("La password deve avere almeno 6 caratteri.");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: pw,
          options: { data: { full_name: nome.trim() } },
        });
        if (error) throw error;
        if (data.user && !data.session) {
          setInfo("Registrazione riuscita! Controlla l'email per confermare l'account, poi accedi.");
        }
      } else if (mode === "reset") {
        if (!email.trim()) throw new Error("Inserisci la tua email.");
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin + window.location.pathname,
        });
        if (error) throw error;
        setInfo("Se esiste un account con questa email, ti abbiamo inviato un link per reimpostare la password. Controlla la posta (anche lo spam): il link ti riporterà qui per scegliere la nuova password.");
      }
    } catch (e) {
      setErr(traduci(e.message));
    }
    setBusy(false);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <Equalizer colors={colors} />
          <h1 className="logo">BACKSTAGE</h1>
          <p className="tagline">
            {mode === "reset" ? "Recupera l'accesso al tuo account" : "Accedi per gestire il repertorio delle tue band"}
          </p>
        </div>

        {mode !== "reset" && (
          <div className="tabs auth-tabs">
            <button className={"tab" + (mode === "login" ? " tab-on" : "")} onClick={() => go("login")}>Accedi</button>
            <button className={"tab" + (mode === "register" ? " tab-on" : "")} onClick={() => go("register")}>Registrati</button>
          </div>
        )}

        {mode === "register" && (
          <label className="field"><span>Nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Il tuo nome" />
          </label>
        )}
        <label className="field"><span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@esempio.it" onKeyDown={(e) => e.key === "Enter" && submit()} />
        </label>
        {mode !== "reset" && (
          <label className="field"><span>Password</span>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && submit()} />
          </label>
        )}

        {err && <div className="auth-err">{err}</div>}
        {info && <div className="tool-hint hint-ok" style={{ marginBottom: 12 }}>{info}</div>}

        <button className="btn btn-primary btn-block" disabled={busy} onClick={submit}>
          {busy ? "Attendi…" : mode === "login" ? "Accedi" : mode === "register" ? "Crea account" : "Invia link di reset"}
        </button>

        {mode === "login" && (
          <button className="link-btn auth-forgot" onClick={() => go("reset")}>Password dimenticata?</button>
        )}
        {mode === "reset" && (
          <button className="link-btn auth-forgot" onClick={() => go("login")}>← Torna all'accesso</button>
        )}
      </div>
    </div>
  );
}

/* Schermata per impostare la nuova password dopo aver cliccato
   il link ricevuto via email (evento PASSWORD_RECOVERY) */
export function NewPasswordScreen({ colors, onDone }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  const salva = async () => {
    setErr(null);
    if (pw.length < 6) return setErr("La password deve avere almeno 6 caratteri.");
    if (pw !== pw2) return setErr("Le due password non coincidono.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setOk(true);
      setTimeout(onDone, 1500);
    } catch (e) {
      setErr(traduci(e.message));
    }
    setBusy(false);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <Equalizer colors={colors} />
          <h1 className="logo">BACKSTAGE</h1>
          <p className="tagline">Scegli la nuova password</p>
        </div>
        {ok ? (
          <div className="tool-hint hint-ok" style={{ textAlign: "center" }}>✓ Password aggiornata! Ti sto portando dentro…</div>
        ) : (
          <>
            <label className="field"><span>Nuova password</span>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Almeno 6 caratteri" onKeyDown={(e) => e.key === "Enter" && salva()} autoFocus />
            </label>
            <label className="field"><span>Ripeti la nuova password</span>
              <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && salva()} />
            </label>
            {err && <div className="auth-err">{err}</div>}
            <button className="btn btn-primary btn-block" disabled={busy} onClick={salva}>
              {busy ? "Salvataggio…" : "Imposta nuova password"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function traduci(msg) {
  if (!msg) return "Errore sconosciuto.";
  if (msg.includes("Invalid login credentials")) return "Email o password non corretti.";
  if (msg.includes("already registered")) return "Esiste già un account con questa email.";
  if (msg.includes("Email not confirmed")) return "Conferma prima l'email: controlla la posta.";
  if (msg.includes("rate limit") || msg.includes("Too many")) return "Troppe richieste: aspetta qualche minuto e riprova.";
  if (msg.includes("should be different")) return "La nuova password deve essere diversa da quella attuale.";
  return msg;
}
