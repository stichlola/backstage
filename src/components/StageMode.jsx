import React, { useState, useEffect, useRef } from "react";
import { STATI, fmtDur } from "../lib/themes";
import { transposeKeyName } from "../lib/musicTheory";
import { ChordSheet } from "./common";
import * as db from "../lib/db";

export function StageMode({ scaletta, colors, onClose }) {
  const [i, setI] = useState(0);
  const [scrolling, setScrolling] = useState(false);
  const [speed, setSpeed] = useState(30); // pixel al secondo
  const [blackout, setBlackout] = useState(false);
  const [docs, setDocs] = useState({}); // songId -> [file doc]
  const sheetRef = useRef(null);
  const rafRef = useRef(null);

  /* navigazione da tastiera (spazio = scroll on/off) */
  useEffect(() => {
    const h = (e) => {
      if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, scaletta.length - 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
      if (e.key === "Escape") onClose();
      if (e.key === " " && e.target === document.body) { e.preventDefault(); setScrolling((s) => !s); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [scaletta.length, onClose]);

  /* auto-scroll fluido */
  useEffect(() => {
    if (!scrolling) { cancelAnimationFrame(rafRef.current); return; }
    let last = performance.now();
    const step = (now) => {
      const el = sheetRef.current;
      if (el) {
        el.scrollTop += ((now - last) / 1000) * speed;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) setScrolling(false);
      }
      last = now;
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [scrolling, speed]);

  const s = scaletta[i];

  /* al cambio brano: ferma lo scroll, torna in cima, carica spartiti */
  useEffect(() => {
    setScrolling(false);
    if (sheetRef.current) sheetRef.current.scrollTop = 0;
    if (s && docs[s.id] === undefined) {
      db.getSongFiles(s.id)
        .then((fs) => setDocs((d) => ({ ...d, [s.id]: fs.filter((f) => f.tipo === "doc") })))
        .catch(() => setDocs((d) => ({ ...d, [s.id]: [] })));
    }
  }, [i]); // eslint-disable-line

  if (!scaletta.length) return null;
  const next = scaletta[i + 1];
  const idx = STATI.findIndex((x) => x.id === s.stato);
  const apriDoc = async (f) => {
    try { window.open(await db.fileUrl(f.path), "_blank"); } catch (e) { console.error(e); }
  };

  return (
    <div className={"stage no-print" + (blackout ? " stage-blackout" : "")}>
      <div className="stage-top">
        <span className="mono stage-count">{i + 1} / {scaletta.length}</span>
        <div className="stage-tools">
          <button className={"btn btn-ghost" + (scrolling ? " in-setlist" : "")} onClick={() => setScrolling(!scrolling)} title="Spazio per avviare/fermare">
            {scrolling ? "⏸ Scroll" : "▶ Scroll"}
          </button>
          <input type="range" min="8" max="120" value={speed} onChange={(e) => setSpeed(+e.target.value)} title="Velocità di scorrimento" className="stage-speed" />
          <button className={"btn btn-ghost" + (blackout ? " in-setlist" : "")} onClick={() => setBlackout(!blackout)} title="Sfondo nero puro, testo ingrandito">
            {blackout ? "☀ Normale" : "🌑 Anti-riflesso"}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>✕ Esci</button>
        </div>
      </div>
      <div className="stage-main">
        <h1 className="stage-title" style={{ color: blackout ? "#fff" : colors[idx] }}>{s.titolo}</h1>
        <div className="stage-artist">{s.artista} {s.voce && <>· 🎤 {s.voce}</>}</div>
        <div className="stage-chips">
          <span className="chip mono">{transposeKeyName(s.tonalita, s.transpose || 0) || "—"}</span>
          <span className="chip mono">{s.bpm ? s.bpm + " BPM" : "—"}</span>
          <span className="chip mono">{fmtDur(s.durata)}</span>
          {(docs[s.id] || []).map((f) => (
            <button key={f.id} className="chip stage-doc" onClick={() => apriDoc(f)} title="Apri spartito">
              📄 {f.nome.length > 22 ? f.nome.slice(0, 20) + "…" : f.nome}
            </button>
          ))}
        </div>
        <div className="stage-sheet" ref={sheetRef}>
          <ChordSheet text={s.sheet} semis={s.transpose || 0} big />
        </div>
      </div>
      <div className="stage-bottom">
        <button className="btn btn-ghost" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>← Precedente</button>
        <div className="stage-next">{next ? <>Prossimo: <b>{next.titolo}</b></> : "Ultimo brano 🎉"}</div>
        <button className="btn btn-primary" onClick={() => setI(Math.min(scaletta.length - 1, i + 1))} disabled={i === scaletta.length - 1}>Successivo →</button>
      </div>
    </div>
  );
}
