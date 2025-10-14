import React from "react";
import {
  SortableContainer,
  SortableElement,
  SortableHandle,
} from "react-sortable-hoc";
import { arrayMoveImmutable } from "array-move";

/* ===================== normalize helpers ===================== */
const normalizeAppleArtistUrl = (input) => {
  if (!input) return "";
  const v = String(input).trim();
  if (/^https?:\/\/music\.apple\.com\//i.test(v)) return v;
  const idMatch = v.match(/(\d{5,})$/);
  const id = idMatch ? idMatch[1] : null;
  return id ? `https://music.apple.com/us/artist/${id}` : "";
};
const normalizeSpotifyArtistUrl = (input) => {
  if (!input) return "";
  const v = String(input).trim();
  if (/^https?:\/\/open\.spotify\.com\/artist\//i.test(v)) return v;
  const uri = v.match(/^spotify:artist:([a-zA-Z0-9]{22})$/);
  if (uri) return `https://open.spotify.com/artist/${uri[1]}`;
  const fromAny = v.match(/([a-zA-Z0-9]{22})(?:[^a-zA-Z0-9]|$)/);
  if (fromAny) return `https://open.spotify.com/artist/${fromAny[1]}`;
  if (/^[a-zA-Z0-9]{22}$/.test(v)) return `https://open.spotify.com/artist/${v}`;
  return "";
};

const getAppleRaw = (a) =>
  a?.artist_apple_url ??
  a?.apple_url ??
  a?.appleMusicId ??
  a?.apple_music_url ??
  "";
const getSpotifyRaw = (a) =>
  a?.artist_spotify_url ?? a?.spotify_url ?? a?.spotifyId ?? a?.spotify ?? "";

/* ====================== link resolution ====================== */
const readUserApple = (u) =>
  u?.apple_music_profile ??
  u?.artist_apple_url ??
  u?.apple_music_url ??
  u?.apple_url ??
  u?.appleMusicId ??
  "";
const readUserSpotify = (u) =>
  u?.spotify_profile ?? u?.artist_spotify_url ?? u?.spotify_url ?? u?.spotifyId ?? "";

async function fetchUserProfileDSP() {
  const token = localStorage.getItem("woss_token");
  if (!token) return { apple: "", spotify: "" };
  try {
    const r = await fetch("http://localhost:4000/api/user/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return { apple: "", spotify: "" };
    const j = await r.json();
    return {
      apple: normalizeAppleArtistUrl(readUserApple(j)),
      spotify: normalizeSpotifyArtistUrl(readUserSpotify(j)),
    };
  } catch {
    return { apple: "", spotify: "" };
  }
}

/** Try multiple API shapes to read release_artists; ignore 404s. */
async function fetchReleaseArtistRows(releaseId) {
  const token = localStorage.getItem("woss_token");
  if (!token || !releaseId) return [];
  const headers = { Authorization: `Bearer ${token}` };
  const tries = [
    `http://localhost:4000/api/user/releases/${releaseId}`, // release detail (often embeds release_artists)
    `http://localhost:4000/api/user/releases/${releaseId}/artists`,
    `http://localhost:4000/api/user/releases/${releaseId}/release-artists`,
    `http://localhost:4000/api/user/releases/${releaseId}/artists-list`,
  ];
  for (const url of tries) {
    try {
      const r = await fetch(url, { headers });
      if (!r.ok) continue;
      const j = await r.json();
      if (Array.isArray(j?.artists)) return j.artists;
      if (Array.isArray(j?.release_artists)) return j.release_artists;
      if (Array.isArray(j?.data)) return j.data;
      if (Array.isArray(j)) return j;
      if (j?.release) {
        const rel = j.release;
        if (Array.isArray(rel.release_artists)) return rel.release_artists;
        if (Array.isArray(rel.artists)) return rel.artists;
        if (Array.isArray(rel.artists_list)) return rel.artists_list;
      }
    } catch {}
  }
  return [];
}

function pickLinkFromRow(row, which) {
  if (!row) return "";
  if (which === "apple") {
    return normalizeAppleArtistUrl(
      row.artist_apple_url ??
        row.apple_music_profile ??
        row.apple_music_url ??
        row.apple_url ??
        ""
    );
  }
  return normalizeSpotifyArtistUrl(
    row.artist_spotify_url ?? row.spotify_profile ?? row.spotify_url ?? row.spotify ?? ""
  );
}

function searchUrl(which, name) {
  return which === "apple"
    ? `https://music.apple.com/us/search?term=${encodeURIComponent(
        name
      )}&entity=musicArtist`
    : `https://open.spotify.com/search/${encodeURIComponent(name)}`;
}

async function resolveArtistLink({
  which,
  artist,
  isMain,
  mainProfile,
  releaseId,
}) {
  const displayName = artist?.displayName || "Unknown";

  // 1) direct on the item
  const direct =
    which === "apple"
      ? normalizeAppleArtistUrl(getAppleRaw(artist))
      : normalizeSpotifyArtistUrl(getSpotifyRaw(artist));
  if (direct) return direct;

  // 2) main artist → users table (prop → /profile)
  if (isMain) {
    const propRaw =
      which === "apple" ? readUserApple(mainProfile) : readUserSpotify(mainProfile);
    const fromProp =
      which === "apple"
        ? normalizeAppleArtistUrl(propRaw)
        : normalizeSpotifyArtistUrl(propRaw);
    if (fromProp) return fromProp;

    const fetched = await fetchUserProfileDSP();
    if (fetched[which]) return fetched[which];
  }

  // 3) release_artists rows (by name)
  const rows = await fetchReleaseArtistRows(releaseId);
  if (rows.length) {
    const key = String(displayName).trim().toLowerCase();
    const row =
      rows.find(
        (r) =>
          String(r.artist_name || r.name || r.display_name || "")
            .trim()
            .toLowerCase() === key
      ) || null;

    const fromRow = pickLinkFromRow(row, which);
    if (fromRow) return fromRow;
  }

  // 4) fallback: search
  return searchUrl(which, displayName);
}

/* ========================= UI bits ========================== */
const pillStyle = {
  width: 38,
  height: 38,
  borderRadius: 10,
  background: "#303847",
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.15)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
};
const iconStyle = { color: "#fff", fontSize: 18 };

const DragHandle = SortableHandle(() => (
  <i
    className="fas fa-bars drag-handle"
    style={{ cursor: "grab", color: "#FFFFFF" }} // white hamburger
    aria-hidden="true"
  />
));

const DSPPills = ({ artist, isMain, mainProfile, releaseId }) => {
  const applePre = normalizeAppleArtistUrl(getAppleRaw(artist));
  const spotiPre = normalizeSpotifyArtistUrl(getSpotifyRaw(artist));

  const onClick = async (e, which) => {
    const hasHref = e.currentTarget?.getAttribute("href");
    if (!hasHref) {
      e.preventDefault();
      const url = await resolveArtistLink({
        which,
        artist,
        isMain,
        mainProfile,
        releaseId,
      });
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className="d-flex align-items-center"
      style={{ gap: 10, position: "relative", zIndex: 3 }}
    >
      <a
        href={applePre || undefined}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => onClick(e, "apple")}
        style={pillStyle}
        title="Open Apple Music"
      >
        <i className="fab fa-apple" style={iconStyle} />
      </a>
      <a
        href={spotiPre || undefined}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => onClick(e, "spotify")}
        style={pillStyle}
        title="Open Spotify"
      >
        <i className="fab fa-spotify" style={iconStyle} />
      </a>
    </div>
  );
};

/* ========= small shared context for persistence ========= */
const __ctx = { releaseId: null, items: [], canPersist: false };

/* =================== Sortable items (secondary only) ================== */
const SortableArtist = SortableElement(
  ({
    artist,
    canDrag,
    toggleMenu,
    activeMenuId,
    handleRemoveArtist,
    releaseId,
    mainProfile,
  }) => (
    <div className="artist-box">
      {/* left */}
      <div className="d-flex align-items-center">
        {canDrag ? (
          <DragHandle />
        ) : (
          <i className="fas fa-bars" style={{ marginRight: 20, color: "#FFFFFF" }} />
        )}
        <div className="d-flex align-items-center">
          <div className="artist-icon">
            <i className="fas fa-user-circle" />
          </div>
          <div className="artist-info">
            <p>{artist.displayName}</p>
          </div>
        </div>
      </div>

      {/* right */}
      <div className={`actions-container ${activeMenuId === artist.id ? "with-overlay" : ""}`}>
        {activeMenuId === artist.id && <div className="overlay" />}

        <div className="me-2">
          <DSPPills
            artist={artist}
            isMain={false}
            mainProfile={mainProfile}
            releaseId={releaseId}
          />
        </div>

        <button
          className={`three-pointer-menu ${activeMenuId === artist.id ? "hidden" : ""}`}
          disabled={activeMenuId === artist.id}
          onClick={(e) => {
            e.stopPropagation();
            toggleMenu(artist.id);
          }}
        >
          <i className="fas fa-ellipsis-v" />
        </button>

        {activeMenuId === artist.id && (
          <div className="artist-actions-menu visible">
            <h3 className="text-white">Options</h3>
            <button
              className="close-button"
              onClick={(e) => {
                e.stopPropagation();
                toggleMenu(null);
              }}
            >
              &times;
            </button>
            <ul>
              <li>
                <button
                  className="action-menu-item"
                  onClick={() => handleRemoveArtist(artist.id)}
                >
                  <i className="fa fa-trash" /> Remove
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
);

/* =================== Inner list: ONLY secondary artists are sortable ================== */
const InnerSortableList = SortableContainer(
  ({ secondaries, canDrag, toggleMenu, activeMenuId, handleRemoveArtist, releaseId, mainProfile, disabled }) => (
    <div>
      {secondaries.map((artist, idx) => (
        <SortableArtist
          key={`artist-${artist.id}`}
          index={idx}          
          artist={artist}
          canDrag={canDrag}
          disabled={disabled || !canDrag}
          toggleMenu={toggleMenu}
          activeMenuId={activeMenuId}
          handleRemoveArtist={handleRemoveArtist}
          releaseId={releaseId}
          mainProfile={mainProfile}
        />
      ))}
    </div>
  )
);

/* =================== Public SortableList (keeps API) ================== */
export const SortableList = ({
  items,
  toggleMenu,
  activeMenuId,
  handleRemoveArtist,
  releaseId,
  mainProfile,
  useDragHandle,      // parent passes !isReadOnly
  onSortEnd,          // parent calls our exported onSortEnd wrapper
}) => {
  const canDrag = !!useDragHandle;
  const main = items?.[0] || null;
  const secondaries = (items || []).slice(1);

  // refresh context for persistence in onSortEnd
  __ctx.releaseId = releaseId || null;
  __ctx.items = items || [];
  __ctx.canPersist = !!useDragHandle;

  return (
    <div className="sortable-container">
      {/* main artist (fixed at top) */}
      <div className="artist-box static d-flex align-items-center justify-content-between">
        {/* left: teal star + avatar + name */}
        <div className="d-flex align-items-center">
          <i
            className="fas fa-star mr-3"
            style={{ color: "#56BCB6" }}
            title="Primary artist"
            aria-label="Primary artist"
          />
          <div className="artist-icon">
            <i className="fas fa-user-circle" />
          </div>
          <div className="artist-info">
            <p>{main?.displayName || "Unnamed Artist"}</p>
          </div>
        </div>

        {/* right: DSP pills + matching star */}
        <div className="d-flex align-items-center" style={{ gap: 15 }}>
          <DSPPills
            artist={main}
            isMain
            mainProfile={mainProfile}
            releaseId={releaseId}
          />
          <i
            className="fas fa-star mr-1"
            style={{ color: "#56BCB6" }}
            title="Primary artist"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* only secondary artists are sortable */}
      <InnerSortableList
        secondaries={secondaries}
        canDrag={canDrag}
        disabled={!canDrag}                 // block dragging when read-only
        toggleMenu={toggleMenu}
        activeMenuId={activeMenuId}
        handleRemoveArtist={handleRemoveArtist}
        releaseId={releaseId}
        mainProfile={mainProfile}
        onSortEnd={onSortEnd}               // forward to parent
        useDragHandle={canDrag}             // only handles start drag in edit mode
        helperClass="drag-helper"
        lockAxis="y"
        distance={canDrag ? 1 : 0}
      />
    </div>
  );
};

/* ======================= sorting helper ====================== */
/** Reorder only the secondary artists; keep main (index 0) fixed. */
function reorderSecondaries(fullList, oldIndex, newIndex) {
  if (!Array.isArray(fullList) || fullList.length < 2) return fullList;
  const main = fullList[0];
  const rest = fullList.slice(1);
  const ordered = arrayMoveImmutable(rest, oldIndex, newIndex); // indices relative to secondaries
  return [main, ...ordered];
}

/** Parent uses: onSortEnd={(p) => onSortEnd(p, setArtists)} */
export const onSortEnd = ({ oldIndex, newIndex }, setArtists) => {
  // 1) Update UI immediately
  setArtists((prev) => reorderSecondaries(prev, oldIndex, newIndex));

  // 2) Persist only in Edit Mode
  try {
    const { releaseId, canPersist, items } = __ctx;
    if (!canPersist || !releaseId || !Array.isArray(items) || items.length === 0) return;

    const nextArr = reorderSecondaries(items, oldIndex, newIndex);
    const names = nextArr
      .map((a) => a?.displayName || a?.name || "")
      .filter(Boolean);

    const token = localStorage.getItem("woss_token");
    if (!token) return;

    fetch(`http://localhost:4000/api/user/releases/${releaseId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        artists_json: JSON.stringify(names),
      }),
    }).catch(() => {});
  } catch {}
};

/* ===== default wrapper for legacy imports ===== */
const ArtistsList = (props) => {
  const { items, ...rest } = props;
  return <SortableList items={items || props.artists} {...rest} />;
};

export default ArtistsList;
