export function isDuplicateArtistName(artistName, artistList) {
  if (!artistName || !Array.isArray(artistList)) return false;

  const normalized = artistName.trim().toLowerCase();

  return artistList.some((a) => {
    let name = "";
    if (typeof a === "string") {
      name = a;
    } else if (typeof a === "object") {
      name = a.artist_name || a.name || a.displayName || "";
    }
    return name.trim().toLowerCase() === normalized;
  });
}
