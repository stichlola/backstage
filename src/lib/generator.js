import { transposeKeyName } from "./musicTheory";

/* Generatore intelligente di scaletta:
   - usa solo brani con durata nota, "pronti" (opz. "quasi pronti")
   - alterna BPM alti e bassi per dare dinamica al set
   - evita due brani consecutivi nella stessa tonalità quando possibile
   - si ferma raggiunti i minuti richiesti (pause incluse) */
export function generateSetlist(songs, { minutes, gapSec = 30, includeQuasi = false }) {
  const pool = songs.filter(
    (s) => s.durata && (s.stato === "pronta" || (includeQuasi && s.stato === "quasi_pronta"))
  );
  const sorted = [...pool].sort((a, b) => (a.bpm || 100) - (b.bpm || 100));
  const keyOf = (s) => transposeKeyName(s.tonalita, s.transpose || 0) || null;
  const target = minutes * 60;
  const out = [];
  let total = 0, takeHigh = true, lastKey = null;

  while (sorted.length && total < target) {
    let j = takeHigh ? sorted.length - 1 : 0;
    const dir = takeHigh ? -1 : 1;
    // scorri finché trovi un brano con tonalità diversa dal precedente
    let k = j;
    while (k >= 0 && k < sorted.length && lastKey && keyOf(sorted[k]) === lastKey) k += dir;
    if (k >= 0 && k < sorted.length) j = k;
    const s = sorted.splice(j, 1)[0];
    const add = (s.durata || 0) + (out.length > 0 ? gapSec : 0);
    if (total + add > target * 1.1 && out.length > 0) break; // non sforare oltre il 10%
    out.push(s);
    total += add;
    lastKey = keyOf(s);
    takeHigh = !takeHigh;
  }
  return { songs: out, totalSec: total };
}
