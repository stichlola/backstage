import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { supabase, configOk } from "./lib/supabase";
import * as db from "./lib/db";
import { THEMES, STATI, statoDi, nextStato, fmtDur } from "./lib/themes";
import { transposeKeyName } from "./lib/musicTheory";
import { Equalizer, Avatar, GoogleG } from "./components/common";
import { AuthScreen, SetupScreen } from "./components/AuthScreen";
import { CreateBandModal, BandSwitcher } from "./components/band";
import { SettingsModal } from "./components/SettingsModal";
import { NewSongModal, SongCard } from "./components/song";
import { DetailModal } from "./components/DetailModal";
import { StageMode } from "./components/StageMode";

export default function App() {
  /* ---------- sessione & profilo ---------- */
  const [session, setSession] = useState(undefined); // undefined = in caricamento
  const [profile, setProfile] = useState(null);
  const [bands, setBands] = useState([]);
  const [currentBandId, setCurrentBandId] = useState(null);
  const [songs, setSongs] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [errMsg, setErrMsg] = useState(null);

  const [vista, setVista] = useState("repertorio");
  const [ricerca, setRicerca] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateBand, setShowCreateBand] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [stageMode, setStageMode] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const dragId = useRef(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  const band = bands.find((b) => b.id === currentBandId) || null;
  const membersById = useMemo(
    () => Object.fromEntries((band?.members || []).map((m) => [m.id, m])),
    [band]
  );
  const membersByName = useMemo(
    () => Object.fromEntries((band?.members || []).map((m) => [m.nome, m])),
    [band]
  );

  /* ---------- auth ---------- */
  useEffect(() => {
    if (!configOk) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const fail = (e) => { console.error(e); setErrMsg(e.message || String(e)); setTimeout(() => setErrMsg(null), 5000); };

  /* ---------- caricamento profilo + band + inviti ---------- */
  const loadAll = useCallback(async (keepBand = true) => {
    if (!session?.user) return;
    setLoadingData(true);
    try {
      const [prof, myBands, myInvites] = await Promise.all([
        db.getProfile(session.user.id),
        db.getMyBands(),
        db.getMyInvites().catch(() => []),
      ]);
      setProfile(prof);
      setBands(myBands);
      setInvites(myInvites);
      setCurrentBandId((cur) => (keepBand && myBands.some((b) => b.id === cur) ? cur : myBands[0]?.id || null));
    } catch (e) { fail(e); }
    setLoadingData(false);
  }, [session]);

  useEffect(() => { if (session?.user) loadAll(false); else { setProfile(null); setBands([]); setSongs([]); setCurrentBandId(null); } }, [session, loadAll]);

  /* ---------- caricamento brani + realtime ---------- */
  const refetchSongs = useCallback(async () => {
    if (!band) { setSongs([]); return; }
    try { setSongs(await db.getSongs(band.id, membersById)); }
    catch (e) { fail(e); }
  }, [band, membersById]);

  useEffect(() => { refetchSongs(); }, [refetchSongs]);

  useEffect(() => {
    if (!band) return;
    let t = null;
    const onChange = () => { clearTimeout(t); t = setTimeout(() => { refetchSongs(); loadAll(); }, 250); };
    const unsub = db.subscribeBand(band.id, onChange);
    return () => { clearTimeout(t); unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [band?.id]);

  /* ---------- player anteprime ---------- */
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(null);
  const playPreview = (song) => {
    if (!song.preview) return;
    if (!audioRef.current) { audioRef.current = new Audio(); audioRef.current.onended = () => setPlaying(null); }
    const a = audioRef.current;
    if (playing === song.id) { a.pause(); setPlaying(null); return; }
    a.src = song.preview;
    a.play().then(() => setPlaying(song.id)).catch(() => setPlaying(null));
  };

  /* ---------- tema utente ---------- */
  const st = profile ? { mode: profile.mode, theme: profile.theme } : { mode: "dark", theme: "neon" };
  const theme = THEMES[st.theme] || THEMES.neon;
  const pal = theme[st.mode];
  const statusColors = theme.status[st.mode];
  const cssVars = {
    "--bg": pal.bg, "--panel": pal.panel, "--card": pal.card, "--text": pal.text,
    "--sub": pal.sub, "--faint": pal.faint, "--border": pal.border, "--chipbg": pal.chip,
    "--grad": pal.grad, "--logograd": pal.logoGrad, "--gradtext": pal.gradText,
    "--ok": statusColors[3], "--fontd": theme.fd, "--fontb": theme.fb, "--r": theme.r + "px",
  };

  /* ---------- azioni: profilo & band (ottimistiche + persistenza) ---------- */
  const patchProfile = (patch) => {
    setProfile((p) => ({ ...p, ...patch }));
    db.updateProfile(session.user.id, patch).catch(fail);
  };
  const patchBand = (patch) => {
    setBands((bs) => bs.map((b) => (b.id === currentBandId ? { ...b, ...patch } : b)));
    db.updateBand(currentBandId, patch).catch(fail);
  };
  const createBand = async (nome, ruolo, extraMembers) => {
    try {
      const id = await db.createBand(nome, ruolo, extraMembers);
      await loadAll(false);
      setCurrentBandId(id);
      setShowCreateBand(false);
    } catch (e) { fail(e); }
  };
  const addMember = async (nome, ruolo) => { try { await db.addMember(currentBandId, nome, ruolo); await loadAll(); } catch (e) { fail(e); } };
  const removeMember = async (memberId) => { try { await db.removeMember(memberId); await loadAll(); } catch (e) { fail(e); } };
  const invite = (email, ruolo) => db.createInvite(currentBandId, email, ruolo);
  const acceptInvite = async (id) => { try { await db.acceptInvite(id); await loadAll(false); } catch (e) { fail(e); } };

  /* ---------- azioni brani (ottimistiche) ---------- */
  const applyLocal = (id, patch) => setSongs((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const patchSong = (song, patch) => {
    applyLocal(song.id, patch);
    if ("sanno" in patch) {
      const before = new Set(song.sanno || []);
      const after = new Set(patch.sanno || []);
      for (const nome of after) if (!before.has(nome) && membersByName[nome]) db.setKnowledge(song.id, membersByName[nome].id, true).catch(fail);
      for (const nome of before) if (!after.has(nome) && membersByName[nome]) db.setKnowledge(song.id, membersByName[nome].id, false).catch(fail);
      const rest = { ...patch }; delete rest.sanno;
      if (Object.keys(rest).length) db.updateSong(song.id, rest).catch(fail);
    } else {
      db.updateSong(song.id, patch).catch(fail);
    }
  };
  const advance = (song) => patchSong(song, { stato: nextStato(song.stato) });
  const togglePriorita = (song) => patchSong(song, { priorita: !song.priorita });
  const toggleSetlist = (song) => {
    const maxOrd = Math.max(0, ...songs.filter((s) => s.inSetlist).map((s) => s.ordine));
    patchSong(song, song.inSetlist ? { inSetlist: false, ordine: 0 } : { inSetlist: true, ordine: maxOrd + 1 });
  };
  const removeSong = (song) => {
    setSongs((ss) => ss.filter((s) => s.id !== song.id));
    if (detailId === song.id) setDetailId(null);
    db.deleteSong(song.id).catch(fail);
  };
  const move = (song, dir) => {
    const list = songs.filter((s) => s.inSetlist).sort((a, b) => a.ordine - b.ordine);
    const i = list.findIndex((s) => s.id === song.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const a = list[i], b = list[j];
    applyLocal(a.id, { ordine: b.ordine });
    applyLocal(b.id, { ordine: a.ordine });
    db.updateSong(a.id, { ordine: b.ordine }).catch(fail);
    db.updateSong(b.id, { ordine: a.ordine }).catch(fail);
  };
  const addSong = async (data) => {
    try {
      await db.insertSong(currentBandId, data);
      setShowNew(false);
      refetchSongs();
    } catch (e) { fail(e); }
  };

  const onDragStart = (e, id) => { dragId.current = id; e.dataTransfer.effectAllowed = "move"; };
  const onDropCol = (statoId) => {
    const s = songs.find((x) => x.id === dragId.current);
    if (s && s.stato !== statoId) patchSong(s, { stato: statoId });
    dragId.current = null; setDragOverCol(null);
  };

  /* ---------- derivati ---------- */
  const filtrate = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter((s) => s.titolo.toLowerCase().includes(q) || (s.artista || "").toLowerCase().includes(q) || (s.voce || "").toLowerCase().includes(q));
  }, [songs, ricerca]);
  const scaletta = useMemo(() => songs.filter((s) => s.inSetlist).sort((a, b) => a.ordine - b.ordine), [songs]);
  const durataScaletta = scaletta.reduce((t, s) => t + (s.durata || 0), 0) + Math.max(0, scaletta.length - 1) * (band?.gapSec || 0);
  const pronte = songs.filter((s) => s.stato === "pronta").length;
  const perc = songs.length ? Math.round((pronte / songs.length) * 100) : 0;
  const detailSong = songs.find((s) => s.id === detailId);
  const isOwner = band && profile && band.ownerId === profile.id;

  /* ================= RENDER ================= */
  if (!configOk) {
    return <div className="app" style={cssVars} data-mode="dark"><SetupScreen colors={statusColors} /></div>;
  }
  if (session === undefined || (session && !profile && !errMsg)) {
    return (
      <div className="app" style={cssVars} data-mode={st.mode}>
        <div className="auth-wrap"><div className="loading-box"><Equalizer colors={statusColors} /><p className="tagline">Caricamento…</p></div></div>
      </div>
    );
  }
  if (!session) {
    return <div className="app" style={cssVars} data-mode={st.mode}><AuthScreen colors={statusColors} /></div>;
  }

  const InvitesBanner = () => invites.length > 0 && (
    <div className="invites-banner">
      {invites.map((inv) => (
        <div key={inv.id} className="invite-row">
          📨 Sei stato invitato in <b>«{inv.bands?.nome || "una band"}»</b> come <b>{inv.ruolo}</b>
          <button className="btn btn-primary" onClick={() => acceptInvite(inv.id)}>Accetta</button>
          <button className="btn btn-ghost" onClick={() => setInvites((xs) => xs.filter((x) => x.id !== inv.id))}>Ignora</button>
        </div>
      ))}
    </div>
  );

  /* senza band */
  if (!band) {
    return (
      <div className="app" style={cssVars} data-mode={st.mode}>
        <div className="auth-wrap">
          <div className="auth-card" style={{ textAlign: "center" }}>
            <Equalizer colors={statusColors} />
            <h1 className="logo" style={{ margin: "10px 0 4px" }}>BACKSTAGE</h1>
            <p className="tagline" style={{ marginBottom: 20 }}>Ciao {profile?.nome}! Non fai ancora parte di nessun backstage.</p>
            <InvitesBanner />
            <button className="btn btn-primary btn-block" onClick={() => setShowCreateBand(true)}>🎸 Crea il tuo primo backstage</button>
            <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={() => supabase.auth.signOut()}>Esci</button>
          </div>
        </div>
        {showCreateBand && <CreateBandModal userName={profile?.nome} onCreate={createBand} onClose={() => setShowCreateBand(false)} />}
      </div>
    );
  }

  return (
    <div className="app" style={cssVars} data-mode={st.mode}>
      {errMsg && <div className="toast-err">⚠ {errMsg}</div>}

      <header className="header">
        <div className="header-left">
          <Equalizer colors={statusColors} />
          <div>
            <h1 className="logo">BACKSTAGE</h1>
            <BandSwitcher bands={bands} currentBandId={currentBandId} onSwitch={setCurrentBandId} onNew={() => setShowCreateBand(true)} />
          </div>
        </div>
        <div className="header-stats">
          <div className="stat"><span className="stat-n mono">{songs.length}</span><span className="stat-l">brani</span></div>
          <div className="stat"><span className="stat-n mono" style={{ color: statusColors[3] }}>{pronte}</span><span className="stat-l">pronti</span></div>
          <div className="stat"><span className="stat-n mono">{fmtDur(durataScaletta)}</span><span className="stat-l">scaletta</span></div>
          <div className="stat stat-bar">
            <div className="progress"><div className="progress-fill" style={{ width: perc + "%" }} /></div>
            <span className="stat-l">{perc}% pronto per il palco</span>
          </div>
          <button className="btn btn-ghost btn-settings" onClick={() => setShowSettings(true)} title="Impostazioni">⚙</button>
          <div className="user-wrap">
            <button className="user-btn" onClick={() => setUserMenu(!userMenu)}>
              <Avatar nome={profile.nome} color={profile.color} />
            </button>
            {userMenu && (
              <div className="user-menu">
                <div className="user-menu-head">
                  <Avatar nome={profile.nome} color={profile.color} size={40} />
                  <div><b>{profile.nome}</b><small>{session.user.email}</small></div>
                </div>
                {session.user.app_metadata?.provider === "google" && <div className="user-provider"><GoogleG /> Accesso con Google</div>}
                <div className="user-provider">🎸 {bands.length} backstage</div>
                <button className="btn btn-ghost btn-block" onClick={() => { setShowSettings(true); setUserMenu(false); }}>⚙ Impostazioni</button>
                <button className="btn btn-ghost btn-block" onClick={() => { setShowCreateBand(true); setUserMenu(false); }}>＋ Nuovo backstage</button>
                <button className="btn btn-danger btn-block" onClick={() => supabase.auth.signOut()}>Esci</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <InvitesBanner />

      <div className="toolbar">
        <div className="tabs">
          <button className={"tab" + (vista === "repertorio" ? " tab-on" : "")} onClick={() => setVista("repertorio")}>Repertorio</button>
          <button className={"tab" + (vista === "scaletta" ? " tab-on" : "")} onClick={() => setVista("scaletta")}>
            Scaletta {scaletta.length > 0 && <span className="tab-badge mono">{scaletta.length}</span>}
          </button>
        </div>
        <input className="search" placeholder="Cerca titolo, artista, voce…" value={ricerca} onChange={(e) => setRicerca(e.target.value)} />
        <button className="btn btn-primary btn-add" onClick={() => setShowNew(true)}>+ Nuovo brano</button>
      </div>

      {vista === "repertorio" && (
        <main className="board">
          {STATI.map((stt, i) => {
            const list = filtrate.filter((s) => s.stato === stt.id).sort((a, b) => (b.priorita ? 1 : 0) - (a.priorita ? 1 : 0));
            return (
              <section key={stt.id} className={"col" + (dragOverCol === stt.id ? " col-over" : "")}
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(stt.id); }}
                onDragLeave={() => setDragOverCol(null)} onDrop={() => onDropCol(stt.id)}
                style={{ "--accent": statusColors[i] }}>
                <header className="col-head">
                  <span className="col-light" />
                  <h2>{stt.label}</h2>
                  <span className="col-count mono">{list.length}</span>
                </header>
                <div className="col-body">
                  {list.map((s) => (
                    <SongCard key={s.id} song={s} colors={statusColors} membersCount={band.members.length}
                      onOpen={(x) => setDetailId(x.id)} onAdvance={advance} onDelete={removeSong}
                      onToggleSetlist={toggleSetlist} onTogglePriorita={togglePriorita}
                      onDragStart={onDragStart} playing={playing} playPreview={playPreview} />
                  ))}
                  {list.length === 0 && <div className="col-empty">{loadingData ? "Caricamento…" : "Trascina qui un brano"}</div>}
                </div>
              </section>
            );
          })}
        </main>
      )}

      {vista === "scaletta" && (
        <main className="setlist">
          <div className="setlist-head">
            <h2 className="setlist-title">Scaletta — {band.nome}</h2>
            <div className="setlist-actions">
              <span className="setlist-meta mono">{scaletta.length} brani · {fmtDur(durataScaletta)} (incl. pause {band.gapSec}s)</span>
              {scaletta.length > 0 && <button className="btn btn-primary" onClick={() => setStageMode(true)}>🎤 Modalità palco</button>}
            </div>
          </div>
          {scaletta.length === 0 && <div className="setlist-empty">La scaletta è vuota. Vai nel repertorio e aggiungi i brani con "+ Scaletta".</div>}
          <ol className="setlist-list">
            {scaletta.map((s, i) => {
              const idx = STATI.findIndex((x) => x.id === s.stato);
              return (
                <li key={s.id} className="setlist-row" style={{ "--accent": statusColors[idx] }}>
                  <span className="setlist-num mono">{String(i + 1).padStart(2, "0")}</span>
                  <div className="setlist-info" onClick={() => setDetailId(s.id)} style={{ cursor: "pointer" }}>
                    <div className="setlist-song">{s.titolo}</div>
                    <div className="setlist-artist">{s.artista} {s.voce && <>· 🎤 {s.voce}</>}</div>
                  </div>
                  <span className="chip mono">{transposeKeyName(s.tonalita, s.transpose || 0) || "—"}</span>
                  <span className="chip mono">{s.bpm ? s.bpm + " BPM" : "—"}</span>
                  <span className="chip mono">{fmtDur(s.durata)}</span>
                  <span className="setlist-stato" style={{ color: statusColors[idx] }}>● {statoDi(s.stato).label}</span>
                  <div className="setlist-btns">
                    <button className="btn btn-ghost" onClick={() => move(s, -1)} disabled={i === 0}>↑</button>
                    <button className="btn btn-ghost" onClick={() => move(s, 1)} disabled={i === scaletta.length - 1}>↓</button>
                    <button className="btn btn-danger" onClick={() => toggleSetlist(s)}>✕</button>
                  </div>
                </li>
              );
            })}
          </ol>
          {scaletta.some((s) => s.stato !== "pronta") && scaletta.length > 0 && (
            <div className="setlist-warn">⚠ Attenzione: in scaletta ci sono brani non ancora pronti.</div>
          )}
        </main>
      )}

      {showNew && <NewSongModal onSave={addSong} onClose={() => setShowNew(false)} />}
      {showCreateBand && <CreateBandModal userName={profile?.nome} onCreate={createBand} onClose={() => setShowCreateBand(false)} />}
      {showSettings && (
        <SettingsModal
          profile={profile} onProfilePatch={patchProfile}
          band={band} onBandPatch={patchBand}
          onAddMember={addMember} onRemoveMember={removeMember}
          onInvite={invite} isOwner={isOwner}
          onClose={() => setShowSettings(false)}
        />
      )}
      {detailSong && <DetailModal song={detailSong} members={band.members} onPatch={patchSong} onClose={() => setDetailId(null)} playing={playing} playPreview={playPreview} />}
      {stageMode && <StageMode scaletta={scaletta} colors={statusColors} onClose={() => setStageMode(false)} />}

      <footer className="footer">
        {profile.nome} · {band.nome} · Sincronizzato in tempo reale con la tua band
      </footer>
    </div>
  );
}
