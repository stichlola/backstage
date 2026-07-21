/* Livello dati: tutte le letture/scritture su Supabase.
   Converte le righe del DB (snake_case) nel formato usato dalla UI
   e viceversa, e gestisce la sottoscrizione realtime della band. */
import { supabase } from "./supabase";

/* ---------- mapping brano: riga DB <-> oggetto app ---------- */
const ROW_TO_APP = {
  preview_url: "preview", artwork_url: "artwork", youtube_url: "youtube",
  in_setlist: "inSetlist", api_id: "apiId",
};
const APP_TO_ROW = Object.fromEntries(Object.entries(ROW_TO_APP).map(([k, v]) => [v, k]));

export function rowToSong(row, membersById) {
  const s = { ...row };
  for (const [col, app] of Object.entries(ROW_TO_APP)) { s[app] = row[col]; delete s[col]; }
  s.sanno = (row.song_knowledge || [])
    .map((k) => membersById[k.member_id]?.nome)
    .filter(Boolean);
  delete s.song_knowledge;
  return s;
}

function patchToRow(patch) {
  const out = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === "sanno") continue; // gestito a parte (song_knowledge)
    out[APP_TO_ROW[k] || k] = v;
  }
  return out;
}

/* ---------- profilo ---------- */
export async function getProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}
export async function updateProfile(userId, patch) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}

/* ---------- band ---------- */
export async function getMyBands() {
  const { data, error } = await supabase
    .from("bands")
    .select("*, band_members(*)")
    .order("created_at");
  if (error) throw error;
  return data.map((b) => ({
    id: b.id, nome: b.nome, gapSec: b.gap_sec, ownerId: b.owner_id,
    members: (b.band_members || []).map((m) => ({ id: m.id, nome: m.nome, ruolo: m.ruolo, userId: m.user_id })),
  }));
}
export async function createBand(nome, ruolo, extraMembers) {
  const { data: bandId, error } = await supabase.rpc("create_band", { _nome: nome, _ruolo: ruolo });
  if (error) throw error;
  if (extraMembers?.length) {
    const { error: e2 } = await supabase.from("band_members")
      .insert(extraMembers.map((m) => ({ band_id: bandId, nome: m.nome, ruolo: m.ruolo })));
    if (e2) throw e2;
  }
  return bandId;
}
export async function updateBand(bandId, patch) {
  const row = {};
  if (patch.nome !== undefined) row.nome = patch.nome;
  if (patch.gapSec !== undefined) row.gap_sec = patch.gapSec;
  const { error } = await supabase.from("bands").update(row).eq("id", bandId);
  if (error) throw error;
}
export async function addMember(bandId, nome, ruolo) {
  const { error } = await supabase.from("band_members").insert({ band_id: bandId, nome, ruolo });
  if (error) throw error;
}
export async function removeMember(memberId) {
  const { error } = await supabase.from("band_members").delete().eq("id", memberId);
  if (error) throw error;
}

/* ---------- inviti ---------- */
export async function createInvite(bandId, email, ruolo) {
  const { error } = await supabase.from("band_invites")
    .insert({ band_id: bandId, email: email.toLowerCase(), ruolo });
  if (error) throw error;
}
export async function getMyInvites(email) {
  // Solo gli inviti destinati alla MIA email: senza questo filtro il
  // proprietario vedrebbe (per via della RLS) anche gli inviti che ha
  // mandato agli altri, come se fossero rivolti a lui.
  const { data, error } = await supabase
    .from("band_invites")
    .select("*, bands(nome)")
    .eq("status", "pending")
    .eq("email", (email || "").toLowerCase());
  if (error) throw error;
  return data;
}
export async function acceptInvite(inviteId) {
  const { error } = await supabase.rpc("accept_invite", { _invite: inviteId });
  if (error) throw error;
}

/* ---------- brani ---------- */
export async function getSongs(bandId, membersById) {
  const { data, error } = await supabase
    .from("songs")
    .select("*, song_knowledge(member_id)")
    .eq("band_id", bandId)
    .order("created_at");
  if (error) throw error;
  return data.map((r) => rowToSong(r, membersById));
}
export async function insertSong(bandId, data) {
  const { data: row, error } = await supabase.from("songs").insert({
    band_id: bandId,
    titolo: data.titolo, artista: data.artista || "", album: data.album || "",
    anno: data.anno ?? null, durata: data.durata ?? null,
    artwork_url: data.artwork ?? null, preview_url: data.preview ?? null,
    api_id: data.apiId ?? null,
  }).select().single();
  if (error) throw error;
  return row.id;
}
export async function updateSong(songId, patch) {
  const row = patchToRow(patch);
  if (Object.keys(row).length === 0) return;
  const { error } = await supabase.from("songs").update(row).eq("id", songId);
  if (error) throw error;
}
export async function deleteSong(songId) {
  const { error } = await supabase.from("songs").delete().eq("id", songId);
  if (error) throw error;
}
export async function setKnowledge(songId, memberId, on) {
  if (on) {
    const { error } = await supabase.from("song_knowledge")
      .upsert({ song_id: songId, member_id: memberId });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("song_knowledge")
      .delete().eq("song_id", songId).eq("member_id", memberId);
    if (error) throw error;
  }
}

/* ---------- realtime ---------- */
/* Alla ricezione di qualunque cambiamento rilevante per la band,
   invoca onChange (l'app rifà il fetch, con debounce): semplice e robusto. */
export function subscribeBand(bandId, onChange) {
  const ch = supabase
    .channel(`band-${bandId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "songs", filter: `band_id=eq.${bandId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "band_members", filter: `band_id=eq.${bandId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "song_knowledge" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "bands", filter: `id=eq.${bandId}` }, onChange)
    .subscribe();
  return () => supabase.removeChannel(ch);
}

/* ============================================================
   v2 — setlist multiple, agenda, file, commenti, attività
   ============================================================ */

/* ---------- setlist ---------- */
export async function getSetlists(bandId) {
  const { data, error } = await supabase
    .from("setlists")
    .select("*, setlist_songs(*)")
    .eq("band_id", bandId)
    .order("created_at");
  if (error) throw error;
  return data.map((s) => ({
    id: s.id, nome: s.nome, data: s.data, luogo: s.luogo, note: s.note,
    archived: s.archived, publicToken: s.public_token,
    rows: (s.setlist_songs || []).sort((a, b) => a.ordine - b.ordine),
  }));
}
export async function createSetlist(bandId, { nome, data = null, luogo = "" }) {
  const { data: row, error } = await supabase.from("setlists")
    .insert({ band_id: bandId, nome, data, luogo }).select().single();
  if (error) throw error;
  return row.id;
}
export async function updateSetlist(id, patch) {
  const { error } = await supabase.from("setlists").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteSetlist(id) {
  const { error } = await supabase.from("setlists").delete().eq("id", id);
  if (error) throw error;
}
export async function duplicateSetlist(bandId, setlist, nuovoNome) {
  const newId = await createSetlist(bandId, { nome: nuovoNome, data: setlist.data, luogo: setlist.luogo });
  if (setlist.rows.length) {
    const { error } = await supabase.from("setlist_songs")
      .insert(setlist.rows.map((r) => ({ setlist_id: newId, song_id: r.song_id, ordine: r.ordine })));
    if (error) throw error;
  }
  return newId;
}
export async function addToSetlist(setlistId, songId, ordine) {
  const { error } = await supabase.from("setlist_songs")
    .upsert({ setlist_id: setlistId, song_id: songId, ordine }, { onConflict: "setlist_id,song_id" });
  if (error) throw error;
}
export async function removeFromSetlist(setlistId, songId) {
  const { error } = await supabase.from("setlist_songs")
    .delete().eq("setlist_id", setlistId).eq("song_id", songId);
  if (error) throw error;
}
export async function setRowOrder(rowId, ordine) {
  const { error } = await supabase.from("setlist_songs").update({ ordine }).eq("id", rowId);
  if (error) throw error;
}
export async function replaceSetlistSongs(setlistId, songIds) {
  const { error: e1 } = await supabase.from("setlist_songs").delete().eq("setlist_id", setlistId);
  if (e1) throw e1;
  if (songIds.length) {
    const { error: e2 } = await supabase.from("setlist_songs")
      .insert(songIds.map((sid, i) => ({ setlist_id: setlistId, song_id: sid, ordine: i + 1 })));
    if (e2) throw e2;
  }
}

/* ---------- file (registrazioni + spartiti) ---------- */
export async function getSongFiles(songId) {
  const { data, error } = await supabase.from("song_files")
    .select("*").eq("song_id", songId).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function uploadSongFile(bandId, songId, file, tipo) {
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const path = `${bandId}/${songId}/${Date.now()}-${safe}`;
  const { error: e1 } = await supabase.storage.from("band-files")
    .upload(path, file, { contentType: file.type || undefined });
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("song_files").insert({
    band_id: bandId, song_id: songId, tipo, nome: file.name,
    path, mime: file.type || "", size: file.size || null,
  });
  if (e2) throw e2;
}
export async function fileUrl(path) {
  const { data, error } = await supabase.storage.from("band-files").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
export async function deleteSongFile(row) {
  await supabase.storage.from("band-files").remove([row.path]);
  const { error } = await supabase.from("song_files").delete().eq("id", row.id);
  if (error) throw error;
}

/* ---------- commenti ---------- */
export async function getComments(songId) {
  const { data, error } = await supabase.from("song_comments")
    .select("*").eq("song_id", songId).order("created_at");
  if (error) throw error;
  return data;
}
export async function addComment(bandId, songId, userId, autore, body, timestampSec = null) {
  const { error } = await supabase.from("song_comments").insert({
    band_id: bandId, song_id: songId, user_id: userId, autore, body, timestamp_sec: timestampSec,
  });
  if (error) throw error;
}
export async function deleteComment(id) {
  const { error } = await supabase.from("song_comments").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- registro attività ---------- */
export async function logActivity(bandId, userId, autore, azione) {
  // fire-and-forget: un log fallito non deve bloccare l'azione principale
  supabase.from("activity_log")
    .insert({ band_id: bandId, user_id: userId, autore, azione })
    .then(({ error }) => error && console.warn("activity log:", error.message));
}
export async function getActivity(bandId, limit = 40) {
  const { data, error } = await supabase.from("activity_log")
    .select("*").eq("band_id", bandId)
    .order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}

/* ---------- scaletta pubblica ---------- */
export async function getPublicSetlist(token) {
  const { data, error } = await supabase.rpc("get_public_setlist", { _token: token });
  if (error) throw error;
  return data; // null se token inesistente
}

/* ---------- realtime v2 ---------- */
export function subscribeBandV2(bandId, onChange) {
  const ch = supabase
    .channel(`band2-${bandId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "setlists", filter: `band_id=eq.${bandId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "setlist_songs" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "song_comments", filter: `band_id=eq.${bandId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "activity_log", filter: `band_id=eq.${bandId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "song_files", filter: `band_id=eq.${bandId}` }, onChange)
    .subscribe();
  return () => supabase.removeChannel(ch);
}

/* ---------- v2.4: gestione scaletta ---------- */
export async function addManyToSetlist(setlistId, entries) {
  if (!entries.length) return;
  const { error } = await supabase.from("setlist_songs")
    .upsert(entries.map((e) => ({ setlist_id: setlistId, ...e })), { onConflict: "setlist_id,song_id" });
  if (error) throw error;
}
export async function reorderSetlist(orderedRowIds) {
  await Promise.all(orderedRowIds.map((rid, i) =>
    supabase.from("setlist_songs").update({ ordine: i + 1 }).eq("id", rid)
      .then(({ error }) => { if (error) throw error; })
  ));
}
