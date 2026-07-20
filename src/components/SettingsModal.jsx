import React, { useState } from "react";
import { THEMES, RUOLI } from "../lib/themes";

export function SettingsModal({ profile, onProfilePatch, band, onBandPatch, onAddMember, onRemoveMember, onInvite, isOwner, onClose }) {
  const [mNome, setMNome] = useState("");
  const [mRuolo, setMRuolo] = useState("Chitarra");
  const [invEmail, setInvEmail] = useState("");
  const [invRuolo, setInvRuolo] = useState("Musicista");
  const [invMsg, setInvMsg] = useState(null);

  const addMember = async () => {
    const n = mNome.trim();
    if (!n || band.members.some((m) => m.nome === n)) return;
    await onAddMember(n, mRuolo);
    setMNome("");
  };
  const invite = async () => {
    const e = invEmail.trim().toLowerCase();
    if (!e) return;
    try {
      await onInvite(e, invRuolo);
      setInvMsg({ ok: true, txt: `Invito registrato per ${e}: quando accederà con questa email troverà l'invito ad unirsi a "${band.nome}".` });
      setInvEmail("");
    } catch (err) {
      setInvMsg({ ok: false, txt: err.message?.includes("duplicate") ? "Esiste già un invito per questa email." : "Errore nell'invito: " + err.message });
    }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Impostazioni</h2>

        <div className="settings-section">
          <div className="settings-section-title">👤 Personali — {profile.nome}</div>
          <label className="field"><span>Il tuo nome</span>
            <input value={profile.nome} onChange={(e) => onProfilePatch({ nome: e.target.value })} maxLength={30} />
          </label>
          <div className="field">
            <span>Modalità (solo per te)</span>
            <div className="mode-toggle">
              <button className={"tab" + (profile.mode === "dark" ? " tab-on" : "")} onClick={() => onProfilePatch({ mode: "dark" })}>🌙 Notte</button>
              <button className={"tab" + (profile.mode === "light" ? " tab-on" : "")} onClick={() => onProfilePatch({ mode: "light" })}>☀️ Giorno</button>
            </div>
          </div>
          <div className="field">
            <span>Tema (solo per te)</span>
            <div className="theme-grid">
              {Object.entries(THEMES).map(([id, t]) => {
                const pal = t[profile.mode];
                return (
                  <button key={id}
                    className={"theme-card" + (profile.theme === id ? " theme-on" : "")}
                    style={{ background: pal.card, color: pal.text, borderColor: profile.theme === id ? t.status[profile.mode][1] : pal.border, borderRadius: Math.max(4, t.r), fontFamily: t.fb }}
                    onClick={() => onProfilePatch({ theme: id })}>
                    <span className="theme-dots">{t.status[profile.mode].map((c, i) => <i key={i} style={{ background: c }} />)}</span>
                    <b style={{ fontFamily: t.fd, fontWeight: 700 }}>{t.label}</b>
                    <small style={{ color: pal.sub }}>{t.desc}</small>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">
            🎸 Backstage — {band.nome} {isOwner && <em className="owner-badge">proprietario</em>}
          </div>
          <label className="field">
            <span>Nome della band (sottotitolo dell'app)</span>
            <input value={band.nome} onChange={(e) => onBandPatch({ nome: e.target.value })} maxLength={30} disabled={!isOwner} />
          </label>
          <label className="field">
            <span>Pausa tra i brani in scaletta (secondi)</span>
            <input type="number" min="0" max="300" value={band.gapSec} onChange={(e) => onBandPatch({ gapSec: parseInt(e.target.value, 10) || 0 })} />
          </label>
          <div className="field">
            <span>Membri e ruoli</span>
            <div className="members-list">
              {band.members.map((m) => (
                <span key={m.id} className="member-pill">
                  {m.nome} <em className="member-role">{m.ruolo}</em>
                  {m.userId && <em className="member-role" title="Ha un account collegato">🔗</em>}
                  {isOwner && <button className="member-x" onClick={() => onRemoveMember(m.id)}>✕</button>}
                </span>
              ))}
            </div>
            {isOwner && (
              <div className="stepper" style={{ marginTop: 8 }}>
                <input value={mNome} onChange={(e) => setMNome(e.target.value)} placeholder="Nome" onKeyDown={(e) => e.key === "Enter" && addMember()} style={{ flex: 1 }} />
                <select value={mRuolo} onChange={(e) => setMRuolo(e.target.value)}>
                  {RUOLI.map((r) => <option key={r}>{r}</option>)}
                </select>
                <button className="btn btn-ghost" onClick={addMember}>+ Aggiungi</button>
              </div>
            )}
          </div>
          {isOwner && (
            <div className="field">
              <span>Invita un account per email (funziona anche se non è ancora registrato)</span>
              <div className="stepper">
                <input value={invEmail} onChange={(e) => { setInvEmail(e.target.value); setInvMsg(null); }} placeholder="email@esempio.it" onKeyDown={(e) => e.key === "Enter" && invite()} style={{ flex: 1 }} />
                <select value={invRuolo} onChange={(e) => setInvRuolo(e.target.value)}>
                  {RUOLI.map((r) => <option key={r}>{r}</option>)}
                </select>
                <button className="btn btn-ghost" onClick={invite}>Invita</button>
              </div>
              {invMsg && <div className={"tool-hint " + (invMsg.ok ? "hint-ok" : "hint-warn")} style={{ marginTop: 6 }}>{invMsg.txt}</div>}
            </div>
          )}
        </div>

        <div className="modal-actions"><button className="btn btn-primary" onClick={onClose}>Fatto</button></div>
      </div>
    </div>
  );
}
