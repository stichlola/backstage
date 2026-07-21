import React, { useState, useMemo } from "react";
import { STATI, statoDi, fmtDur } from "../lib/themes";
import { transposeKeyName } from "../lib/musicTheory";
import { generateSetlist } from "../lib/generator";
import { useDialog } from "./dialog";

/* Foglio stampabile: visibile solo in stampa (media print) */
export function PrintSheet({ bandName, setlist, songs, gapSec }) {
  const tot = songs.reduce((t, s) => t + (s.durata || 0), 0) + Math.max(0, songs.length - 1) * gapSec;
  return (
    <div className="print-sheet">
      <h1>{bandName}</h1>
      <h2>{setlist?.nome}{setlist?.data ? ` — ${setlist.data}` : ""}{setlist?.luogo ? ` · ${setlist.luogo}` : ""}</h2>
      <table>
        <thead><tr><th>#</th><th>Brano</th><th>Ton.</th><th>BPM</th><th>Voce</th><th>Durata</th></tr></thead>
        <tbody>
          {songs.map((s, i) => (
            <tr key={s.id || i}>
              <td>{i + 1}</td>
              <td><b>{s.titolo}</b>{s.artista ? ` — ${s.artista}` : ""}</td>
              <td>{transposeKeyName(s.tonalita, s.transpose || 0) || "—"}</td>
              <td>{s.bpm || "—"}</td>
              <td>{s.voce || "—"}</td>
              <td>{fmtDur(s.durata)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="print-total">{songs.length} brani · {fmtDur(tot)} totali (pause di {gapSec}s incluse)</p>
    </div>
  );
}

/* Modale per aggiungere/togliere brani alla scaletta corrente */
function AddSongsModal({ songs, inSetIds, statusColors, onAdd, onRemove, onClose }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return [...songs]
      .filter((s) => !query || s.titolo.toLowerCase().includes(query) || (s.artista || "").toLowerCase().includes(query))
      .sort((a, b) => a.titolo.localeCompare(b.titolo));
  }, [songs, q]);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Aggiungi brani alla scaletta</h2>
        <label className="field">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca nel repertorio…" />
        </label>
        <div className="addsong-list">
          {list.map((s) => {
            const idx = STATI.findIndex((x) => x.id === s.stato);
            const dentro = inSetIds.has(s.id);
            return (
              <div key={s.id} className={"addsong-row" + (dentro ? " addsong-in" : "")}>
                <span className="col-light" style={{ "--accent": statusColors[idx], flexShrink: 0 }} title={statoDi(s.stato).label} />
                <div className="addsong-info">
                  <b>{s.titolo}</b>
                  <small>{s.artista}{s.durata ? ` · ${fmtDur(s.durata)}` : ""}</small>
                </div>
                {dentro ? (
                  <button className="btn btn-ghost in-setlist" onClick={() => onRemove(s)}>✓ In scaletta</button>
                ) : (
                  <button className="btn btn-ghost" onClick={() => onAdd(s)}>＋ Aggiungi</button>
                )}
              </div>
            );
          })}
          {list.length === 0 && <div className="tool-hint" style={{ padding: 10 }}>Nessun brano trovato.</div>}
        </div>
        <div className="modal-actions"><button className="btn btn-primary" onClick={onClose}>Fatto</button></div>
      </div>
    </div>
  );
}

export function SetlistPanel({
  band, setlists, currentSetlist, setCurrentSetlistId, songsById, statusColors,
  onCreateSetlist, onUpdateSetlist, onDuplicateSetlist, onArchiveSetlist, onDeleteSetlist,
  onRemoveFromSetlist, onReorder, onAddSongs, onOpenSong, onStage, onGenerate,
}) {
  const dialog = useDialog();
  const [showGen, setShowGen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [genMin, setGenMin] = useState(45);
  const [genQuasi, setGenQuasi] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  const active = setlists.filter((s) => !s.archived);
  const archived = setlists.filter((s) => s.archived);
  const sl = currentSetlist;
  const rows = sl ? sl.rows.map((r) => ({ row: r, song: songsById[r.song_id] })).filter((x) => x.song) : [];
  const inSetIds = useMemo(() => new Set(rows.map((x) => x.song.id)), [rows]);
  const gapSec = band.gapSec || 0;
  const tot = rows.reduce((t, x) => t + (x.song.durata || 0), 0) + Math.max(0, rows.length - 1) * gapSec;
  const publicUrl = sl ? `${window.location.origin}${window.location.pathname}?setlist=${sl.publicToken}` : "";

  const nuova = async () => {
    const nome = await dialog.prompt({
      title: "🎵 Nuova scaletta",
      message: "Come vuoi chiamarla? Data e locale li imposti dopo.",
      placeholder: "Es. Live al Bar Sport",
    });
    if (nome === null) return;
    onCreateSetlist(nome.trim() || "Nuova scaletta");
  };
  const elimina = async (s) => {
    if (await dialog.confirm({
      title: "Eliminare la scaletta?",
      message: `«${s.nome}» verrà eliminata definitivamente (i brani del repertorio non vengono toccati).`,
      okLabel: "Elimina", danger: true,
    })) onDeleteSetlist(s);
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch {
      await dialog.alert({ title: "🔗 Link per il fonico", message: "Copia il link qui sotto:", copyText: publicUrl });
    }
  };
  const genera = () => {
    const res = generateSetlist(Object.values(songsById), { minutes: genMin, gapSec, includeQuasi: genQuasi });
    if (!res.songs.length) {
      dialog.alert({ title: "Nessun brano disponibile", message: "Servono brani pronti (con durata impostata) per generare una scaletta." });
      return;
    }
    onGenerate(genMin, res.songs.map((s) => s.id));
    setShowGen(false);
  };

  /* drag & drop: rilascio = inserisci alla posizione del brano su cui sei sopra */
  const drop = (target) => {
    if (dragIdx === null || target === null || dragIdx === target) { setDragIdx(null); setOverIdx(null); return; }
    const ids = rows.map((x) => x.row.id);
    const [moved] = ids.splice(dragIdx, 1);
    ids.splice(target, 0, moved);
    onReorder(sl, ids);
    setDragIdx(null); setOverIdx(null);
  };

  return (
    <main className="setlist">
      <div className="sl-bar">
        <div className="sl-tabs">
          {active.map((s) => (
            <button key={s.id} className={"sl-tab" + (s.id === sl?.id ? " sl-tab-on" : "")} onClick={() => setCurrentSetlistId(s.id)}>
              {s.nome}{s.data ? <small> {s.data}</small> : null}
            </button>
          ))}
          <button className="sl-tab sl-tab-new" onClick={nuova}>＋ Nuova</button>
        </div>
        {archived.length > 0 && (
          <button className="btn btn-ghost" onClick={() => setShowArchived(!showArchived)}>🗄 Archivio ({archived.length})</button>
        )}
      </div>

      {showArchived && archived.length > 0 && (
        <div className="sl-archive">
          {archived.map((s) => (
            <div key={s.id} className="sl-archive-row">
              <span><b>{s.nome}</b> {s.data && <small>· {s.data}</small>} {s.luogo && <small>· {s.luogo}</small>} <small>· {s.rows.length} brani</small></span>
              <span className="setlist-btns">
                <button className="btn btn-ghost" onClick={() => { setCurrentSetlistId(s.id); setShowArchived(false); }}>Apri</button>
                <button className="btn btn-ghost" onClick={() => onArchiveSetlist(s, false)}>Ripristina</button>
                <button className="btn btn-danger" onClick={() => elimina(s)}>✕</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {!sl && <div className="setlist-empty">Nessuna scaletta: creane una con "＋ Nuova".</div>}

      {sl && (
        <>
          <div className="sl-meta">
            <input className="sl-name" value={sl.nome} onChange={(e) => onUpdateSetlist(sl, { nome: e.target.value })} />
            <input type="date" value={sl.data || ""} onChange={(e) => onUpdateSetlist(sl, { data: e.target.value || null })} title="Data del concerto" />
            <input className="sl-place" value={sl.luogo || ""} placeholder="Locale / città" onChange={(e) => onUpdateSetlist(sl, { luogo: e.target.value })} />
            <span className="setlist-meta mono">{rows.length} brani · {fmtDur(tot)} (pause {gapSec}s)</span>
          </div>

          <div className="sl-actions">
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>＋ Aggiungi brani</button>
            {rows.length > 0 && <button className="btn btn-primary" onClick={onStage}>🎤 Modalità palco</button>}
            <button className="btn btn-ghost" onClick={() => setShowGen(true)}>✨ Genera scaletta</button>
            {rows.length > 0 && <button className="btn btn-ghost" onClick={() => window.print()}>🖨 Stampa / PDF</button>}
            <button className="btn btn-ghost" onClick={copyLink}>{copied ? "✓ Copiato!" : "🔗 Link per il fonico"}</button>
            <button className="btn btn-ghost" onClick={() => onDuplicateSetlist(sl)}>⧉ Duplica</button>
            <button className="btn btn-ghost" onClick={() => onArchiveSetlist(sl, true)}>🗄 Archivia</button>
          </div>
          <div className="tool-hint" style={{ marginBottom: 14 }}>
            Trascina i brani per riordinarli · il link per il fonico è di sola lettura, senza account.
          </div>

          {rows.length === 0 && <div className="setlist-empty">Scaletta vuota: premi "＋ Aggiungi brani" per riempirla dal repertorio, oppure ✨ Genera.</div>}

          <ol className="setlist-list">
            {rows.map(({ row, song: s }, i) => {
              const idx = STATI.findIndex((x) => x.id === s.stato);
              return (
                <li key={row.id} draggable
                  onDragStart={(e) => { setDragIdx(i); e.dataTransfer.effectAllowed = "move"; }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (overIdx !== i) setOverIdx(i); }}
                  onDragLeave={() => overIdx === i && setOverIdx(null)}
                  onDrop={(e) => { e.preventDefault(); drop(i); }}
                  onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                  className={"setlist-row" + (dragIdx === i ? " dragging" : "") + (overIdx === i && dragIdx !== null && dragIdx !== i ? " drag-over" : "")}
                  style={{ "--accent": statusColors[idx] }}>
                  <span className="sl-drag-handle" title="Trascina per riordinare">⋮⋮</span>
                  <span className="setlist-num mono">{String(i + 1).padStart(2, "0")}</span>
                  <div className="setlist-info" onClick={() => onOpenSong(s)} style={{ cursor: "pointer" }}>
                    <div className="setlist-song">{s.titolo}</div>
                    <div className="setlist-artist">{s.artista} {s.voce && <>· 🎤 {s.voce}</>}</div>
                  </div>
                  <span className="chip mono">{transposeKeyName(s.tonalita, s.transpose || 0) || "—"}</span>
                  <span className="chip mono">{s.bpm ? s.bpm + " BPM" : "—"}</span>
                  <span className="chip mono">{fmtDur(s.durata)}</span>
                  <span className="setlist-stato" style={{ color: statusColors[idx] }}>● {statoDi(s.stato).label}</span>
                  <button className="btn btn-danger" onClick={() => onRemoveFromSetlist(sl, s)}>✕</button>
                </li>
              );
            })}
          </ol>
          {rows.some(({ song }) => song.stato !== "pronta") && rows.length > 0 && (
            <div className="setlist-warn">⚠ Attenzione: in scaletta ci sono brani non ancora pronti.</div>
          )}
        </>
      )}

      {showAdd && sl && (
        <AddSongsModal songs={Object.values(songsById)} inSetIds={inSetIds} statusColors={statusColors}
          onAdd={(s) => onAddSongs([s.id])} onRemove={(s) => onRemoveFromSetlist(sl, s)} onClose={() => setShowAdd(false)} />
      )}

      {showGen && (
        <div className="modal-bg" onClick={() => setShowGen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">✨ Genera scaletta</h2>
            <div className="tool-hint" style={{ marginBottom: 14 }}>
              Propongo una sequenza di brani pronti alternando BPM alti e bassi
              ed evitando due tonalità uguali di fila. La creo come nuova scaletta,
              così quella attuale resta intatta.
            </div>
            <label className="field"><span>Durata desiderata (minuti)</span>
              <input type="number" min="5" max="240" value={genMin} onChange={(e) => setGenMin(parseInt(e.target.value, 10) || 45)} />
            </label>
            <label className="sanno-pill" style={{ marginBottom: 16 }}>
              <input type="checkbox" checked={genQuasi} onChange={(e) => setGenQuasi(e.target.checked)} />
              Includi anche i brani "quasi pronti"
            </label>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowGen(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={genera}>Genera</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
