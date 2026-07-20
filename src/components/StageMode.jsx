import React, { useState, useEffect } from "react";
import { STATI, fmtDur } from "../lib/themes";
import { transposeKeyName } from "../lib/musicTheory";
import { ChordSheet } from "./common";

export function StageMode({ scaletta, colors, onClose }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const h = (e) => {
      if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, scaletta.length - 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [scaletta.length, onClose]);

  if (!scaletta.length) return null;
  const s = scaletta[i];
  const next = scaletta[i + 1];
  const idx = STATI.findIndex((x) => x.id === s.stato);

  return (
    <div className="stage">
      <div className="stage-top">
        <span className="mono stage-count">{i + 1} / {scaletta.length}</span>
        <button className="btn btn-ghost" onClick={onClose}>✕ Esci (Esc)</button>
      </div>
      <div className="stage-main">
        <h1 className="stage-title" style={{ color: colors[idx] }}>{s.titolo}</h1>
        <div className="stage-artist">{s.artista} {s.voce && <>· 🎤 {s.voce}</>}</div>
        <div className="stage-chips">
          <span className="chip mono">{transposeKeyName(s.tonalita, s.transpose || 0) || "—"}</span>
          <span className="chip mono">{s.bpm ? s.bpm + " BPM" : "—"}</span>
          <span className="chip mono">{fmtDur(s.durata)}</span>
        </div>
        <div className="stage-sheet"><ChordSheet text={s.sheet} semis={s.transpose || 0} big /></div>
      </div>
      <div className="stage-bottom">
        <button className="btn btn-ghost" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>← Precedente</button>
        <div className="stage-next">{next ? <>Prossimo: <b>{next.titolo}</b></> : "Ultimo brano 🎉"}</div>
        <button className="btn btn-primary" onClick={() => setI(Math.min(scaletta.length - 1, i + 1))} disabled={i === scaletta.length - 1}>Successivo →</button>
      </div>
    </div>
  );
}
