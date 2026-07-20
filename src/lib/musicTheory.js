/* Teoria musicale: trasposizione, riconoscimento accordi, stima tonalità */

export const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_MAP = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#", Cb: "B", Fb: "E" };

export const noteIndex = (n) => { if (!n) return -1; return NOTES.indexOf(FLAT_MAP[n] || n); };
export const transposeNote = (n, s) => { const i = noteIndex(n); return i < 0 ? n : NOTES[(i + s + 1200) % 12]; };

export const CHORD_RE = /^([A-G](?:#|b)?)((?:m(?!aj)|min|maj|dim|aug|sus|add|M|\+|°|ø)?[0-9]*(?:(?:maj|add|sus|no|omit|b|#|\+|-)[0-9]+)*(?:\([^)]*\))?)(?:\/([A-G](?:#|b)?))?$/;

export const isChordToken = (t) => {
  if (!t || t.length > 12) return false;
  return CHORD_RE.test(t.replace(/[.,|]+$/g, ""));
};

export const transposeChordToken = (t, s) => {
  const m = t.match(CHORD_RE);
  if (!m) return t;
  return transposeNote(m[1], s) + (m[2] || "") + (m[3] ? "/" + transposeNote(m[3], s) : "");
};

export const transposeKeyName = (key, s) => {
  if (!key) return key;
  const m = key.match(/^([A-G](?:#|b)?)(m?)$/);
  return m ? transposeNote(m[1], s) + m[2] : key;
};

export const extractChords = (sheet) => {
  if (!sheet) return [];
  const out = [];
  (sheet.match(/\[([^\]\n]{1,10})\]/g) || []).forEach((x) => {
    const c = x.slice(1, -1).trim();
    if (isChordToken(c)) out.push(c);
  });
  sheet.split("\n").forEach((line) => {
    if (line.includes("[")) return;
    const toks = line.trim().split(/\s+/).filter(Boolean);
    if (toks.length && toks.every(isChordToken)) out.push(...toks.map((t) => t.replace(/[.,|]+$/g, "")));
  });
  return out;
};

/* Stima la tonalità dagli accordi (euristica diatonica con bonus su primo/ultimo accordo) */
export const detectKeyFromChords = (chords) => {
  if (!chords.length) return null;
  const parsed = chords.map((c) => {
    const m = c.match(CHORD_RE);
    if (!m) return null;
    const q = m[2] || "";
    return { root: noteIndex(m[1]), minor: /^m(?!aj)/.test(q) || /^min/.test(q), dim: /dim|°|ø/.test(q) };
  }).filter(Boolean);
  if (!parsed.length) return null;
  const MAJOR = [[0, "maj"], [2, "min"], [4, "min"], [5, "maj"], [7, "maj"], [9, "min"], [11, "dim"]];
  const MINOR = [[0, "min"], [2, "dim"], [3, "maj"], [5, "min"], [7, "min"], [8, "maj"], [10, "maj"]];
  let best = null;
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const mode of ["maj", "min"]) {
      const scale = mode === "maj" ? MAJOR : MINOR;
      let score = 0;
      parsed.forEach((ch, i) => {
        const rel = (ch.root - tonic + 12) % 12;
        const hit = scale.find(([d]) => d === rel);
        if (hit) {
          score += 1;
          const q = ch.dim ? "dim" : ch.minor ? "min" : "maj";
          if (q === hit[1]) score += 0.6;
        }
        const isTonic = rel === 0 && (mode === "min") === ch.minor && !ch.dim;
        if (isTonic && i === 0) score += 1.4;
        if (isTonic && i === parsed.length - 1) score += 1.8;
      });
      if (!best || score > best.score) best = { score, label: NOTES[tonic] + (mode === "min" ? "m" : "") };
    }
  }
  return best?.label || null;
};

/* ---------- Suggerimento capotasto ----------
   Data la tonalità effettiva, propone dove mettere il capo per
   suonare con le diteggiature aperte più comode. */
const OPEN_SHAPES_MAJ = ["C", "G", "D", "A", "E"];
const OPEN_SHAPES_MIN = ["Am", "Em", "Dm"];

export function suggestCapo(effKey) {
  if (!effKey) return [];
  const m = effKey.match(/^([A-G](?:#|b)?)(m?)$/);
  if (!m) return [];
  const effIdx = noteIndex(m[1]);
  const minor = m[2] === "m";
  const shapes = minor ? OPEN_SHAPES_MIN : OPEN_SHAPES_MAJ;
  const out = [];
  for (const shape of shapes) {
    const sIdx = noteIndex(shape.replace("m", ""));
    const capo = (effIdx - sIdx + 12) % 12;
    if (capo >= 1 && capo <= 7) out.push({ capo, shape });
  }
  return out.sort((a, b) => a.capo - b.capo).slice(0, 2);
}

/* ---------- Import ChordPro ----------
   Rimuove le direttive {…} tenendo testo e accordi [X], che sono
   già nel formato nativo dell'app. Restituisce anche titolo/artista
   se presenti nelle direttive. */
export function chordProImport(text) {
  let titolo = null, artista = null;
  const lines = [];
  for (const raw of (text || "").split("\n")) {
    const line = raw.trimEnd();
    const dir = line.match(/^\{\s*([a-zA-Z_]+)\s*:?\s*(.*?)\s*\}$/);
    if (dir) {
      const k = dir[1].toLowerCase();
      if (k === "title" || k === "t") titolo = dir[2];
      else if (k === "artist" || k === "subtitle" || k === "st") artista = artista || dir[2];
      else if (k === "comment" || k === "c") lines.push("(" + dir[2] + ")");
      // ogni altra direttiva ({soc},{eoc},{define}…) viene ignorata
      continue;
    }
    lines.push(line);
  }
  return { sheet: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(), titolo, artista };
}
