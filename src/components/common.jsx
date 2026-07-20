import React, { useState, useRef, useEffect, useCallback } from "react";
import { isChordToken, transposeChordToken } from "../lib/musicTheory";

export function Equalizer({ colors }) {
  return (
    <div className="eq" aria-hidden="true">
      {Array.from({ length: 14 }).map((_, i) => (
        <span key={i} style={{ animationDelay: `${(i * 0.11) % 1.1}s`, animationDuration: `${0.9 + (i % 4) * 0.22}s`, background: colors[i % 4] }} />
      ))}
    </div>
  );
}

export function Avatar({ nome, color, size = 34 }) {
  return (
    <span className="avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}>
      {(nome || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
    </span>
  );
}

export function ChordSheet({ text, semis, big }) {
  if (!text?.trim()) return <div className="sheet-empty">Nessun testo inserito.</div>;
  return (
    <pre className={"sheet" + (big ? " sheet-big" : "")}>
      {text.split("\n").map((line, li) => {
        if (line.includes("[")) {
          const parts = line.split(/(\[[^\]\n]{1,10}\])/g);
          return (
            <div key={li} className="sheet-line">
              {parts.map((p, pi) => {
                const m = p.match(/^\[([^\]]+)\]$/);
                if (m && isChordToken(m[1].trim())) return <span key={pi} className="sheet-chord">{transposeChordToken(m[1].trim(), semis)}</span>;
                return <span key={pi}>{p}</span>;
              })}
            </div>
          );
        }
        const toks = line.trim().split(/\s+/).filter(Boolean);
        if (toks.length > 0 && toks.every(isChordToken)) {
          return (
            <div key={li} className="sheet-line">
              {line.split(/(\s+)/).map((p, pi) => (p.trim() ? <span key={pi} className="sheet-chord">{transposeChordToken(p, semis)}</span> : <span key={pi}>{p}</span>))}
            </div>
          );
        }
        return <div key={li} className="sheet-line">{line || " "}</div>;
      })}
    </pre>
  );
}

export function useMetronome() {
  const ctxRef = useRef(null);
  const timerRef = useRef(null);
  const beatRef = useRef(0);
  const [running, setRunning] = useState(false);
  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRunning(false);
  }, []);
  const start = useCallback((bpm) => {
    stop();
    if (!bpm || bpm < 20) return;
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") ctx.resume();
    beatRef.current = 0;
    const tick = () => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const accent = beatRef.current % 4 === 0;
      osc.frequency.value = accent ? 1500 : 1000;
      g.gain.setValueAtTime(accent ? 0.35 : 0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.09);
      beatRef.current++;
    };
    tick();
    timerRef.current = setInterval(tick, 60000 / bpm);
    setRunning(true);
  }, [stop]);
  useEffect(() => stop, [stop]);
  return { running, start, stop };
}
