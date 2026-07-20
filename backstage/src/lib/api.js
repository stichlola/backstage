/* Ricerca brani su API gratuite senza chiave:
   iTunes Search (primaria, con anteprime 30s) + MusicBrainz (fallback). */

export async function searchSongsAPI(q) {
  try {
    const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=7`);
    const data = await r.json();
    if (data.results?.length) {
      return {
        source: "itunes",
        items: data.results.map((x) => ({
          apiId: "itunes:" + x.trackId,
          titolo: x.trackName,
          artista: x.artistName,
          album: x.collectionName || "",
          anno: x.releaseDate ? parseInt(x.releaseDate.slice(0, 4), 10) : null,
          durata: x.trackTimeMillis ? Math.round(x.trackTimeMillis / 1000) : null,
          artwork: x.artworkUrl100 || null,
          artworkSmall: x.artworkUrl60 || null,
          preview: x.previewUrl || null,
        })),
      };
    }
  } catch { /* passa al fallback */ }

  const r2 = await fetch(
    `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(q)}&fmt=json&limit=7`,
    { headers: { Accept: "application/json" } }
  );
  const data2 = await r2.json();
  return {
    source: "musicbrainz",
    items: (data2.recordings || []).map((x) => {
      const rel = x.releases?.[0];
      return {
        apiId: "mb:" + x.id,
        titolo: x.title,
        artista: x["artist-credit"]?.map((a) => a.name).join(", ") || "",
        album: rel?.title || "",
        anno: rel?.date ? parseInt(rel.date.slice(0, 4), 10) : null,
        durata: x.length ? Math.round(x.length / 1000) : null,
        artwork: null, artworkSmall: null, preview: null,
      };
    }),
  };
}
