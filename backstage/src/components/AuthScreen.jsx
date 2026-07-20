import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { Equalizer, GoogleG } from "./common";

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
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [nome, setNome] = useState("");
  const [err, setErr] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(null); setInfo(null); setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) throw error;
      } else {
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
      }
    } catch (e) {
      setErr(traduci(e.message));
    }
    setBusy(false);
  };

  const google = async () => {
    setErr(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setErr(traduci(error.message));
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <Equalizer colors={colors} />
          <h1 className="logo">BACKSTAGE</h1>
          <p className="tagline">Accedi per gestire il repertorio delle tue band</p>
        </div>
        <div className="tabs auth-tabs">
          <button className={"tab" + (mode === "login" ? " tab-on" : "")} onClick={() => { setMode("login"); setErr(null); setInfo(null); }}>Accedi</button>
          <button className={"tab" + (mode === "register" ? " tab-on" : "")} onClick={() => { setMode("register"); setErr(null); setInfo(null); }}>Registrati</button>
        </div>
        {mode === "register" && (
          <label className="field"><span>Nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Il tuo nome" />
          </label>
        )}
        <label className="field"><span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@esempio.it" onKeyDown={(e) => e.key === "Enter" && submit()} />
        </label>
        <label className="field"><span>Password</span>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && submit()} />
        </label>
        {err && <div className="auth-err">{err}</div>}
        {info && <div className="tool-hint hint-ok" style={{ marginBottom: 12 }}>{info}</div>}
        <button className="btn btn-primary btn-block" disabled={busy} onClick={submit}>
          {busy ? "Attendi…" : mode === "login" ? "Accedi" : "Crea account"}
        </button>
        <div className="auth-divider"><span>oppure</span></div>
        <button className="btn btn-google btn-block" onClick={google}>
          <GoogleG /> Continua con Google
        </button>
      </div>
    </div>
  );
}

function traduci(msg) {
  if (!msg) return "Errore sconosciuto.";
  if (msg.includes("Invalid login credentials")) return "Email o password non corretti.";
  if (msg.includes("already registered")) return "Esiste già un account con questa email.";
  if (msg.includes("Email not confirmed")) return "Conferma prima l'email: controlla la posta.";
  if (msg.includes("provider is not enabled")) return "Il provider Google non è abilitato nella dashboard Supabase (Authentication → Providers).";
  return msg;
}
