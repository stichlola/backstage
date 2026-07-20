import React, { useState, useRef, useEffect } from "react";
import { RUOLI } from "../lib/themes";

export function CreateBandModal({ userName, onCreate, onClose }) {
  const [nome, setNome] = useState("");
  const [ruolo, setRuolo] = useState("Voce");
  const [members, setMembers] = useState([]);
  const [mNome, setMNome] = useState("");
  const [mRuolo, setMRuolo] = useState("Chitarra");
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const addM = () => {
    const n = mNome.trim();
    if (!n || members.some((m) => m.nome === n) || n === userName) return;
    setMembers((ms) => [...ms, { nome: n, ruolo: mRuolo }]);
    setMNome("");
  };
  const crea = async () => {
    if (!nome.trim() || busy) return;
    setBusy(true);
    try { await onCreate(nome.trim(), ruolo, members); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">🎸 Nuovo backstage</h2>
        <div className="tool-hint" style={{ marginBottom: 14 }}>
          Un backstage è lo spazio di una band: repertorio, scaletta e membri. Puoi crearne quanti vuoi e passare dall'uno all'altro.
        </div>
        <label className="field"><span>Nome della band *</span>
          <input ref={ref} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es. I Fulmini" onKeyDown={(e) => e.key === "Enter" && crea()} />
        </label>
        <label className="field"><span>Il tuo ruolo nella band</span>
          <select value={ruolo} onChange={(e) => setRuolo(e.target.value)}>
            {RUOLI.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <div className="field">
          <span>Altri membri (potrai aggiungerne e invitarne anche dopo)</span>
          <div className="members-list">
            {members.map((m) => (
              <span key={m.nome} className="member-pill">
                {m.nome} <em className="member-role">{m.ruolo}</em>
                <button className="member-x" onClick={() => setMembers((ms) => ms.filter((x) => x.nome !== m.nome))}>✕</button>
              </span>
            ))}
            {members.length === 0 && <span className="tool-hint">Ancora nessun altro membro.</span>}
          </div>
          <div className="stepper" style={{ marginTop: 8 }}>
            <input value={mNome} onChange={(e) => setMNome(e.target.value)} placeholder="Nome" onKeyDown={(e) => e.key === "Enter" && addM()} style={{ flex: 1 }} />
            <select value={mRuolo} onChange={(e) => setMRuolo(e.target.value)}>
              {RUOLI.map((r) => <option key={r}>{r}</option>)}
            </select>
            <button className="btn btn-ghost" onClick={addM}>+</button>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Annulla</button>
          <button className="btn btn-primary" disabled={!nome.trim() || busy} onClick={crea}>
            {busy ? "Creazione…" : "Crea backstage"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BandSwitcher({ bands, currentBandId, onSwitch, onNew }) {
  const [open, setOpen] = useState(false);
  const band = bands.find((b) => b.id === currentBandId);
  return (
    <div className="band-switch-wrap">
      <button className="band-switch" onClick={() => setOpen(!open)}>
        🎸 {band?.nome || "Scegli band"} <span className="band-caret">▾</span>
      </button>
      {open && (
        <div className="band-menu">
          {bands.map((b) => (
            <button key={b.id} className={"band-menu-item" + (b.id === currentBandId ? " band-menu-on" : "")}
              onClick={() => { onSwitch(b.id); setOpen(false); }}>
              <b>{b.nome}</b>
              <small>{b.members.length} membri</small>
            </button>
          ))}
          <button className="band-menu-item band-menu-new" onClick={() => { onNew(); setOpen(false); }}>＋ Nuovo backstage</button>
        </div>
      )}
    </div>
  );
}
