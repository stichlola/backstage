import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { supabase, configOk } from "./lib/supabase";
import * as db from "./lib/db";
import { THEMES, STATI, nextStato, statoDi, fmtDur } from "./lib/themes";
import { Equalizer, Avatar } from "./components/common";
import { AuthScreen, SetupScreen, NewPasswordScreen } from "./components/AuthScreen";
import { CreateBandModal, BandSwitcher } from "./components/band";
import { SettingsModal } from "./components/SettingsModal";
import { NewSongModal, SongCard } from "./components/song";
import { DetailModal } from "./components/DetailModal";
import { StageMode } from "./components/StageMode";
import { SetlistPanel, PrintSheet } from "./components/SetlistPanel";
import { ActivityBell, PublicSetlistPage } from "./components/extras";

/* Root senza hook: smista tra pagina pubblica e app principale */
export default function Root() {
  const token = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("setlist")
    : null;
  if (token && configOk) {
    return (
      <div className="app" data-mode="dark" style={publicVars}>
        <PublicSetlistPage token={token} />
      </div>
    );
  }
  return <MainApp />;
}

const publicVars = {
  "--bg": THEMES.neon.dark.bg, "--panel": THEMES.neon.dark.panel, "--card": THEMES.neon.dark.card,
  "--text": THEMES.neon.dark.text, "--sub": THEMES.neon.dark.sub, "--faint": THEMES.neon.dark.faint,
  "--border": THEMES.neon.dark.border, "--chipbg": THEMES.neon.dark.chip, "--grad": THEMES.neon.dark.grad,
  "--logograd": THEMES.neon.dark.logoGrad, "--gradtext": THEMES.neon.dark.gradText,
  "--ok": "#5CFF9D", "--fontd": THEMES.neon.fd, "--fontb": THEMES.neon.fb, "--r": "13px",
};

function MainApp() {
  const [session, setSession] = useState(undefined);
  const [recovery, setRecovery] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [profile, setProfile] = useState(null);
  const [bands, setBands] = useState([]);
  const [currentBandId, setCurrentBandId] = useState(null);
  const [songs, setSongs] = useState([]);
  const [setlists, setSetlists] = useState([]);
  const [currentSetlistId, setCurrentSetlistId] = useState(null);
  const [activity, setActivity] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [errMsg, setErrMsg] = useState(null);

  const [vista, setVista] = useState("repertorio");
  const [ricerca, setRicerca] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateBand, setShowCreateBand] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [stageMode, setStageMode] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const dragId = useRef(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  const band = bands.find((b) => b.id === currentBandId) || null;
  const membersById = useMemo(() => Object.fromEntries((band?.members || []).map((m) => [m.id, m])), [band]);
  const membersByName = useMemo(() => Object.fromEntries((band?.members || []).map((m) => [m.nome, m])), [band]);

  /* ---------- auth ---------- */
  useEffect(() => {
    if (!configOk) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const on = () => { setOnline(true); refetchBandDataRef.current?.(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  const refetchBandDataRef = useRef(null);

  const fail = (e) => { console.error(e); setErrMsg(e.message || String(e)); setTimeout(() => setErrMsg(null), 5000); };
  const act = (msg) => { if (band && profile) db.logActivity(band.id, profile.id, profile.nome, msg); };
  const readIgnored = () => { try { return JSON.parse(localStorage.getItem("bs-inv-ignored") || "[]"); } catch { return []; } };
  const ignoreInvite = (id) => {
    try { localStorage.setItem("bs-inv-ignored", JSON.stringify([...new Set([...readIgnored(), id])])); } catch { /* incognito */ }
    setInvites((xs) => xs.filter((x) => x.id !== id));
  };

  /* ---------- caricamenti ---------- */
  const loadAll = useCallback(async (keepBand = true) => {
    if (!session?.user) return;
    setLoadingData(true);
    try {
      const [prof, myBands, myInvites] = await Promise.all([
        db.getProfile(session.user.id),
        db.getMyBands(),
        db.getMyInvites(session.user.email).catch(() => []),
      ]);
      setProfile(prof);
      setBands(myBands);
      // escludi gli inviti ignorati in passato e quelli per band di cui faccio già parte
      setInvites(myInvites.filter((i) => !readIgnored().includes(i.id) && !myBands.some((b) => b.id === i.band_id)));
      setCurrentBandId((cur) => (keepBand && myBands.some((b) => b.id === cur) ? cur : myBands[0]?.id || null));
    } catch (e) { fail(e); }
    setLoadingData(false);
  }, [session]);

  useEffect(() => {
    if (session?.user) loadAll(false);
    else { setProfile(null); setBands([]); setSongs([]); setSetlists([]); setActivity([]); setCurrentBandId(null); }
  }, [session, loadAll]);

  const refetchBandData = useCallback(async () => {
    if (!band) { setSongs([]); setSetlists([]); setActivity([]); return; }
    try {
      const [s, sl, ac] = await Promise.all([
        db.getSongs(band.id, membersById),
        db.getSetlists(band.id),
        db.getActivity(band.id),
      ]);
      setSongs(s); setSetlists(sl); setActivity(ac);
      setCurrentSetlistId((cur) => {
        if (sl.some((x) => x.id === cur && !x.archived)) return cur;
        return sl.find((x) => !x.archived)?.id || sl[0]?.id || null;
      });
    } catch (e) { fail(e); }
  }, [band, membersById]);

  useEffect(() => { refetchBandData(); refetchBandDataRef.current = refetchBandData; }, [refetchBandData]);

  /* realtime: qualsiasi cambiamento -> refetch con debounce */
  useEffect(() => {
    if (!band) return;
    let t = null;
    const onChange = () => { clearTimeout(t); t = setTimeout(() => { refetchBandData(); loadAll(); }, 300); };
    const un1 = db.subscribeBand(band.id, onChange);
    const un2 = db.subscribeBandV2(band.id, onChange);
    return () => { clearTimeout(t); un1(); un2(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [band?.id]);

  /* ---------- player ---------- */
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

  /* ---------- tema ---------- */
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

  /* ---------- profilo & band ---------- */
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

  /* ---------- brani ---------- */
  const applyLocal = (id, patch) => setSongs((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const patchSong = (song, patch) => {
    applyLocal(song.id, patch);
    if ("stato" in patch && patch.stato !== song.stato) act(`ha spostato «${song.titolo}» in ${statoDi(patch.stato).label}`);
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
  const removeSong = (song) => {
    setSongs((ss) => ss.filter((s) => s.id !== song.id));
    if (detailId === song.id) setDetailId(null);
    act(`ha eliminato «${song.titolo}»`);
    db.deleteSong(song.id).catch(fail);
  };
  const addSong = async (data) => {
    try {
      await db.insertSong(currentBandId, data);
      act(`ha aggiunto «${data.titolo}» al repertorio`);
      setShowNew(false);
      refetchBandData();
    } catch (e) { fail(e); }
  };

  /* ---------- setlist multiple ---------- */
  const currentSetlist = setlists.find((s) => s.id === currentSetlistId) || null;
  const setlistSongIds = useMemo(() => new Set((currentSetlist?.rows || []).map((r) => r.song_id)), [currentSetlist]);

  const patchSetlistLocal = (id, patch) => setSetlists((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const ensureSetlist = async () => {
    if (currentSetlist) return currentSetlist.id;
    const id = await db.createSetlist(currentBandId, { nome: "Scaletta principale" });
    await refetchBandData();
    setCurrentSetlistId(id);
    return id;
  };
  const onCreateSetlist = async () => {
    const nome = window.prompt("Nome della nuova scaletta:", "Nuova scaletta");
    if (nome === null) return;
    try {
      const id = await db.createSetlist(currentBandId, { nome: nome.trim() || "Nuova scaletta" });
      act(`ha creato la scaletta «${nome.trim() || "Nuova scaletta"}»`);
      await refetchBandData();
      setCurrentSetlistId(id);
    } catch (e) { fail(e); }
  };
  const onUpdateSetlist = (sl, patch) => {
    patchSetlistLocal(sl.id, patch);
    db.updateSetlist(sl.id, patch).catch(fail);
  };
  const onDuplicateSetlist = async (sl) => {
    try {
      const id = await db.duplicateSetlist(currentBandId, sl, sl.nome + " (copia)");
      await refetchBandData();
      setCurrentSetlistId(id);
    } catch (e) { fail(e); }
  };
  const onArchiveSetlist = (sl, flag) => {
    onUpdateSetlist(sl, { archived: flag });
    if (flag && sl.id === currentSetlistId) {
      const next = setlists.find((x) => !x.archived && x.id !== sl.id);
      setCurrentSetlistId(next?.id || null);
    }
  };
  const onDeleteSetlist = async (sl) => {
    try { await db.deleteSetlist(sl.id); await refetchBandData(); } catch (e) { fail(e); }
  };
  const toggleSetlist = async (song) => {
    try {
      const slId = await ensureSetlist();
      const sl = setlists.find((s) => s.id === slId) || currentSetlist;
      if (setlistSongIds.has(song.id)) {
        patchSetlistLocal(slId, { rows: (sl?.rows || []).filter((r) => r.song_id !== song.id) });
        await db.removeFromSetlist(slId, song.id);
        act(`ha tolto «${song.titolo}» dalla scaletta`);
      } else {
        const maxOrd = Math.max(0, ...(sl?.rows || []).map((r) => r.ordine));
        patchSetlistLocal(slId, { rows: [...(sl?.rows || []), { id: "tmp" + song.id, song_id: song.id, ordine: maxOrd + 1, setlist_id: slId }] });
        await db.addToSetlist(slId, song.id, maxOrd + 1);
        act(`ha aggiunto «${song.titolo}» alla scaletta`);
      }
      refetchBandData();
    } catch (e) { fail(e); }
  };
  const onRemoveFromSetlist = (sl, song) => {
    patchSetlistLocal(sl.id, { rows: sl.rows.filter((r) => r.song_id !== song.id) });
    db.removeFromSetlist(sl.id, song.id).then(() => act(`ha tolto «${song.titolo}» dalla scaletta «${sl.nome}»`)).catch(fail);
  };
  const onMoveInSetlist = (sl, i, dir) => {
    const rows = [...sl.rows].sort((a, b) => a.ordine - b.ordine);
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const a = rows[i], b = rows[j];
    patchSetlistLocal(sl.id, {
      rows: sl.rows.map((r) => (r.id === a.id ? { ...r, ordine: b.ordine } : r.id === b.id ? { ...r, ordine: a.ordine } : r)),
    });
    db.setRowOrder(a.id, b.ordine).catch(fail);
    db.setRowOrder(b.id, a.ordine).catch(fail);
  };
  const onGenerate = async (minuti, songIds) => {
    try {
      const nome = `Set ${minuti}' — ${new Date().toLocaleDateString("it-IT", { day: "numeric", month: "short" })}`;
      const id = await db.createSetlist(currentBandId, { nome });
      await db.replaceSetlistSongs(id, songIds);
      act(`ha generato la scaletta «${nome}» (${songIds.length} brani)`);
      await refetchBandData();
      setCurrentSetlistId(id);
    } catch (e) { fail(e); }
  };

  /* ---------- drag & drop ---------- */
  const onDragStart = (e, id) => { dragId.current = id; e.dataTransfer.effectAllowed = "move"; };
  const onDropCol = (statoId) => {
    const s = songs.find((x) => x.id === dragId.current);
    if (s && s.stato !== statoId) patchSong(s, { stato: statoId });
    dragId.current = null; setDragOverCol(null);
  };

  /* ---------- derivati ---------- */
  const allTags = useMemo(() => [...new Set(songs.flatMap((s) => s.tags || []))].sort(), [songs]);
  const songsView = useMemo(() => songs.map((s) => ({ ...s, inSetlist: setlistSongIds.has(s.id) })), [songs, setlistSongIds]);
  const songsById = useMemo(() => Object.fromEntries(songsView.map((s) => [s.id, s])), [songsView]);
  const filtrate = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    return songsView.filter((s) =>
      (!q || s.titolo.toLowerCase().includes(q) || (s.artista || "").toLowerCase().includes(q) || (s.voce || "").toLowerCase().includes(q)) &&
      (!tagFilter || (s.tags || []).includes(tagFilter))
    );
  }, [songsView, ricerca, tagFilter]);
  const scalettaSongs = useMemo(
    () => (currentSetlist?.rows || []).map((r) => songsById[r.song_id]).filter(Boolean),
    [currentSetlist, songsById]
  );
  const durataScaletta = scalettaSongs.reduce((t, s) => t + (s.durata || 0), 0) + Math.max(0, scalettaSongs.length - 1) * (band?.gapSec || 0);
  const pronte = songs.filter((s) => s.stato === "pronta").length;
  const perc = songs.length ? Math.round((pronte / songs.length) * 100) : 0;
  const detailSong = songsView.find((s) => s.id === detailId);
  const isOwner = band && profile && band.ownerId === profile.id;

  /* ================= RENDER ================= */
  if (!configOk) return <div className="app" style={cssVars} data-mode="dark"><SetupScreen colors={statusColors} /></div>;
  if (session === undefined || (session && !profile && !errMsg)) {
    return (
      <div className="app" style={cssVars} data-mode={st.mode}>
        <div className="auth-wrap"><div className="loading-box"><Equalizer colors={statusColors} /><p className="tagline">Caricamento…</p></div></div>
      </div>
    );
  }
  if (!session) return <div className="app" style={cssVars} data-mode={st.mode}><AuthScreen colors={statusColors} /></div>;
  if (recovery) {
    return (
      <div className="app" style={cssVars} data-mode={st.mode}>
        <NewPasswordScreen colors={statusColors} onDone={() => setRecovery(false)} />
      </div>
    );
  }

  const InvitesBanner = () => invites.length > 0 && (
    <div className="invites-banner no-print">
      {invites.map((inv) => (
        <div key={inv.id} className="invite-row">
          📨 Sei stato invitato in <b>«{inv.bands?.nome || "una band"}»</b> come <b>{inv.ruolo}</b>
          <button className="btn btn-primary" onClick={() => acceptInvite(inv.id)}>Accetta</button>
          <button className="btn btn-ghost" onClick={() => ignoreInvite(inv.id)}>Ignora</button>
        </div>
      ))}
    </div>
  );

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
      <div className="no-print">
        {errMsg && <div className="toast-err">⚠ {errMsg}</div>}
        {!online && <div className="offline-banner">📴 Sei offline — consulti gli ultimi dati salvati, le modifiche riprenderanno con la connessione</div>}

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
            <ActivityBell activity={activity} bandId={band.id} />
            <button className="btn btn-ghost btn-settings" onClick={() => setShowSettings(true)} title="Impostazioni">⚙</button>
            <div className="user-wrap">
              <button className="user-btn" onClick={() => setUserMenu(!userMenu)}><Avatar nome={profile.nome} color={profile.color} /></button>
              {userMenu && (
                <div className="user-menu">
                  <div className="user-menu-head">
                    <Avatar nome={profile.nome} color={profile.color} size={40} />
                    <div><b>{profile.nome}</b><small>{session.user.email}</small></div>
                  </div>
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
              Scaletta {scalettaSongs.length > 0 && <span className="tab-badge mono">{scalettaSongs.length}</span>}
            </button>
          </div>
          {vista === "repertorio" && (
            <>
              <input className="search" placeholder="Cerca titolo, artista, voce…" value={ricerca} onChange={(e) => setRicerca(e.target.value)} />
              {allTags.length > 0 && (
                <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} title="Filtra per tag">
                  <option value="">Tutti i tag</option>
                  {allTags.map((t) => <option key={t} value={t}>#{t}</option>)}
                </select>
              )}
            </>
          )}
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
          <SetlistPanel
            band={band} setlists={setlists} currentSetlist={currentSetlist}
            setCurrentSetlistId={setCurrentSetlistId} songsById={songsById} statusColors={statusColors}
            onCreateSetlist={onCreateSetlist} onUpdateSetlist={onUpdateSetlist}
            onDuplicateSetlist={onDuplicateSetlist} onArchiveSetlist={onArchiveSetlist} onDeleteSetlist={onDeleteSetlist}
            onRemoveFromSetlist={onRemoveFromSetlist} onMove={onMoveInSetlist}
            onOpenSong={(s) => setDetailId(s.id)} onStage={() => setStageMode(true)} onGenerate={onGenerate}
          />
        )}

        {showNew && <NewSongModal onSave={addSong} onClose={() => setShowNew(false)} />}
        {showCreateBand && <CreateBandModal userName={profile?.nome} onCreate={createBand} onClose={() => setShowCreateBand(false)} />}
        {showSettings && (
          <SettingsModal profile={profile} onProfilePatch={patchProfile} band={band} onBandPatch={patchBand}
            onAddMember={addMember} onRemoveMember={removeMember} onInvite={invite} isOwner={isOwner}
            onClose={() => setShowSettings(false)} />
        )}
        {detailSong && (
          <DetailModal song={detailSong} members={band.members} band={band} profile={profile}
            onPatch={patchSong} onClose={() => setDetailId(null)} playing={playing} playPreview={playPreview}
            onActivity={act} />
        )}
        {stageMode && <StageMode scaletta={scalettaSongs} colors={statusColors} onClose={() => setStageMode(false)} />}

        <footer className="footer">
          {profile.nome} · {band.nome} · Sincronizzato in tempo reale con la tua band
        </footer>
      </div>

      {/* foglio stampabile: visibile solo con Stampa/PDF */}
      <PrintSheet bandName={band.nome} setlist={currentSetlist} songs={scalettaSongs} gapSec={band.gapSec || 0} />
    </div>
  );
}
