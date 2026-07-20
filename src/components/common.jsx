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

export const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2C41.4 34.9 44 29.9 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
);

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
