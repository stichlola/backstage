import React, { useState, useEffect } from "react";
import { STATI, statoDi, fmtDur } from "../lib/themes";
import { getPublicSetlist } from "../lib/db";
import { transposeKeyName } from "../lib/musicTheory";
import { PrintSheet } from "./SetlistPanel";
import { Equalizer } from "./common";

const TIPO_ICON = { prova: "🎧", concerto: "🎤", altro: "📌" };
const fmtDataOra = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" }) +
    " · " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
};

/* ============================================================
   AGENDA — prove e concerti con disponibilità dei membri
   ============================================================ */
export function Agenda({ band, events, setlists, myMember, onCreate, onUpdate, onDelete, onSetAvailability }) {
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(null);
  const now = Date.now();
  const futuri = events.filter((e) => new Date(e.data).getTime() >= now - 3600e3);
  const passati = events.filter((e) => new Date(e.data).getTime() < now - 3600e3).reverse();
  const [showPast, setShowPast] = useState(false);

  const openNew = () => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(21, 0, 0, 0);
    setForm({ tipo: "prova", titolo: "", data: d.toISOString().slice(0, 16), luogo: "", note: "", setlist_id: "" });
    setShowNew(true);
  };
  const salva = async () => {
    if (!form.data) return;
    await onCreate({
      tipo: form.tipo, titolo: form.titolo.trim() || (form.tipo === "prova" ? "Prova" : form.tipo === "concerto" ? "Concerto" : "Evento"),
      data: new Date(form.data).toISOString(), luogo: form.luogo.trim(), note: form.note.trim(),
      setlist_id: form.setlist_id || null,
    });
    setShowNew(false);
  };

  const AvailRow = ({ ev }) => {
    const av = Object.fromEntries((ev.event_availability || []).map((a) => [a.member_id, a.stato]));
    const mine = myMember ? av[myMember.id] : null;
    const ICON = { si: "✅", no: "❌", forse: "🤔" };
    return (
      <div className="ev-avail">
        <div className="ev-avail-members">
          {band.members.map((m) => (
            <span key={m.id} className={"ev-dot ev-" + (av[m.id] || "none")} title={`${m.nome}: ${av[m.id] === "si" ? "c'è" : av[m.id] === "no" ? "non c'è" : av[m.id] === "forse" ? "forse" : "non ha risposto"}`}>
              {m.nome.slice(0, 2)}
            </span>
          ))}
        </div>
        {myMember ? (
          <div className="ev-my">
            {["si", "forse", "no"].map((st) => (
              <button key={st} className={"btn btn-ghost ev-btn" + (mine === st ? " ev-btn-on" : "")}
                onClick={() => onSetAvailability(ev.id, myMember.id, st)}>
                {ICON[st]} {st === "si" ? "Ci sono" : st === "forse" ? "Forse" : "No"}
              </button>
            ))}
          </div>
        ) : (
          <span className="tool-hint">Collega il tuo account al roster per rispondere.</span>
        )}
      </div>
    );
  };

  const EventCard = ({ ev }) => {
    const sl = setlists.find((s) => s.id === ev.setlist_id);
    return (
      <div className="ev-card">
        <div className="ev-head">
          <span className="ev-tipo">{TIPO_ICON[ev.tipo]}</span>
          <div className="ev-info">
            <b>{ev.titolo}</b>
            <small>{fmtDataOra(ev.data)}{ev.luogo ? ` · ${ev.luogo}` : ""}{sl ? ` · 🎵 ${sl.nome}` : ""}</small>
            {ev.note && <small className="ev-note">{ev.note}</small>}
          </div>
          <button className="btn btn-danger" onClick={() => { if (window.confirm("Eliminare questo evento?")) onDelete(ev.id); }}>✕</button>
        </div>
        <AvailRow ev={ev} />
      </div>
    );
  };

  return (
    <main className="setlist">
      <div className="setlist-head">
        <h2 className="setlist-title">Agenda — {band.nome}</h2>
        <button className="btn btn-primary" onClick={openNew}>+ Nuovo evento</button>
      </div>

      {futuri.length === 0 && <div className="setlist-empty">Nessun evento in programma. Crea la prossima prova o il prossimo concerto!</div>}
      <div className="ev-list">{futuri.map((ev) => <EventCard key={ev.id} ev={ev} />)}</div>

      {passati.length > 0 && (
        <>
          <button className="btn btn-ghost" style={{ marginTop: 18 }} onClick={() => setShowPast(!showPast)}>
            {showPast ? "Nascondi" : "Mostra"} eventi passati ({passati.length})
          </button>
          {showPast && <div className="ev-list ev-past">{passati.map((ev) => <EventCard key={ev.id} ev={ev} />)}</div>}
        </>
      )}

      {showNew && (
        <div className="modal-bg" onClick={() => setShowNew(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Nuovo evento</h2>
            <div className="field-row">
              <label className="field"><span>Tipo</span>
                <select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>
                  <option value="prova">🎧 Prova</option>
                  <option value="concerto">🎤 Concerto</option>
                  <option value="altro">📌 Altro</option>
                </select>
              </label>
              <label className="field"><span>Data e ora</span>
                <input type="datetime-local" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
              </label>
            </div>
            <label className="field"><span>Titolo</span>
              <input value={form.titolo} onChange={(e) => setForm((f) => ({ ...f, titolo: e.target.value }))} placeholder={form.tipo === "concerto" ? "Es. Live al Bar Sport" : "Es. Prova generale"} />
            </label>
            <label className="field"><span>Luogo</span>
              <input value={form.luogo} onChange={(e) => setForm((f) => ({ ...f, luogo: e.target.value }))} placeholder="Sala prove, locale…" />
            </label>
            {form.tipo === "concerto" && (
              <label className="field"><span>Scaletta collegata</span>
                <select value={form.setlist_id} onChange={(e) => setForm((f) => ({ ...f, setlist_id: e.target.value }))}>
                  <option value="">—</option>
                  {setlists.filter((s) => !s.archived).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </label>
            )}
            <label className="field"><span>Note</span>
              <textarea rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </label>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={salva}>Crea evento</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ============================================================
   STUDIO — "compiti a casa": i brani che un membro non sa ancora
   ============================================================ */
export function StudioView({ band, songs, myMember, statusColors, onOpenSong, onImparata }) {
  const [memberId, setMemberId] = useState(myMember?.id || band.members[0]?.id || "");
  useEffect(() => { if (myMember) setMemberId(myMember.id); }, [myMember?.id]); // eslint-disable-line
  const member = band.members.find((m) => m.id === memberId);
  const ordStato = { da_imparare: 0, in_prova: 1, quasi_pronta: 2, pronta: 3 };
  const daStudiare = member
    ? songs.filter((s) => !(s.sanno || []).includes(member.nome))
        .sort((a, b) => (b.priorita ? 1 : 0) - (a.priorita ? 1 : 0) || ordStato[b.stato] - ordStato[a.stato])
    : [];

  return (
    <main className="setlist">
      <div className="setlist-head">
        <h2 className="setlist-title">Da studiare</h2>
        <select value={memberId} onChange={(e) => setMemberId(e.target.value)} style={{ minWidth: 180 }}>
          {band.members.map((m) => <option key={m.id} value={m.id}>{m.nome} ({m.ruolo})</option>)}
        </select>
      </div>
      {member && daStudiare.length === 0 && (
        <div className="setlist-empty">🎉 {member.nome} sa tutti i brani del repertorio!</div>
      )}
      <ol className="setlist-list">
        {daStudiare.map((s) => {
          const idx = STATI.findIndex((x) => x.id === s.stato);
          return (
            <li key={s.id} className="setlist-row" style={{ "--accent": statusColors[idx] }}>
              {s.priorita && <span title="Prioritaria">⭐</span>}
              <div className="setlist-info" onClick={() => onOpenSong(s)} style={{ cursor: "pointer" }}>
                <div className="setlist-song">{s.titolo}</div>
                <div className="setlist-artist">{s.artista}</div>
              </div>
              <span className="chip mono">{transposeKeyName(s.tonalita, s.transpose || 0) || "—"}</span>
              <span className="chip mono">{fmtDur(s.durata)}</span>
              <span className="setlist-stato" style={{ color: statusColors[idx] }}>● {statoDi(s.stato).label}</span>
              <button className="btn btn-ghost in-setlist" onClick={() => onImparata(s, member.nome)}>✓ La so!</button>
            </li>
          );
        })}
      </ol>
    </main>
  );
}

/* ============================================================
   CAMPANELLA ATTIVITÀ — registro + notifiche in-app
   ============================================================ */
export function ActivityBell({ activity, bandId }) {
  const [open, setOpen] = useState(false);
  const lsKey = "bs-seen-" + bandId;
  const [lastSeen, setLastSeen] = useState(() => {
    try { return localStorage.getItem(lsKey) || "1970-01-01"; } catch { return "1970-01-01"; }
  });
  const unread = activity.filter((a) => a.created_at > lastSeen).length;
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && activity[0]) {
      setLastSeen(activity[0].created_at);
      try { localStorage.setItem(lsKey, activity[0].created_at); } catch { /* incognito */ }
    }
  };
  const fmtRel = (iso) => {
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return "adesso";
    if (min < 60) return `${min} min fa`;
    if (min < 1440) return `${Math.round(min / 60)} h fa`;
    return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  };
  return (
    <div className="user-wrap">
      <button className="btn btn-ghost btn-settings" onClick={toggle} title="Attività della band">
        🔔{unread > 0 && <span className="bell-badge mono">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="user-menu bell-menu">
          <div className="settings-section-title" style={{ marginBottom: 8 }}>Attività recente</div>
          {activity.length === 0 && <div className="tool-hint">Ancora nessuna attività.</div>}
          {activity.map((a) => (
            <div key={a.id} className={"bell-row" + (a.created_at > lastSeen ? " bell-new" : "")}>
              <b>{a.autore}</b> {a.azione}
              <small>{fmtRel(a.created_at)}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PAGINA PUBBLICA — scaletta di sola lettura per il fonico
   ============================================================ */
export function PublicSetlistPage({ token }) {
  const [data, setData] = useState(undefined);
  useEffect(() => {
    getPublicSetlist(token).then(setData).catch(() => setData(null));
  }, [token]);

  if (data === undefined) {
    return <div className="auth-wrap"><div className="loading-box"><Equalizer colors={["#FFB340", "#FF5CA8", "#4DD6FF", "#5CFF9D"]} /><p className="tagline">Caricamento scaletta…</p></div></div>;
  }
  if (data === null) {
    return <div className="auth-wrap"><div className="auth-card" style={{ textAlign: "center" }}><h1 className="logo">BACKSTAGE</h1><p className="tagline">Scaletta non trovata: il link potrebbe essere stato revocato.</p></div></div>;
  }
  const songs = data.songs || [];
  const tot = songs.reduce((t, s) => t + (s.durata || 0), 0) + Math.max(0, songs.length - 1) * (data.gapSec || 0);
  return (
    <>
      <div className="no-print public-page">
        <div className="public-head">
          <h1 className="logo">BACKSTAGE</h1>
          <div>
            <h2 className="setlist-title">{data.band} — {data.nome}</h2>
            <p className="tagline">{data.data || ""}{data.luogo ? ` · ${data.luogo}` : ""} · {songs.length} brani · {fmtDur(tot)}</p>
          </div>
          <button className="btn btn-primary" onClick={() => window.print()}>🖨 Stampa / PDF</button>
        </div>
        <ol className="setlist-list public-list">
          {songs.map((s, i) => (
            <li key={i} className="setlist-row" style={{ "--accent": "#5CFF9D" }}>
              <span className="setlist-num mono">{String(i + 1).padStart(2, "0")}</span>
              <div className="setlist-info">
                <div className="setlist-song">{s.titolo}</div>
                <div className="setlist-artist">{s.artista} {s.voce && <>· 🎤 {s.voce}</>}</div>
              </div>
              <span className="chip mono">{transposeKeyName(s.tonalita, s.transpose || 0) || "—"}</span>
              <span className="chip mono">{s.bpm ? s.bpm + " BPM" : "—"}</span>
              <span className="chip mono">{fmtDur(s.durata)}</span>
            </li>
          ))}
        </ol>
        <p className="footer">Scaletta condivisa in sola lettura · generata con Backstage</p>
      </div>
      <PrintSheet bandName={data.band} setlist={{ nome: data.nome, data: data.data, luogo: data.luogo }} songs={songs} gapSec={data.gapSec || 0} />
    </>
  );
}
