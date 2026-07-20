import React, { useState, useEffect } from "react";
import { fmtDur } from "../lib/themes";
import { getPublicSetlist } from "../lib/db";
import { transposeKeyName } from "../lib/musicTheory";
import { PrintSheet } from "./SetlistPanel";
import { Equalizer } from "./common";

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
