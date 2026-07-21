import React, { useState, useRef, useEffect } from "react";
import { searchSongsAPI } from "../lib/api";
import { fmtDur, STATI } from "../lib/themes";
import { transposeKeyName } from "../lib/musicTheory";
import { useDialog } from "./dialog";

export function NewSongModal({ onSave, onClose }) {
  const [step, setStep] = useState("search");
  const [q, setQ] = useState("");
  const [sugg, setSugg] = useState([]);
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(false);
  const [netErr, setNetErr] = useState(false);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const debRef = useRef(null);
  const reqSeq = useRef(0);
  useEffect(() => { ref.current?.focus(); }, [step]);

  useEffect(() => {
    if (step !== "search") return;
    if (debRef.current) clearTimeout(debRef.current);
    const query = q.trim();
    if (query.length < 3) { setSugg([]); setLoading(false); return; }
    setLoading(true);
    debRef.current = setTimeout(async () => {
      const seq = ++reqSeq.current;
      try {
        const res = await searchSongsAPI(query);
        if (seq !== reqSeq.current) return;
        setSugg(res.items);
        setSource(res.source);
        setNetErr(false);
      } catch {
        if (seq !== reqSeq.current) return;
        setNetErr(true); setSugg([]);
      }
      setLoading(false);
    }, 400);
    return () => debRef.current && clearTimeout(debRef.current);
  }, [q, step]);

  const pick = (item) => { setForm({ ...item }); setStep("confirm"); };
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const goManual = () => { setForm({ titolo: q.trim(), artista: "" }); setStep("manual"); };

  const salva = async (data) => {
    if (busy) return;
    setBusy(true);
    try { await onSave(data); } finally { setBusy(false); }
  };
  const conferma = () => form?.titolo?.trim() && salva({
    titolo: form.titolo.trim(), artista: (form.artista || "").trim(),
    album: (form.album || "").trim(), anno: form.anno || null,
    durata: form.durata || null, artwork: form.artwork, preview: form.preview,
    apiId: form.apiId || null,
  });
  const salvaManuale = () => form?.titolo?.trim() && salva({
    titolo: form.titolo.trim(), artista: (form.artista || "").trim(),
    album: "", anno: null, durata: null, artwork: null, preview: null, apiId: null,
  });

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Nuovo brano</h2>

        {step === "search" && (
          <>
            <label className="field">
              <span>Cerca il brano nel catalogo mondiale</span>
              <div className="sugg-input-wrap">
                <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { if (sugg.length > 0) pick(sugg[0]); else if (q.trim()) goManual(); } }}
                  placeholder="Titolo (e artista, per affinare)…" />
                {loading && <span className="sugg-spinner" />}
              </div>
            </label>
            {sugg.length > 0 && (
              <div className="sugg-list">
                {sugg.map((r) => (
                  <button key={r.apiId} className="sugg-item" onClick={() => pick(r)}>
                    {r.artworkSmall ? <img src={r.artworkSmall} alt="" /> : <span className="sugg-noart">♪</span>}
                    <span className="sugg-txt">
                      <b>{r.titolo}</b>
                      <small>{r.artista}{r.album ? ` · ${r.album}` : ""}{r.anno ? ` (${r.anno})` : ""} · {fmtDur(r.durata)}</small>
                    </span>
                    {r.preview && <span className="sugg-play" title="Anteprima disponibile">▶</span>}
                  </button>
                ))}
                <div className="sugg-source">Fonte: {source === "itunes" ? "iTunes Search API" : "MusicBrainz"}</div>
              </div>
            )}
            {!loading && q.trim().length >= 3 && sugg.length === 0 && !netErr && (
              <div className="tool-hint" style={{ marginBottom: 10 }}>Nessun risultato per "{q.trim()}".</div>
            )}
            {q.trim().length > 0 && q.trim().length < 3 && (
              <div className="tool-hint" style={{ marginBottom: 10 }}>Digita almeno 3 caratteri per avviare la ricerca.</div>
            )}
            {netErr && (
              <div className="tool-hint hint-warn" style={{ marginBottom: 10 }}>
                Le API di ricerca non sono raggiungibili: controlla la connessione oppure usa l'inserimento manuale.
              </div>
            )}
            <div className="modal-actions" style={{ justifyContent: "space-between" }}>
              <button className="btn btn-ghost" onClick={goManual}>✎ Inserimento manuale (inediti)</button>
              <button className="btn btn-ghost" onClick={onClose}>Annulla</button>
            </div>
          </>
        )}

        {step === "confirm" && form && (
          <>
            <div className="sugg-picked">
              {form.artwork ? <img src={form.artwork} alt="" /> : <span className="sugg-noart" style={{ width: 46, height: 46, fontSize: 20 }}>♪</span>}
              <div>
                <div className="tool-hint hint-ok">Metadati estratti dall'API — verifica e conferma.</div>
                <div className="tool-hint mono" style={{ fontSize: 11 }}>ID: {form.apiId}{form.preview ? " · anteprima 30s inclusa" : ""}</div>
              </div>
            </div>
            <label className="field"><span>Titolo *</span>
              <input value={form.titolo} onChange={(e) => setF("titolo", e.target.value)} onKeyDown={(e) => e.key === "Enter" && conferma()} />
            </label>
            <label className="field"><span>Artista</span>
              <input value={form.artista} onChange={(e) => setF("artista", e.target.value)} onKeyDown={(e) => e.key === "Enter" && conferma()} />
            </label>
            <div className="field-row">
              <label className="field"><span>Album</span>
                <input value={form.album} onChange={(e) => setF("album", e.target.value)} />
              </label>
              <label className="field" style={{ maxWidth: 110 }}><span>Anno</span>
                <input type="number" value={form.anno || ""} onChange={(e) => setF("anno", parseInt(e.target.value, 10) || null)} />
              </label>
              <label className="field" style={{ maxWidth: 130 }}><span>Durata</span>
                <input className="mono" value={fmtDur(form.durata)} readOnly />
              </label>
            </div>
            <div className="modal-actions" style={{ justifyContent: "space-between" }}>
              <button className="btn btn-ghost" onClick={() => { setStep("search"); setForm(null); }}>← Cambia brano</button>
              <button className="btn btn-primary" disabled={!form.titolo.trim() || busy} onClick={conferma}>
                {busy ? "Aggiunta…" : "✓ Aggiungi al repertorio"}
              </button>
            </div>
          </>
        )}

        {step === "manual" && (
          <>
            <div className="tool-hint" style={{ marginBottom: 12 }}>Per brani inediti o non presenti nei cataloghi.</div>
            <label className="field"><span>Titolo *</span>
              <input ref={ref} value={form?.titolo || ""} onChange={(e) => setF("titolo", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && salvaManuale()} placeholder="Titolo del brano" />
            </label>
            <label className="field"><span>Artista</span>
              <input value={form?.artista || ""} onChange={(e) => setF("artista", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && salvaManuale()} placeholder="Artista o lascia vuoto" />
            </label>
            <div className="modal-actions" style={{ justifyContent: "space-between" }}>
              <button className="btn btn-ghost" onClick={() => { setStep("search"); setForm(null); }}>← Torna alla ricerca</button>
              <button className="btn btn-primary" disabled={!form?.titolo?.trim() || busy} onClick={salvaManuale}>
                {busy ? "Aggiunta…" : "✓ Aggiungi al repertorio"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function SongCard({ song, colors, membersCount, onOpen, onAdvance, onDelete, onTogglePriorita, onDragStart, playing, playPreview }) {
  const dialog = useDialog();
  const chiediElimina = async () => {
    if (await dialog.confirm({
      title: "Eliminare il brano?",
      message: `«${song.titolo}» verrà rimosso dal repertorio, dalle scalette e con lui registrazioni, allegati e commenti.`,
      okLabel: "Elimina", danger: true,
    })) onDelete(song);
  };
  const idx = STATI.findIndex((s) => s.id === song.stato);
  const accent = colors[idx];
  const effKey = transposeKeyName(song.tonalita, song.transpose || 0);
  return (
    <div className={"card" + (song.stato === "pronta" ? " card-ready" : "")} draggable
      onDragStart={(e) => onDragStart(e, song.id)} onClick={() => onOpen(song)} style={{ "--accent": accent }}>
      <div className="card-top">
        <button className={"star" + (song.priorita ? " star-on" : "")} onClick={(e) => { e.stopPropagation(); onTogglePriorita(song); }} title="Priorità">★</button>
        {song.artwork && <img className="card-art" src={song.artwork} alt="" />}
        <div className="card-titles">
          <div className="card-title">{song.titolo}</div>
          <div className="card-artist">{song.artista}{song.anno ? ` · ${song.anno}` : ""}</div>
        </div>
        {song.preview && (
          <button className="play-btn" onClick={(e) => { e.stopPropagation(); playPreview(song); }} title="Anteprima 30s">
            {playing === song.id ? "❚❚" : "▶"}
          </button>
        )}
      </div>
      <div className="card-data">
        <span className="mono chip">{effKey || "—"}{song.transpose ? <em className="tr-badge">{song.transpose > 0 ? "+" : ""}{song.transpose}</em> : null}</span>
        <span className="mono chip">{song.bpm ? song.bpm + " BPM" : "—"}</span>
        <span className="mono chip">{fmtDur(song.durata)}</span>
        {song.voce && <span className="chip">🎤 {song.voce}</span>}
        {(song.tags || []).slice(0, 3).map((t) => <span key={t} className="chip chip-tag">#{t}</span>)}
        {membersCount > 0 && <span className="chip">👥 {(song.sanno || []).length}/{membersCount}</span>}
      </div>
      {song.note && <div className="card-note">{song.note}</div>}
      <div className="card-actions" onClick={(e) => e.stopPropagation()}>
        {song.stato !== "pronta" && <button className="btn btn-advance" onClick={() => onAdvance(song)}>Avanza →</button>}
        <button className="btn btn-danger" onClick={chiediElimina}>✕</button>
      </div>
    </div>
  );
}
