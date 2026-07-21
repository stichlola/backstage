import React, { useState, useMemo, useRef, useEffect } from "react";
import { NOTES, transposeKeyName, extractChords, detectKeyFromChords, suggestCapo, chordProImport } from "../lib/musicTheory";
import { STATI, fmtDur } from "../lib/themes";
import { ChordSheet, useMetronome } from "./common";
import * as db from "../lib/db";
import { useDialog } from "./dialog";

const TAG_PRESET = ["rock", "pop", "lenta", "energica", "ballabile", "apertura", "chiusura", "bis", "acustica", "medley"];

export function DetailModal({ song, members, band, profile, onPatch, onClose, playing, playPreview, onActivity }) {
  const dialog = useDialog();
  const [tab, setTab] = useState("info");
  const [editSheet, setEditSheet] = useState(false);
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState(null);
  const [detected, setDetected] = useState(null);
  const [files, setFiles] = useState(null);          // registrazioni + allegati
  const [fileUrls, setFileUrls] = useState({});      // id -> signed url (audio)
  const [uploading, setUploading] = useState(false);
  const [comments, setComments] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [commentMin, setCommentMin] = useState("");
  const [newTag, setNewTag] = useState("");
  const metro = useMetronome();
  const taps = useRef([]);
  useEffect(() => () => metro.stop(), []); // eslint-disable-line

  /* carica file e commenti all'apertura */
  const loadFiles = () => db.getSongFiles(song.id).then(async (fs) => {
    setFiles(fs);
    const urls = {};
    for (const f of fs.filter((x) => x.tipo === "audio")) {
      try { urls[f.id] = await db.fileUrl(f.path); } catch { /* scaduto */ }
    }
    setFileUrls(urls);
  }).catch(() => setFiles([]));
  const loadComments = () => db.getComments(song.id).then(setComments).catch(() => setComments([]));
  useEffect(() => { loadFiles(); loadComments(); }, [song.id]); // eslint-disable-line

  const upload = async (fileList, tipo) => {
    const file = fileList?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await db.uploadSongFile(band.id, song.id, file, tipo);
      onActivity?.(`ha caricato ${tipo === "audio" ? "una registrazione" : "un allegato"} su «${song.titolo}»`);
      await loadFiles();
    } catch (e) { console.error(e); dialog.alert({ title: "Caricamento fallito", message: e.message }); }
    setUploading(false);
  };
  const rimuoviFile = async (f) => {
    if (!await dialog.confirm({ title: "Eliminare il file?", message: `«${f.nome}» verrà rimosso definitivamente.`, okLabel: "Elimina", danger: true })) return;
    try { await db.deleteSongFile(f); await loadFiles(); } catch (e) { console.error(e); }
  };
  const inviaCommento = async () => {
    const body = newComment.trim();
    if (!body) return;
    let ts = null;
    const m = commentMin.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (m) ts = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    try {
      await db.addComment(band.id, song.id, profile.id, profile.nome, body, ts);
      setNewComment(""); setCommentMin("");
      await loadComments();
    } catch (e) { console.error(e); }
  };
  const toggleTag = (t) => {
    const tags = song.tags || [];
    p({ tags: tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t] });
  };
  const importaChordPro = () => {
    const res = chordProImport(song.sheet || "");
    const patch = { sheet: res.sheet };
    if (res.titolo && !song.apiId) patch.titolo = res.titolo;
    if (res.artista && !song.artista) patch.artista = res.artista;
    p(patch);
  };

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
          {[["info", "Prova"], ["sheet", "Testo & accordi"], ["media", "Ascolta"], ["disc", `Discussione${comments?.length ? ` (${comments.length})` : ""}`]].map(([id, l]) => (
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
                {(() => {
                  const capi = suggestCapo(effKey);
                  return capi.length > 0 && (
                    <div className="tool-hint">
                      🎸 Capo: {capi.map((c, i) => <span key={c.shape}>{i > 0 && " oppure "}<b>{c.capo}° tasto</b> con accordi di <b className="mono">{c.shape}</b></span>)}
                    </div>
                  );
                })()}
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

            <div className="tool tool-full">
              <div className="tool-label">Tag ed etichette</div>
              <div className="sanno-row">
                {[...new Set([...TAG_PRESET, ...(song.tags || [])])].map((t) => (
                  <button key={t} className={"sanno-pill" + ((song.tags || []).includes(t) ? " sanno-on" : "")} onClick={() => toggleTag(t)}>
                    #{t}
                  </button>
                ))}
              </div>
              <div className="stepper" style={{ marginTop: 7 }}>
                <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Nuovo tag…"
                  onKeyDown={(e) => { if (e.key === "Enter" && newTag.trim()) { toggleTag(newTag.trim().toLowerCase().replace(/\s+/g, "-")); setNewTag(""); } }} />
                <button className="btn btn-ghost" onClick={() => { if (newTag.trim()) { toggleTag(newTag.trim().toLowerCase().replace(/\s+/g, "-")); setNewTag(""); } }}>+ Tag</button>
              </div>
            </div>

            <div className="tool tool-full">
              <div className="tool-label">Allegati — spartiti, tab, PDF (visibili anche in modalità palco)</div>
              <div className="file-list">
                {(files || []).filter((f) => f.tipo === "doc").map((f) => (
                  <div key={f.id} className="file-row">
                    <span className="file-name">📄 {f.nome}</span>
                    <button className="btn btn-ghost" onClick={async () => window.open(await db.fileUrl(f.path), "_blank")}>Apri</button>
                    <button className="btn btn-danger" onClick={() => rimuoviFile(f)}>✕</button>
                  </div>
                ))}
                {files && files.filter((f) => f.tipo === "doc").length === 0 && <span className="tool-hint">Nessun allegato.</span>}
              </div>
              <label className="btn btn-ghost file-upload">
                {uploading ? "Caricamento…" : "＋ Carica allegato"}
                <input type="file" accept=".pdf,image/*,.txt" hidden onChange={(e) => { upload(e.target.files, "doc"); e.target.value = ""; }} />
              </label>
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
                  placeholder={"Due formati supportati:\n\n[Am]Testo con accordi [F]inline\n\noppure\n\nAm        F\nRiga di accordi sopra la riga di testo\n\nPuoi anche incollare un file ChordPro e premere il pulsante di conversione."} />
                <div className="stepper" style={{ marginTop: 8 }}>
                  <button className="btn btn-ghost" onClick={importaChordPro} title="Rimuove le direttive {…} di un file ChordPro incollato, tenendo testo e accordi">
                    ⤵ Converti da ChordPro
                  </button>
                  <span className="tool-hint">Gli accordi vengono riconosciuti e trasposti automaticamente in visualizzazione.</span>
                </div>
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

            <div className="tool tool-full" style={{ marginTop: 18 }}>
              <div className="tool-label">🎙 Registrazioni delle prove</div>
              <div className="file-list">
                {(files || []).filter((f) => f.tipo === "audio").map((f) => (
                  <div key={f.id} className="file-row file-audio">
                    <span className="file-name">{f.nome}</span>
                    {fileUrls[f.id] && <audio controls src={fileUrls[f.id]} preload="none" />}
                    <button className="btn btn-danger" onClick={() => rimuoviFile(f)}>✕</button>
                  </div>
                ))}
                {files && files.filter((f) => f.tipo === "audio").length === 0 && (
                  <span className="tool-hint">Nessuna registrazione. Carica l'audio della prova e commentalo con la band nella scheda Discussione (es. "al minuto 1:20 lo stacco è sporco").</span>
                )}
              </div>
              <label className="btn btn-ghost file-upload">
                {uploading ? "Caricamento…" : "＋ Carica registrazione"}
                <input type="file" accept="audio/*" hidden onChange={(e) => { upload(e.target.files, "audio"); e.target.value = ""; }} />
              </label>
            </div>
          </div>
        )}

        {/* ---------- TAB DISCUSSIONE ---------- */}
        {tab === "disc" && (
          <div className="detail-body">
            <div className="comments-list">
              {comments === null && <span className="tool-hint">Caricamento…</span>}
              {comments?.length === 0 && <span className="tool-hint">Nessun commento: le decisioni sul brano restano qui invece di perdersi in chat.</span>}
              {comments?.map((c) => (
                <div key={c.id} className="comment">
                  <div className="comment-head">
                    <b>{c.autore || "Membro"}</b>
                    {c.timestamp_sec != null && <span className="chip mono">⏱ {fmtDur(c.timestamp_sec)}</span>}
                    <small>{new Date(c.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "short" })} {new Date(c.created_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</small>
                    {c.user_id === profile.id && <button className="member-x" onClick={async () => { await db.deleteComment(c.id); loadComments(); }}>✕</button>}
                  </div>
                  <div className="comment-body">{c.body}</div>
                </div>
              ))}
            </div>
            <div className="comment-form">
              <input className="comment-min mono" value={commentMin} onChange={(e) => setCommentMin(e.target.value)} placeholder="min:sec" title="Minutaggio opzionale, es. 1:20" />
              <input className="comment-input" value={newComment} onChange={(e) => setNewComment(e.target.value)}
                placeholder="Scrivi un commento… (es. abbassiamola di un tono?)"
                onKeyDown={(e) => e.key === "Enter" && inviaCommento()} />
              <button className="btn btn-primary" disabled={!newComment.trim()} onClick={inviaCommento}>Invia</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
