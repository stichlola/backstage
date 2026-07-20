import React, { useState, useMemo, useRef, useEffect } from "react";
import { NOTES, transposeKeyName, extractChords, detectKeyFromChords } from "../lib/musicTheory";
import { STATI, fmtDur } from "../lib/themes";
import { ChordSheet, useMetronome } from "./common";

export function DetailModal({ song, members, onPatch, onClose, playing, playPreview }) {
  const [tab, setTab] = useState("info");
  const [editSheet, setEditSheet] = useState(false);
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState(null);
  const [detected, setDetected] = useState(null);
  const metro = useMetronome();
  const taps = useRef([]);
  useEffect(() => () => metro.stop(), []); // eslint-disable-line

  const p = (patch) => onPatch(song, patch);
  const effKey = transposeKeyName(song.tonalita, song.transpose || 0);
  const memberNames = members.map((m) => m.nome);

  const tap = () => {
    const now = performance.now();
    taps.current = taps.current.filter((t) => now - t < 3000);
    taps.current.push(now);
    if (taps.current.length >= 2) {
      const iv = [];
      for (let i = 1; i < taps.current.length; i++) iv.push(taps.current[i] - taps.current[i - 1]);
      p({ bpm: Math.round(60000 / (iv.reduce((a, b) => a + b, 0) / iv.length)) });
    }
  };
  const rileva = () => {
    const chords = extractChords(song.sheet);
    if (!chords.length) return setDetected({ ok: false, msg: "Nessun accordo trovato nel foglio. Inseriscili nella scheda Testo & accordi." });
    const key = detectKeyFromChords(chords);
    if (!key) return setDetected({ ok: false, msg: "Non sono riuscito a stimare la tonalità." });
    setDetected({ ok: true, key, n: chords.length });
  };
  const cerca = async () => {
    const q = `${song.titolo} ${song.artista || ""}`.trim();
    if (!q) return;
    setSearching(true); setSearchErr(null); setResults(null);
    try {
      const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=6`);
      const data = await r.json();
      setResults(data.results || []);
      if (!data.results?.length) setSearchErr("Nessun risultato trovato.");
    } catch {
      setSearchErr("Ricerca non raggiungibile. Usa i link per aprire il brano su YouTube o Spotify.");
    }
    setSearching(false);
  };
  const ytId = useMemo(() => {
    const m = (song.youtube || "").match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
    return m ? m[1] : null;
  }, [song.youtube]);
  const linkQ = encodeURIComponent(`${song.titolo} ${song.artista || ""}`.trim());
  const toggleSa = (nome) =>
    p({ sanno: (song.sanno || []).includes(nome) ? song.sanno.filter((x) => x !== nome) : [...(song.sanno || []), nome] });

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="detail-head">
          {song.artwork && <img className="detail-art" src={song.artwork} alt="" />}
          <div className="detail-titles">
            <input className="detail-title-input" value={song.titolo} onChange={(e) => p({ titolo: e.target.value })} />
            <input className="detail-artist-input" value={song.artista || ""} placeholder="Artista" onChange={(e) => p({ artista: e.target.value })} />
            {(song.album || song.anno) && <div className="detail-album">💿 {song.album}{song.anno ? ` · ${song.anno}` : ""}</div>}
          </div>
          <button className="btn btn-ghost close-x" onClick={onClose}>✕</button>
        </div>

        <div className="tabs tabs-detail">
          {[["info", "Prova"], ["sheet", "Testo & accordi"], ["media", "Ascolta"]].map(([id, l]) => (
            <button key={id} className={"tab" + (tab === id ? " tab-on" : "")} onClick={() => setTab(id)}>{l}</button>
          ))}
        </div>

        {tab === "info" && (
          <div className="detail-body">
            <div className="tool-grid">
              <div className="tool">
                <div className="tool-label">Tonalità originale</div>
                <select value={song.tonalita || ""} onChange={(e) => p({ tonalita: e.target.value })}>
                  <option value="">—</option>
                  {NOTES.flatMap((n) => [n, n + "m"]).map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="tool">
                <div className="tool-label">Transpose</div>
                <div className="stepper">
                  <button className="btn" onClick={() => p({ transpose: (song.transpose || 0) - 1 })}>−</button>
                  <span className="mono stepper-val">{(song.transpose || 0) > 0 ? "+" : ""}{song.transpose || 0} st</span>
                  <button className="btn" onClick={() => p({ transpose: (song.transpose || 0) + 1 })}>+</button>
                  <button className="btn btn-ghost" onClick={() => p({ transpose: 0 })}>Reset</button>
                </div>
                {song.tonalita && <div className="tool-hint">Tonalità effettiva: <b className="mono">{effKey}</b></div>}
              </div>
              <div className="tool">
                <div className="tool-label">BPM</div>
                <div className="stepper">
                  <button className="btn" onClick={() => p({ bpm: Math.max(20, (song.bpm || 120) - 1) })}>−</button>
                  <input className="bpm-input mono" type="number" value={song.bpm || ""} onChange={(e) => p({ bpm: parseInt(e.target.value, 10) || null })} />
                  <button className="btn" onClick={() => p({ bpm: Math.min(300, (song.bpm || 120) + 1) })}>+</button>
                  <button className="btn btn-ghost" onClick={tap}>Tap</button>
                </div>
              </div>
              <div className="tool">
                <div className="tool-label">Metronomo</div>
                <button className={"btn " + (metro.running ? "btn-danger" : "btn-primary")} onClick={() => (metro.running ? metro.stop() : metro.start(song.bpm || 120))}>
                  {metro.running ? "■ Ferma" : `▶ Avvia a ${song.bpm || 120} BPM`}
                </button>
              </div>
              <div className="tool">
                <div className="tool-label">Rileva tonalità</div>
                <button className="btn btn-ghost" onClick={rileva}>Analizza gli accordi del brano</button>
                {detected && (
                  <div className={"tool-hint " + (detected.ok ? "hint-ok" : "hint-warn")}>
                    {detected.ok ? (
                      <>Tonalità stimata: <b className="mono">{detected.key}</b> (da {detected.n} accordi).{" "}
                        {detected.key !== song.tonalita && <button className="link-btn" onClick={() => p({ tonalita: detected.key })}>Usa come tonalità</button>}
                      </>
                    ) : detected.msg}
                  </div>
                )}
              </div>
              <div className="tool">
                <div className="tool-label">Voce principale</div>
                <select value={song.voce || ""} onChange={(e) => p({ voce: e.target.value })}>
                  <option value="">—</option>
                  {members.map((m) => <option key={m.id} value={m.nome}>{m.nome} ({m.ruolo})</option>)}
                </select>
              </div>
              <div className="tool">
                <div className="tool-label">Stato</div>
                <select value={song.stato} onChange={(e) => p({ stato: e.target.value })}>
                  {STATI.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div className="tool">
                <div className="tool-label">Album</div>
                <input value={song.album || ""} onChange={(e) => p({ album: e.target.value })} placeholder="Album" />
              </div>
              <div className="tool">
                <div className="tool-label">Anno di uscita</div>
                <input type="number" value={song.anno || ""} onChange={(e) => p({ anno: parseInt(e.target.value, 10) || null })} placeholder="—" />
              </div>
              <div className="tool">
                <div className="tool-label">Durata</div>
                <div className="stepper">
                  <input className="bpm-input mono" type="number" min="0" placeholder="min" value={song.durata != null ? Math.floor(song.durata / 60) : ""} onChange={(e) => p({ durata: (parseInt(e.target.value, 10) || 0) * 60 + ((song.durata || 0) % 60) })} />
                  <span className="mono">:</span>
                  <input className="bpm-input mono" type="number" min="0" max="59" placeholder="sec" value={song.durata != null ? song.durata % 60 : ""} onChange={(e) => p({ durata: Math.floor((song.durata || 0) / 60) * 60 + (parseInt(e.target.value, 10) || 0) })} />
                </div>
              </div>
            </div>

            <div className="tool tool-full">
              <div className="tool-label">Chi la sa suonare ({(song.sanno || []).length}/{memberNames.length})</div>
              <div className="sanno-row">
                {members.map((m) => (
                  <label key={m.id} className={"sanno-pill" + ((song.sanno || []).includes(m.nome) ? " sanno-on" : "")}>
                    <input type="checkbox" checked={(song.sanno || []).includes(m.nome)} onChange={() => toggleSa(m.nome)} />
                    {m.nome} <em className="member-role">{m.ruolo}</em>
                  </label>
                ))}
              </div>
              {memberNames.length > 0 && (song.sanno || []).length === memberNames.length && song.stato !== "pronta" && (
                <div className="tool-hint hint-ok">Tutti la sanno! Forse è ora di segnarla come pronta 🎉</div>
              )}
            </div>

            <div className="tool tool-full">
              <div className="tool-label">Note di prova</div>
              <textarea rows={3} value={song.note || ""} onChange={(e) => p({ note: e.target.value })} placeholder="Arrangiamento, stacchi, cose da sistemare…" />
            </div>
          </div>
        )}

        {tab === "sheet" && (
          <div className="detail-body">
            <div className="sheet-toolbar">
              <div className="stepper">
                <button className="btn" onClick={() => p({ transpose: (song.transpose || 0) - 1 })}>−</button>
                <span className="mono stepper-val">{(song.transpose || 0) > 0 ? "+" : ""}{song.transpose || 0} st</span>
                <button className="btn" onClick={() => p({ transpose: (song.transpose || 0) + 1 })}>+</button>
              </div>
              {song.tonalita && <span className="chip mono">Tonalità: {effKey}</span>}
              <div style={{ flex: 1 }} />
              <button className="btn btn-ghost" onClick={() => setEditSheet(!editSheet)}>{editSheet ? "✓ Fine modifica" : "✎ Modifica testo"}</button>
            </div>
            {editSheet ? (
              <>
                <textarea className="sheet-editor mono" rows={14} value={song.sheet || ""} onChange={(e) => p({ sheet: e.target.value })}
                  placeholder={"Due formati supportati:\n\n[Am]Testo con accordi [F]inline\n\noppure\n\nAm        F\nRiga di accordi sopra la riga di testo"} />
                <div className="tool-hint">Gli accordi vengono riconosciuti e trasposti automaticamente in visualizzazione.</div>
              </>
            ) : (
              <ChordSheet text={song.sheet} semis={song.transpose || 0} />
            )}
          </div>
        )}

        {tab === "media" && (
          <div className="detail-body">
            <div className="media-row">
              <button className="btn btn-primary" onClick={cerca} disabled={searching}>{searching ? "Ricerca in corso…" : "🔍 Cerca anteprima audio"}</button>
              <a className="btn btn-ghost" href={`https://www.youtube.com/results?search_query=${linkQ}`} target="_blank" rel="noreferrer">Apri su YouTube ↗</a>
              <a className="btn btn-ghost" href={`https://open.spotify.com/search/${linkQ}`} target="_blank" rel="noreferrer">Apri su Spotify ↗</a>
            </div>
            {searchErr && <div className="tool-hint hint-warn">{searchErr}</div>}
            {results?.length > 0 && (
              <div className="results">
                {results.map((r) => (
                  <div key={r.trackId} className="result">
                    <img src={r.artworkUrl60} alt="" />
                    <div className="result-info">
                      <div className="result-t">{r.trackName}</div>
                      <div className="result-a">{r.artistName}</div>
                    </div>
                    <button className="btn btn-ghost" onClick={() => p({ preview: r.previewUrl, artwork: r.artworkUrl100, durata: song.durata || Math.round((r.trackTimeMillis || 0) / 1000) || null })}>
                      Collega al brano
                    </button>
                  </div>
                ))}
              </div>
            )}
            {song.preview && (
              <div className="player-box">
                <div className="tool-label">Anteprima collegata (30 sec)</div>
                <button className="btn btn-primary" onClick={() => playPreview(song)}>{playing === song.id ? "❚❚ Pausa" : "▶ Riproduci anteprima"}</button>
              </div>
            )}
            <div className="tool tool-full" style={{ marginTop: 16 }}>
              <div className="tool-label">Link YouTube (per il video completo)</div>
              <input value={song.youtube || ""} onChange={(e) => p({ youtube: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" />
            </div>
            {ytId && (
              <div className="yt-box">
                <iframe title="YouTube" src={`https://www.youtube.com/embed/${ytId}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
