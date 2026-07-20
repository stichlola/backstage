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
export async function getMyInvites() {
  const { data, error } = await supabase
    .from("band_invites")
    .select("*, bands(nome)")
    .eq("status", "pending");
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
