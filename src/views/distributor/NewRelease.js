import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import CustomInfoIcon from "components/Icons/CustomInfoIcon";
import axios from "axios";
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Container,
  Row,
  Input,
  Col,
  FormGroup,
  Label,
} from "reactstrap";
import Tracks from "views/distributor/NewRelease/Tracks.js";
import Scheduling from "views/distributor/NewRelease/Scheduling.js";
import Review from "views/distributor/NewRelease/Review.js";
import NewReleaseHeader from "components/Headers/NewReleaseHeader.js";
import CustomSelect from "components/Custom/CustomSelect.js";
import { countryOptions } from "components/Data/countries.js";
import { languageOptions } from "components/Data/languages.js";
import { audioPresentationOptions } from "components/Data/audioPresentations.js";
import { genreOptions } from "components/Data/genres.js";
import { yearOptions } from "components/Data/yearOptions.js";
import { artisttypeOptions } from "components/Data/artistType.js";
import { SortableList, onSortEnd } from "components/Custom/ArtistsList.js";
import ContributorsModal from "components/Custom/ContributorsModal.js";
import ContributorsList from "components/Custom/ContributorsList.js";
import NewReleaseCard from "components/Custom/NewReleaseCard.js";
import ArtistsModal from "components/Custom/ArtistsModal.js";
import useWebsiteConfig from "hooks/useWebsiteConfig";
import "assets/css/reactSelectOverrides.css";
import Select from "react-select";

/* ---------------- helpers ---------------- */
function useCurrentYear() {
  const [currentYear, setCurrentYear] = useState("");
  useEffect(() => setCurrentYear(String(new Date().getFullYear())), []);
  return currentYear;
}

/** Map internal view to URL segment */
const viewToSeg = {
  coreInfo: "core-info",
  tracks: "tracks",
  scheduling: "scheduling",
  review: "review",
};
/** Map URL segment to internal view */
const segToView = {
  "core-info": "coreInfo",
  tracks: "tracks",
  scheduling: "scheduling",
  review: "review",
};

/** Parse route.
 * Supports BOTH:
 *  - NEW (preferred): /app/portal/catalog/<view>/<publicId>[/track/<trackId>]
 *  - OLD:            /app/portal/catalog/core-info/<publicId>[/track/<trackId>][/(tracks|scheduling|review)]
 *  - LEGACY slug:    /app/portal/new-release/:slug[/track/:trackId][/(tracks|scheduling|review)]
 */
function parseRoute(pathname) {
  // 1) New, preferred scheme
  let m = pathname.match(
    /\/app\/portal\/catalog\/(core-info|tracks|scheduling|review)\/([^/]+)(?:\/track\/([^/]+))?\/?$/
  );
  if (m) {
    return {
      scheme: "new",
      publicId: m[2],
      slug: null,
      trackId: m[3] || null,
      view: segToView[m[1]] || "coreInfo",
    };
  }

  // 2) Old scheme where extra view came AFTER the id
  m = pathname.match(
    /\/app\/portal\/catalog\/core-info\/([^/]+)(?:\/track\/([^/]+))?(?:\/(tracks|scheduling|review))?\/?$/
  );
  if (m) {
    const extraSeg = m[3] || "core-info";
    return {
      scheme: "oldAfterId",
      publicId: m[1],
      slug: null,
      trackId: m[2] || null,
      view: segToView[extraSeg] || "coreInfo",
    };
  }

  // 3) Legacy slug scheme
  m = pathname.match(
    /\/app\/portal\/new-release\/([^/]+)(?:\/track\/([^/]+))?(?:\/(tracks|scheduling|review))?\/?$/
  );
  if (m) {
    const extraSeg = m[3] || "core-info";
    return {
      scheme: "legacySlug",
      publicId: null,
      slug: m[1],
      trackId: m[2] || null,
      view: segToView[extraSeg] || "coreInfo",
    };
  }

  // Fallback
  return {
    scheme: null,
    publicId: null,
    slug: null,
    trackId: null,
    view: "coreInfo",
  };
}

function NewRelease() {
  /* ---------- route + navigation helpers ---------- */
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams(); // may have { publicId } or { slug } depending on route
  const parsed = parseRoute(location.pathname);
  // --- API base like other headers ---
  const configBase = useWebsiteConfig();
  const PERM_BASE = React.useMemo(() => {
    const d = String(configBase?.domain || "").replace(/\/$/, "");
    if (d) return d;
    const { protocol, host } = window.location;
    return `${protocol}//${host}`;
  }, [configBase]);

  // Permission gate for creating a draft from blank route
  const [canCreateRelease, setCanCreateRelease] = useState(null); // null=loading, boolean once known
  const effectivePublicId = params.publicId || parsed.publicId || null;
  const effectiveSlug = params.slug || parsed.slug || null;

  /** Always navigate using the NEW scheme for publicId:
   *    /app/portal/catalog/<view>/<publicId>
   * Legacy slug remains in its legacy order:
   *    /app/portal/new-release/:slug[/<view>]
   */
  const navigateTo = useCallback(
    (nextView) => {
      const seg = viewToSeg[nextView] || "core-info";

      if (effectivePublicId) {
        navigate(`/app/portal/catalog/${seg}/${effectivePublicId}`);
        return;
      }

      if (effectiveSlug) {
        if (seg === "core-info") {
          navigate(`/app/portal/new-release/${effectiveSlug}`);
        } else {
          navigate(`/app/portal/new-release/${effectiveSlug}/${seg}`);
        }
      }
    },
    [navigate, effectivePublicId, effectiveSlug]
  );
  

  /* ---------- state ---------- */
  const [view, setView] = useState("coreInfo");
  const [releaseTitle, setReleaseTitle] = useState("");
  const [releaseType, setReleaseType] = useState("Single");
  const [clineYear, setClineYear] = useState("");
  const [plineYear, setPlineYear] = useState("");
  const [gpidType, setGpidType] = useState("EAN");
  const [metadataLanguage, setMetadataLanguage] = useState(null);
  const [audioLanguage, setAudioLanguage] = useState(null);
  const [audioPresentation, setAudioPresentation] = useState(null);
  const [primaryGenre, setPrimaryGenre] = useState(null);
  const [subGenres, setSubGenres] = useState([]);
  const [selectedSubGenre, setSelectedSubGenre] = useState(null);
  const [productReleaseDate, setProductReleaseDate] = useState("");
  const [artists, setArtists] = useState([
    {
      id: 1,
      displayName: "",
      country: "Unknown",
      genre: "Unknown",
      type: "Main Artist",
    },
  ]);
  const [contributors, setContributors] = useState([]);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newArtist, setNewArtist] = useState({
    displayName: "",
    country: "",
    genre: "",
    type: "",
  });
  const [projectName, setProjectName] = useState("");
  const [releaseId, setReleaseId] = useState(null); // numeric DB id
  const [displayTitle, setDisplayTitle] = useState("");
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [releaseImageUrl, setReleaseImageUrl] = useState(null);
  const [gpidCode, setGpidCode] = useState("");
  const [labelCatalogNumber, setLabelCatalogNumber] = useState("");
  const [version, setVersion] = useState("");
  const [metaLanguageCountry, setMetaLanguageCountry] = useState(null);
  const [cLineOwner, setCLineOwner] = useState("");
  const [pLineOwner, setPLineOwner] = useState(" ");
  const [label, setLabel] = useState("");
  const [userProfile, setUserProfile] = useState(null);
  const [isArtistModalOpen, setIsArtistModalOpen] = useState(false);
  const [tracksData, setTracksData] = useState([]);
  const [originalReleaseDate, setOriginalReleaseDate] = useState("");
  const [preorderDate, setPreorderDate] = useState("");
  const [showError, setShowError] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isDistributing, setIsDistributing] = useState(false);
  const [releaseStatus, setReleaseStatus] = useState("Draft");
  const [isReadOnly, setIsReadOnly] = useState(true);
  const [messageType, setMessageType] = useState("warning");
  const [canDelete, setCanDelete] = useState(false);
  const [canDeleteRelease, setCanDeleteRelease] = useState(false);
  const isDraftStatus = (s) => String(s || "").trim().toLowerCase() === "draft";
  const [, setPermDeleteOverride] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // contributors modal
  const [isContributorModalOpen, setIsContributorModalOpen] = useState(false);
  const [newContributor, setNewContributor] = useState({ name: "" });
  const toggleContributorModal = () => setIsContributorModalOpen((prev) => !prev);
  const toggleArtistModal = () => setIsArtistModalOpen(!isArtistModalOpen);

  const primaryGenreMissing = !primaryGenre || primaryGenre.value === "";
  const metadataLanguageMissing =
    !metadataLanguage || metadataLanguage.value === "";
  const metaLanguageCountryMissing =
    !metaLanguageCountry || metaLanguageCountry.value === "";
  const audioLanguageMissing = !audioLanguage || audioLanguage.value === "";
  const audioPresentationMissing =
    !audioPresentation || audioPresentation.value === "";
  const clineYearMissing =
    !clineYear || clineYear === "" || clineYear === "Select C Line Year";
  const plineYearMissing =
    !plineYear || plineYear === "" || plineYear === "Select P Line Year";

  const [, setTracksMissing] = useState(true);
  const [, setTrackCount] = useState(0);

useEffect(() => {
  const isDraft = isDraftStatus(releaseStatus);
  setIsReadOnly(!(isDraft || isEditing));
}, [releaseStatus, isEditing]);

useEffect(() => {
  if (isDraftStatus(releaseStatus)) setIsEditing(false);
}, [releaseStatus]);

  /* ---------- keep view in sync with URL ---------- */
  useEffect(() => {
    const urlView = parsed.view || "coreInfo";
    setView(urlView);
    localStorage.setItem("newReleaseView", urlView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]); // whenever URL changes, sync view

  // When clicking tab buttons
  const handleViewChange = (v) => {
    setView(v);
    localStorage.setItem("newReleaseView", v);
    navigateTo(v);
  };

  /* Clear memory when leaving editor entirely */
  useEffect(() => {
    if (
      !location.pathname.includes("/app/portal/catalog/") &&
      !location.pathname.includes("/app/portal/new-release/")
    ) {
      localStorage.removeItem("newReleaseView");
    }
  }, [location.pathname]);

/* ---------------- resolve releaseId from URL ---------------- */
useEffect(() => {
  const token = localStorage.getItem("woss_token");
  if (!token) return;

  // ⛔ block direct access to blank “new-release” route if no permission
  const isBlankNewReleaseRoute =
    !effectivePublicId && !effectiveSlug &&
    location.pathname.replace(/\/+$/, "") === "/app/portal/new-release";

  // wait until permission is known
  if (isBlankNewReleaseRoute) {
    if (canCreateRelease === null) return;           // still loading → do nothing yet
    if (canCreateRelease === false) {                // no permission → bounce
      navigate("/app/portal/catalog", {
        replace: true,
        state: {
          flash: {
            type: "warning",
            message: "You do not have permission to create a new release.",
          },
        },
      });
      return; // IMPORTANT: stop before resolve()
    }
  }

  const resolve = async () => {
    // Prefer publicId if present
    if (effectivePublicId) {
      try {
        const r = await fetch(
          `http://localhost:4000/api/user/releases/public/${effectivePublicId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (r.ok) {
          const { success, release } = await r.json();
          if (success && release?.id) {
            setReleaseId(Number(release.id));
            localStorage.setItem("currentReleaseId", String(release.id));
            setReleaseStatus(release.status || "Draft");
            setCanDelete(isDraftStatus(release?.status));
            return;
          }
        }

        // Fallback: load all and match client-side
        const all = await fetch(
          "http://localhost:4000/api/user/releases/me",
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (all.ok) {
          const js = await all.json();
          const match =
            js?.releases?.find((x) => x.public_id === effectivePublicId) || null;
          if (match?.id) {
            setReleaseId(Number(match.id));
            localStorage.setItem("currentReleaseId", String(match.id));
            setReleaseStatus(match.status || "Draft");
            setCanDelete(isDraftStatus(match?.status));
            return;
          }
        }

        // Could not resolve
        navigate("/app/portal/catalog", { replace: true });
        return;
      } catch (e) {
        console.error("resolve(publicId) failed", e);
        navigate("/app/portal/catalog", { replace: true });
        return;
      }
    }

    // Legacy slug
    if (effectiveSlug) {
      try {
        const res = await fetch(
          `http://localhost:4000/api/user/releases/slug/${effectiveSlug}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const { success, release } = await res.json();
          if (success && release?.id) {
            setReleaseId(Number(release.id));
            localStorage.setItem("currentReleaseId", String(release.id));
            setReleaseStatus(release.status || "Draft");
            setCanDelete(isDraftStatus(release?.status));
            return;
          }
        }
      } catch (e) {
        console.error("resolve(slug) failed", e);
      }
    }

    // Fallback local storage
    const id = localStorage.getItem("currentReleaseId");
    if (id) {
      setReleaseId(Number(id));
      try {
        // also resolve status so we can decide delete visibility without flashing
        const r = await fetch(
          `http://localhost:4000/api/user/releases/${id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (r.ok) {
          const { success, release } = await r.json();
          if (success && release) {
            setReleaseStatus(release.status || "Draft");
            setCanDelete(isDraftStatus(release?.status));
          }
        }
      } catch (_) {}
    } else {
      navigate("/app/portal/catalog", { replace: true });
    }
  };

  resolve();
}, [
  effectivePublicId,
  effectiveSlug,
  location.pathname,   // add this so the guard sees the URL
  canCreateRelease,    // add this so we wait for the perm result
  navigate
]);


// ✅ Dominant rule: Admin-panel permission OR Draft => can delete
useEffect(() => {
  const allowed =
    Boolean(canDeleteRelease) || isDraftStatus(releaseStatus);
  setCanDelete(allowed);
  setPermDeleteOverride(Boolean(canDeleteRelease));
}, [releaseStatus, canDeleteRelease]);

  
// --- DSP link helpers ---
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
  const uriMatch = v.match(/^spotify:artist:([a-zA-Z0-9]{22})$/);
  if (uriMatch) return `https://open.spotify.com/artist/${uriMatch[1]}`;
  const idFromUrl = v.match(/([a-zA-Z0-9]{22})(?:[^a-zA-Z0-9]|$)/);
  if (idFromUrl) return `https://open.spotify.com/artist/${idFromUrl[1]}`;
  if (/^[a-zA-Z0-9]{22}$/.test(v)) return `https://open.spotify.com/artist/${v}`;
  return "";
};

// helpers to read possible keys from objects
const readUserApple = (u) =>
  u?.apple_music_profile ?? u?.artist_apple_url ?? u?.apple_music_url ?? u?.apple_url ?? u?.appleMusicId ?? "";
const readUserSpotify = (u) =>
  u?.spotify_profile ?? u?.artist_spotify_url ?? u?.spotify_url ?? u?.spotifyId ?? "";

// fetch rows from /releases/:id/artists
async function fetchReleaseArtistRows(releaseId, token) {
  try {
    const r = await fetch(`http://localhost:4000/api/user/releases/${releaseId}/artists`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      console.warn("[DSP] /releases/:id/artists not OK:", r.status);
      return [];
    }
    const j = await r.json();
    const rows = Array.isArray(j?.artists) ? j.artists : [];
    return rows;
  } catch (e) {
    console.warn("[DSP] fetchReleaseArtistRows error:", e);
    return [];
  }
}
const artistCount = artists.length;

// ensure we have DSP fields on the user profile; if not, refetch /profile
const ensureUserDSP = useCallback(async (profile) => {
  if (readUserApple(profile) || readUserSpotify(profile)) return profile;
  const token = localStorage.getItem("woss_token");
  if (!token) return profile;
  try {
    const r = await fetch("http://localhost:4000/api/user/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return profile;
    const j = await r.json();
    return j;
  } catch {
    return profile;
  }
}, []);


// === DSP link hydration (users for main; release_artists for all) ===
useEffect(() => {
  if (!releaseId || artistCount === 0) return;

  (async () => {
    const token = localStorage.getItem("woss_token");
    if (!token) {
      console.warn("[DSP] no token – skip");
      console.groupEnd();
      return;
    }

    // 1) rows in release_artists
    const relRows = await fetchReleaseArtistRows(releaseId, token);
    const relMap = new Map();
    relRows.forEach((row) => {
      const key = String(row.artist_name || row.name || row.display_name || "")
        .trim()
        .toLowerCase();
      if (!key) return;
      relMap.set(key, {
        apple: normalizeAppleArtistUrl(row.artist_apple_url ?? ""),
        spotify: normalizeSpotifyArtistUrl(row.artist_spotify_url ?? ""),
        id: row.id,
      });
    });

    // 2) user's DSP from users table (via /profile)
    const profileWithDSP = await ensureUserDSP(userProfile);
    const mainApple = normalizeAppleArtistUrl(readUserApple(profileWithDSP));
    const mainSpotify = normalizeSpotifyArtistUrl(readUserSpotify(profileWithDSP));

    // 3) merge into artists[]
    setArtists((prev) => {
      let changed = false;
      const next = prev.map((a, idx) => {
        const key = String(a.displayName || "").trim().toLowerCase();
        const fromRel = relMap.get(key) || {};

        const preferredApple   = idx === 0 ? (mainApple   || fromRel.apple   || "") : (fromRel.apple   || "");
        const preferredSpotify = idx === 0 ? (mainSpotify || fromRel.spotify || "") : (fromRel.spotify || "");

        const curApple   = a.artist_apple_url   || a.apple_url   || a.appleMusicId   || a.apple_music_url   || "";
        const curSpotify = a.artist_spotify_url || a.spotify_url || a.spotifyId      || a.spotify           || "";

        if ((!curApple && preferredApple) || (!curSpotify && preferredSpotify)) {
          changed = true;
          return {
            ...a,
            artist_apple_url:   curApple   || preferredApple,
            artist_spotify_url: curSpotify || preferredSpotify,
          };
        }
        return a;
      });
      return changed ? next : prev;
    });

    console.groupEnd();
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [releaseId, artistCount, ensureUserDSP, userProfile]);


// inside NewRelease component
const handleUpdateRelease = async () => {
  if (!releaseId) return;

  // same validations you use for Distribute
  const missing = [];
  if (sectionWarnings.coreInfo) missing.push("Core Info");
  if (sectionWarnings.tracks) missing.push("Tracks");
  if (sectionWarnings.scheduling) missing.push("Scheduling");

  if (missing.length) {
    setErrorMessage(`Please complete: ${missing.join(", ")}`);
    setMessageType("warning");
    setFadeOut(false);
    setShowError(true);
    setTimeout(() => setFadeOut(true), 1500);
    setTimeout(() => setShowError(false), 3000);
    return;
  }

  try {
    const token = localStorage.getItem("woss_token");
    if (!token) throw new Error("Missing token");

    const r = await fetch(`${process.env.REACT_APP_API || "http://localhost:4000"}/api/user/releases/${releaseId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: "Update In Review" }),
      cache: "no-store",
    });

    const data = await r.json();
    if (!r.ok || !data?.success) {
      throw new Error(data?.message || "Failed to update release status");
    }


    // toast
    setErrorMessage("Release Updated!");
    setMessageType("success");
    setFadeOut(false);
    setShowError(true);
    setTimeout(() => setFadeOut(true), 1200);

    // Redirect + hint to refresh catalog
    setTimeout(() => {
      setShowError(false);
      navigate("/app/portal/catalog", {
        replace: true,
        state: {
          flash: { type: "success", message: "Release sent for update review." },
          refreshKey: Date.now(),
        },
      });
    }, 1500);
  } catch (e) {
    console.error("handleUpdateRelease error:", e);
    setErrorMessage(e.message || "Failed to update release.");
    setMessageType("danger");
    setFadeOut(false);
    setShowError(true);
    setTimeout(() => setFadeOut(true), 1500);
    setTimeout(() => setShowError(false), 3000);
  }
};

  /* ---------- distributor suffix auto-fill ---------- */
  useEffect(() => {
    if (userProfile?.role === "Distributor") {
      const woss = " / Distributed by Woss Music, LLC";
      const labelSuf = ` / Distributed by ${userProfile?.label}, a division of Woss Music, LLC`;

      setCLineOwner((prev) => {
        const base = prev.replace(woss, "").replace(labelSuf, "");
        return userProfile?.label === "Woss Music" ? `${base}${woss}` : `${base}${labelSuf}`;
      });

      setPLineOwner((prev) => {
        const base = prev.replace(woss, "").replace(labelSuf, "");
        return userProfile?.label === "Woss Music" ? `${base}${woss}` : `${base}${labelSuf}`;
      });
    }
  }, [userProfile?.label, userProfile?.role]);

  /* ---------------- distribute ---------------- */
  const [sectionWarnings, setSectionWarnings] = useState({
    coreInfo: false,
    releaseConfig: false,
    genreLanguage: false,
    releaseTitle: false,
    legalNotices: false,
    releaseContributors: false,
    tracks: false,
    scheduling: false,
    details: false,
  });

  const rolesRequiringRoleType = new Set(["Composer", "Producer", "Vocals"]);

  const contributorsMissing =
    releaseType === "Single" &&
    (contributors.length === 0 ||
      contributors.some((c) => {
        const needsRoleType = rolesRequiringRoleType.has(c?.role);
        return !c?.category || !c?.role || (needsRoleType && !c?.roleType);
      }));

  const [schedulingWarnings, setSchedulingWarnings] = useState({
    originalReleaseDate: false,
    preorderDate: false,
    productReleaseDate: false,
  });

  useEffect(() => {
    const coreMissing =
      !releaseTitle ||
      !displayTitle ||
      !gpidType ||
      primaryGenreMissing ||
      metadataLanguageMissing ||
      metaLanguageCountryMissing ||
      audioLanguageMissing ||
      audioPresentationMissing ||
      (releaseType === "Single" && contributorsMissing) ||
      clineYearMissing ||
      plineYearMissing;

    setSectionWarnings((p) => ({
      ...p,
      coreInfo: coreMissing,
      releaseContributors: releaseType === "Single" && contributorsMissing,
      legalNotices: clineYearMissing || plineYearMissing,
    }));
  }, [
    releaseTitle,
    displayTitle,
    gpidType,
    primaryGenreMissing,
    metadataLanguageMissing,
    metaLanguageCountryMissing,
    audioLanguageMissing,
    audioPresentationMissing,
    contributorsMissing,
    clineYearMissing,
    plineYearMissing,
    releaseType,
  ]);

  useEffect(() => {
    setSectionWarnings((p) => ({
      ...p,
      releaseConfig: !releaseType || !projectName || !label,
    }));
  }, [releaseType, projectName, label]);

  useEffect(() => {
    setSectionWarnings((p) => ({
      ...p,
      genreLanguage:
        primaryGenreMissing ||
        metadataLanguageMissing ||
        metaLanguageCountryMissing ||
        audioLanguageMissing ||
        audioPresentationMissing,
    }));
  }, [
    primaryGenreMissing,
    metadataLanguageMissing,
    metaLanguageCountryMissing,
    audioLanguageMissing,
    audioPresentationMissing,
  ]);

  useEffect(() => {
    setSectionWarnings((p) => ({ ...p, releaseTitle: !releaseTitle || !displayTitle }));
  }, [releaseTitle, displayTitle]);

  /* ---------- tracks count for warnings ---------- */
  useEffect(() => {
    const token = localStorage.getItem("woss_token");
    if (!token || !releaseId) return;

    const go = async () => {
      try {
        const res = await fetch(
          `http://localhost:4000/api/user/releases/${releaseId}/tracks-count`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const { count = 0 } = await res.json();
        setTracksMissing(count === 0);
        setSectionWarnings((p) => ({ ...p, tracks: count === 0 }));
      } catch (e) {
        console.error("tracks-count error", e);
        setTracksMissing(true);
        setSectionWarnings((p) => ({ ...p, tracks: true }));
      }
    };

    go();
  }, [releaseId]);

  /* ---------- load tracks to validate fields ---------- */
  const fetchTracksData = useCallback(async () => {
    const token = localStorage.getItem("woss_token");
    if (!token || !releaseId) {
      setSectionWarnings((p) => ({ ...p, tracks: true }));
      return;
    }
    try {
      const res = await fetch(
        `http://localhost:4000/api/user/releases/${releaseId}/tracks`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!data.success || !data.tracks) {
        setSectionWarnings((p) => ({ ...p, tracks: true }));
        return;
      }
      const hasInvalid = data.tracks.some((file) => {
        const artists = JSON.parse(file.track_artists_json || "[]");
        const contribs = JSON.parse(file.track_contributors_json || "[]");
        return (
          !file.track_title ||
          !file.track_isrc?.trim() ||
          artists.length === 0 ||
          contribs.length === 0 ||
          !file.track_parental ||
          !file.track_recording_country?.trim() ||
          !file.track_type?.trim() ||
          !file.track_primary_genre ||
          !file.track_metadata_language ||
          !file.track_metadata_country ||
          !file.track_audio_language ||
          !file.track_p_line_year ||
          !file.track_publisher_name ||
          !file.track_work_title
        );
      });
      const isWarn = data.tracks.length === 0 || hasInvalid;
      setSectionWarnings((p) => ({ ...p, tracks: isWarn }));
    } catch (e) {
      console.error("fetchTracksData error:", e);
      setSectionWarnings((p) => ({ ...p, tracks: false }));
    }
  }, [releaseId]);

  useEffect(() => {
    fetchTracksData();
  }, [fetchTracksData]);

  const refreshTracksData = async () => {
    const token = localStorage.getItem("woss_token");
    const res = await fetch(
      `http://localhost:4000/api/user/releases/${releaseId}/tracks`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (data.success) setTracksData(data.tracks);
  };

  /* ---------- scheduling warnings ---------- */
  useEffect(() => {
    const warn =
      !originalReleaseDate?.trim() ||
      !preorderDate?.trim() ||
      !productReleaseDate?.trim();
    setSectionWarnings((p) => ({ ...p, scheduling: warn }));
  }, [originalReleaseDate, preorderDate, productReleaseDate]);

  /* ---------- load date fields ---------- */
  useEffect(() => {
    const token = localStorage.getItem("woss_token");
    if (!token || !releaseId) return;

    const run = async () => {
      try {
        const res = await fetch(
          `http://localhost:4000/api/user/releases/${releaseId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (data.success) {
          const r = data.release;
          setOriginalReleaseDate(r.original_release_date?.slice(0, 10) || "");
          setPreorderDate(r.preorder_date?.slice(0, 10) || "");
          setProductReleaseDate(r.product_release_date?.slice(0, 10) || "");
        }
      } catch (e) {
        console.error("date fields fetch error:", e);
      }
    };
    run();
  }, [releaseId]);

  /* ---------- artists sync helpers (unchanged) ---------- */
  async function updateReleaseArtistsFromTracks() {
    const token = localStorage.getItem("woss_token");
    try {
      const res = await fetch(
        `http://localhost:4000/api/user/releases/${releaseId}/tracks`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!data.success || !Array.isArray(data.tracks)) return;

      const names = new Set();
      data.tracks.forEach((t) => {
        try {
          const arr = JSON.parse(t.track_artists_json || "[]");
          arr.forEach((a) => a?.name?.trim() && names.add(a.name.trim()));
        } catch {}
      });

      await fetch(
        `http://localhost:4000/api/user/releases/${releaseId}/artists-json`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ artistNames: Array.from(names) }),
        }
      );
    } catch (e) {
      console.error("updateReleaseArtistsFromTracks error:", e);
    }
  }

  useEffect(() => {
    const fetchArtistsByReleaseType = async () => {
      if (!releaseId || !releaseType || !isDataLoaded) return;
      const token = localStorage.getItem("woss_token");
      if (!token) return;

      try {
        if (releaseType === "Single") {
          const res = await fetch(
            `http://localhost:4000/api/user/releases/${releaseId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const data = await res.json();
          if (data.success && data.release?.artists_json) {
            const parsedA = JSON.parse(data.release.artists_json);
            setArtists(parsedA.map((n, i) => ({ id: i, displayName: n })));
          } else {
            setArtists([]);
          }
        } else {
          const res = await fetch(
            `http://localhost:4000/api/user/releases/${releaseId}/tracks`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const data = await res.json();
          if (data.success && Array.isArray(data.tracks)) {
            const set = new Set();
            data.tracks.forEach((t) => {
              try {
                const parsed = JSON.parse(t.artists_json || "[]");
                parsed.forEach((name) => set.add(name));
              } catch {}
            });
            setArtists(Array.from(set).map((n, i) => ({ id: i, displayName: n })));
          } else {
            setArtists([]);
          }
        }
      } catch (e) {
        console.error("fetch artist data error:", e);
        setArtists([]);
      }
    };

    fetchArtistsByReleaseType();
  }, [releaseId, releaseType, isDataLoaded]);

  async function syncArtistsJson(releaseId, updatedArtistsJson) {
    const token = localStorage.getItem("woss_token");
    try {
      await fetch(`http://localhost:4000/api/user/releases/${releaseId}/artists-json`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          artistNames: updatedArtistsJson.map((a) => a.name || a),
        }),
      });

      const response = await fetch(
        `http://localhost:4000/api/user/releases/${releaseId}/tracks`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      if (!data.success || !Array.isArray(data.tracks)) return;

      const formatted = updatedArtistsJson.map((n) =>
        typeof n === "string" ? { name: n } : n
      );

      await Promise.all(
        data.tracks.map((t) =>
          fetch(`http://localhost:4000/api/user/tracks/${t.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              track_artists_json: JSON.stringify(formatted),
            }),
          })
        )
      );
    } catch (e) {
      console.error("syncArtistsJson error:", e);
    }
  }

useEffect(() => {
  const syncArtistsToTrack = async () => {
    if (releaseType !== "Single" || !releaseId || artists.length === 0) return;

    const token = localStorage.getItem("woss_token");
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    try {
      // get tracks for this release
      const res = await fetch(
        `http://localhost:4000/api/user/releases/${releaseId}/tracks`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!data.success || !Array.isArray(data.tracks)) return;

      // names for artists_json + object list for track_artists_json
      const artistNames = artists.map((a) => a.displayName);
      const formattedTrackArtists = artistNames.map((n) => ({ name: n }));

      await Promise.all(
        data.tracks.map((t) =>
          fetch(`http://localhost:4000/api/user/tracks/${t.id}`, {
            method: "PUT",
            headers,
            body: JSON.stringify({
              artists_json: JSON.stringify(artistNames),
              track_artists_json: JSON.stringify(formattedTrackArtists),
            }),
          }).catch(() => {})
        )
      );
    } catch (e) {
      console.error("sync artists to tracks error:", e);
    }
  };

  syncArtistsToTrack();
}, [releaseType, artists, releaseId]);




  /* ---------- delete release ---------- */
  const handleDeleteRelease = async () => {
    if (!window.confirm("Are you sure you want to delete this release? This action cannot be undone.")) return;
    try {
      const token = localStorage.getItem("woss_token");
      const id = localStorage.getItem("currentReleaseId");
      const res = await fetch(`http://localhost:4000/api/user/releases/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        localStorage.removeItem("currentReleaseId");
        navigate("/app/portal/catalog");
      } else {
        alert("Failed to delete the release. Please try again.");
      }
    } catch (e) {
      console.error("delete release error:", e);
      alert("An error occurred while deleting the release.");
    }
  };

  /* ---------- artists modal helpers ---------- */
  const addArtistToList = async (artist) => {
    const newA = { id: artist.id, displayName: artist.artist_name };
    const updated = [...artists, newA].filter(
      (a, idx, self) =>
        idx === self.findIndex((x) => x.displayName === a.displayName)
    );
    setArtists(updated);

    try {
      const token = localStorage.getItem("woss_token");
      if (!token || !releaseId) return;
      const artistNames = updated.map((a) => a.displayName);
      if (releaseType === "Single") {
        await fetch(
          `http://localhost:4000/api/user/releases/${releaseId}/artists-json`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ artistNames }),
          }
        );
      }
    } catch (e) {
      console.error("sync added artist error:", e);
    }
  };

  const openCreateArtistModal = () => {
    toggleArtistModal();
    toggleModal();
  };

/* ---------- profile / project ---------- */
useEffect(() => {
  const fetchProjectName = async () => {
    try {
      const token = localStorage.getItem("woss_token");
      if (!token) return;

      const { data } = await axios.get(
        "http://localhost:4000/api/auth/profile/me",
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        const profile = data.profile;
        setUserProfile(profile);
        setProjectName(profile?.project_name || "Unnamed");
        setLabel(profile?.label || "Woss Music");

        setArtists([
          {
            id: 1,
            displayName: profile.project_name || "Unnamed",
            country: "Unknown",
            genre: "Unknown",
            type: "Main Artist",
          },
        ]);
      }

      // 🔑 Fetch “Delete a release” permission — this **dominates** canDelete.
      try {
        const resp = await fetch(
          "http://localhost:4000/api/permissions/me?keys=release.delete",
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (resp.ok) {
          const js = await resp.json();
          // API returns { success, role, permissions: { "release.delete": boolean } }
          const allowed =
            (js && js.permissions && typeof js.permissions["release.delete"] === "boolean")
              ? js.permissions["release.delete"]
              : false;
          setCanDeleteRelease(Boolean(allowed));
        } else {
          setCanDeleteRelease(false);
        }
      } catch (_) {
        setCanDeleteRelease(false);
      }
    } catch (e) {
      console.error("profile fetch error:", e);
    }
  };
  fetchProjectName();
}, []);


  /* ---------- init years ---------- */
  useEffect(() => {
    const y = new Date().getFullYear().toString();
    setClineYear(y);
    setPlineYear(y);
  }, []);
  const currentYear = useCurrentYear();
  useEffect(() => {
    if (currentYear) {
      setClineYear(currentYear);
      setPlineYear(currentYear);
    }
  }, [currentYear]);

  /* ---------- close menus on outside click ---------- */
  useEffect(() => {
    const close = (e) => {
      if (!e.target.closest(".actions-container")) setActiveMenuId(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

/* ---------- load release core ---------- */
useEffect(() => {
  const token = localStorage.getItem("woss_token");
  if (!releaseId || !token) return;

  const fetchRelease = async () => {
    try {
      const res = await fetch(
        `http://localhost:4000/api/user/releases/${releaseId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Guard: non-JSON or not OK? keep existing form state
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        console.warn("fetchRelease: non-JSON response; leaving current state untouched.");
        return;
      }
      const data = await res.json();
      if (!data?.success || !data?.release) return;

      const r = data.release;

      // Do not overwrite with empty defaults; set only when present
      if (r.artwork_url) setReleaseImageUrl(`http://localhost:4000${r.artwork_url}`);
      if (r.release_title != null) {
        setReleaseTitle(r.release_title);
        setDisplayTitle(r.display_title ?? r.release_title ?? "");
      }
      if (r.release_type) setReleaseType(r.release_type);
      if (r.project_name != null) setProjectName(r.project_name);
      if (r.c_line_year != null) setClineYear(r.c_line_year);
      if (r.p_line_year != null) setPlineYear(r.p_line_year);
      if (r.status) setReleaseStatus(r.status);

      if (r.gpid_type) setGpidType(r.gpid_type);
      if (r.gpid_code) setGpidCode(r.gpid_code);
      if (r.label_catalog_number) setLabelCatalogNumber(r.label_catalog_number);
      if (r.primary_genre) setPrimaryGenre({ label: r.primary_genre, value: r.primary_genre });
      if (r.sub_genre) setSelectedSubGenre({ label: r.sub_genre, value: r.sub_genre });
      if (r.metadata_language) setMetadataLanguage({ label: r.metadata_language, value: r.metadata_language });
      if (r.audio_language) setAudioLanguage({ label: r.audio_language, value: r.audio_language });
      if (r.version != null) setVersion(r.version);
      if (r.meta_language_country) setMetaLanguageCountry({ value: r.meta_language_country, label: r.meta_language_country });
      if (r.audio_presentation) setAudioPresentation({ value: r.audio_presentation, label: r.audio_presentation });
      if (r.c_line_owner != null) setCLineOwner(r.c_line_owner);
      if (r.p_line_owner != null) setPLineOwner(r.p_line_owner);
      if (r.label != null) setLabel(r.label);
      if (r.product_release_date) setProductReleaseDate(r.product_release_date.slice(0, 10));

      // Contributors
      if (r.contributors_json) {
        try { setContributors(JSON.parse(r.contributors_json) || []); }
        catch { /* leave current */ }
      }

      // ---------- Artists: ensure main = project_name, dedupe ----------
      const main = String(r.project_name || "").trim();
      let arr = [];
      try {
        const parsed = JSON.parse(r.artists_json || "[]");
        arr = Array.isArray(parsed) ? parsed : [];
      } catch {}

      const seen = new Set();
      const names = [];

      if (main) { names.push(main); seen.add(main.toLowerCase()); }
      for (const n of arr) {
        const s = String(n || "").trim();
        if (!s) continue;
        const k = s.toLowerCase();
        if (!seen.has(k)) { names.push(s); seen.add(k); }
      }
      if (!names.length) names.push("Unknown Project");

      setArtists(names.map((n, i) => ({ id: i, displayName: n })));
      // ----------------------------------------------------------------

      setIsDataLoaded(true);
    } catch (e) {
      console.error("fetch release error:", e);
    }
  };

  fetchRelease();
}, [releaseId]);



  /* ---------- auto-save plumbing ---------- */
  const autoSaveRelease = useCallback(
    async (data) => {
      const token = localStorage.getItem("woss_token");
      try {
        const res = await fetch(
          `http://localhost:4000/api/user/releases/${releaseId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(data),
          }
        );
        const result = await res.json();
        if (!result.success) console.error("Auto-save failed", result);
      } catch (e) {
        console.error("Auto-save error", e);
      }
    },
    [releaseId]
  );

  /* a bunch of auto-saves */
  useEffect(() => {
    if (!releaseId || !isDataLoaded) return;
    const t = setTimeout(() => autoSaveRelease({ release_type: releaseType }), 800);
    return () => clearTimeout(t);
  }, [releaseType, releaseId, isDataLoaded, autoSaveRelease]);

  useEffect(() => {
    if (!releaseId || !isDataLoaded) return;
    const t = setTimeout(() => autoSaveRelease({ label }), 800);
    return () => clearTimeout(t);
  }, [label, releaseId, isDataLoaded, autoSaveRelease]);

  useEffect(() => {
    if (projectName) {
      setArtists((prev) => {
        const updated = [...prev];
        if (updated.length > 0) updated[0].displayName = projectName;
        return updated;
      });
    }
  }, [projectName]);

  useEffect(() => {
    if (!releaseId) return;
    const t = setTimeout(() => autoSaveRelease({ release_title: releaseTitle }), 800);
    return () => clearTimeout(t);
  }, [releaseTitle, releaseId, autoSaveRelease]);

  useEffect(() => {
    if (!releaseId || !isDataLoaded) return;
    const t = setTimeout(() => autoSaveRelease({ version }), 800);
    return () => clearTimeout(t);
  }, [version, releaseId, isDataLoaded, autoSaveRelease]);

  useEffect(() => {
    if (!releaseId || !gpidType || !isDataLoaded) return;
    const t = setTimeout(() => autoSaveRelease({ gpid_type: gpidType }), 800);
    return () => clearTimeout(t);
  }, [gpidType, releaseId, isDataLoaded, autoSaveRelease]);

  useEffect(() => {
    if (!releaseId || !isDataLoaded) return;
    const t = setTimeout(() => autoSaveRelease({ gpid_code: gpidCode }), 800);
    return () => clearTimeout(t);
  }, [gpidCode, releaseId, isDataLoaded, autoSaveRelease]);

  useEffect(() => {
    if (!releaseId || !isDataLoaded) return;
    const t = setTimeout(
      () => autoSaveRelease({ label_catalog_number: labelCatalogNumber }),
      800
    );
    return () => clearTimeout(t);
  }, [labelCatalogNumber, releaseId, isDataLoaded, autoSaveRelease]);

  useEffect(() => {
    if (!releaseId || !primaryGenre || !isDataLoaded) return;
    const t = setTimeout(
      () => autoSaveRelease({ primary_genre: primaryGenre.value }),
      800
    );
    return () => clearTimeout(t);
  }, [primaryGenre, releaseId, isDataLoaded, autoSaveRelease]);

  useEffect(() => {
    if (!releaseId || !selectedSubGenre || !isDataLoaded) return;
    const t = setTimeout(
      () => autoSaveRelease({ sub_genre: selectedSubGenre.value }),
      800
    );
    return () => clearTimeout(t);
  }, [selectedSubGenre, releaseId, isDataLoaded, autoSaveRelease]);

  useEffect(() => {
    if (!releaseId || !metadataLanguage || !isDataLoaded) return;
    const t = setTimeout(
      () => autoSaveRelease({ metadata_language: metadataLanguage.value }),
      800
    );
    return () => clearTimeout(t);
  }, [metadataLanguage, releaseId, isDataLoaded, autoSaveRelease]);

  useEffect(() => {
    if (!releaseId || !metaLanguageCountry || !isDataLoaded) return;
    const t = setTimeout(
      () => autoSaveRelease({ meta_language_country: metaLanguageCountry.value }),
      800
    );
    return () => clearTimeout(t);
  }, [metaLanguageCountry, releaseId, isDataLoaded, autoSaveRelease]);

  useEffect(() => {
    if (!releaseId || !audioLanguage || !isDataLoaded) return;
    const t = setTimeout(
      () => autoSaveRelease({ audio_language: audioLanguage.value }),
      800
    );
    return () => clearTimeout(t);
  }, [audioLanguage, releaseId, isDataLoaded, autoSaveRelease]);

  useEffect(() => {
    if (!releaseId || !audioPresentation || !isDataLoaded) return;
    const t = setTimeout(
      () => autoSaveRelease({ audio_presentation: audioPresentation.value }),
      800
    );
    return () => clearTimeout(t);
  }, [audioPresentation, releaseId, isDataLoaded, autoSaveRelease]);

  useEffect(() => {
    if (!releaseId || !isDataLoaded) return;
    const t = setTimeout(() => autoSaveRelease({ c_line_year: clineYear }), 800);
    return () => clearTimeout(t);
  }, [clineYear, releaseId, isDataLoaded, autoSaveRelease]);

  useEffect(() => {
    if (!releaseId || !isDataLoaded) return;
    const t = setTimeout(() => autoSaveRelease({ p_line_year: plineYear }), 800);
    return () => clearTimeout(t);
  }, [plineYear, releaseId, isDataLoaded, autoSaveRelease]);

  useEffect(() => {
    if (!releaseId || !isDataLoaded) return;
    const t = setTimeout(() => autoSaveRelease({ c_line_owner: cLineOwner }), 800);
    return () => clearTimeout(t);
  }, [cLineOwner, releaseId, isDataLoaded, autoSaveRelease]);

  useEffect(() => {
    if (!releaseId || !isDataLoaded) return;
    const t = setTimeout(() => autoSaveRelease({ p_line_owner: pLineOwner }), 800);
    return () => clearTimeout(t);
  }, [pLineOwner, releaseId, isDataLoaded, autoSaveRelease]);

  /* ---------- contributors by release ---------- */
  useEffect(() => {
    const token = localStorage.getItem("woss_token");
    if (!releaseId || !token) return;
    const go = async () => {
      try {
        const res = await fetch(
          `http://localhost:4000/api/user/releases/${releaseId}/contributors`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (data.success) setContributors(data.contributors);
      } catch (e) {
        console.error("load contributors error:", e);
      }
    };
    go();
  }, [releaseId]);

  /* ---------- keep display title in sync ---------- */
  useEffect(() => {
    if (!releaseId || !isDataLoaded) return;
    const newDisplay = version ? `${releaseTitle} (${version})` : releaseTitle;
    setDisplayTitle(newDisplay);
    const t = setTimeout(() => autoSaveRelease({ display_title: newDisplay }), 800);
    return () => clearTimeout(t);
  }, [releaseTitle, version, releaseId, isDataLoaded, autoSaveRelease]);

  /* ---------- distribute action ---------- */
  const handleDistribute = async () => {
    if (isDistributing) return;
    const token = localStorage.getItem("woss_token");

    const missing = [];
    if (sectionWarnings.coreInfo) missing.push("Core Info");
    if (sectionWarnings.tracks) missing.push("Tracks");
    if (sectionWarnings.scheduling) missing.push("Scheduling");
    if (missing.length) {
      setErrorMessage(`Please complete: ${missing.join(", ")}`);
      setMessageType("warning");
      setFadeOut(false);
      setShowError(true);
      setTimeout(() => setFadeOut(true), 1500);
      setTimeout(() => setShowError(false), 3000);
      return;
    }

    try {
      setIsDistributing(true);

      const exportRes = await fetch(
        `http://localhost:4000/api/user/releases/${releaseId}/export-excel`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      if (!exportRes.ok) throw new Error("Excel export failed.");
      const { fileName } = await exportRes.json();

      const emailRes = await fetch(
        "http://localhost:4000/api/send-distribution-email",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: "global@wossmusic.com",
            subject: "New Distribution",
            attachment: fileName,
          }),
        }
      );

      const data = await emailRes.json();
      if (data.success) {
        setReleaseStatus(data.status || "In Review");
        setErrorMessage("Distribution Successfully!");
        setMessageType("success");
        setFadeOut(false);
        setShowError(true);
        setTimeout(() => setFadeOut(true), 1500);
        setTimeout(() => {
          setShowError(false);
          navigate("/app/portal/catalog");
        }, 2200);
      } else {
        throw new Error("Email sending failed.");
      }
    } catch (err) {
      console.error("Failed to distribute:", err);
      setErrorMessage("Failed to distribute release.");
      setMessageType("danger");
      setFadeOut(false);
      setShowError(true);
      setTimeout(() => setFadeOut(true), 1500);
      setTimeout(() => setShowError(false), 3000);
    } finally {
      setIsDistributing(false);
    }
  };

  /* ---------- UI ---------- */
  const buttons = [
    { label: "Core Info", value: "coreInfo" },
    { label: "Tracks", value: "tracks" },
    { label: "Scheduling", value: "scheduling" },
    { label: "Review", value: "review" },
  ];

  const toggleMenu = (id) => setActiveMenuId((p) => (p === id ? null : id));

  const handleReleaseTypeChange = (type) => {
    setReleaseType(type);
    if (projectName && releaseId) {
      const defaultArtist = {
        id: 0,
        displayName: projectName,
        country: "Unknown",
        genre: "Unknown",
        type: "Main Artist",
      };

      const token = localStorage.getItem("woss_token");
      const artistNames = [projectName];
      const formattedTrackArtist = [{ name: projectName }];

      (async () => {
        try {
          await fetch(`http://localhost:4000/api/user/releases/${releaseId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ contributors_json: JSON.stringify([]) }),
          });

          await fetch(
            `http://localhost:4000/api/user/releases/${releaseId}/artists-json`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ artistNames }),
            }
          );

          const res = await fetch(
            `http://localhost:4000/api/user/releases/${releaseId}/tracks`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const data = await res.json();
          if (data.success && Array.isArray(data.tracks)) {
            await Promise.all(
              data.tracks.map((t) =>
                fetch(`http://localhost:4000/api/user/tracks/${t.id}`, {
                  method: "PUT",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    artists_json: JSON.stringify(artistNames),
                    track_artists_json: JSON.stringify(formattedTrackArtist),
                    track_contributors_json: JSON.stringify([]),
                  }),
                })
              )
            );
          }

          setArtists([defaultArtist]);
          setContributors([]);
        } catch (e) {
          console.error("reset artists+contributors error:", e);
        }
      })();
    }
  };

  const handleRemoveArtist = async (artistId) => {
    const artistToRemove = artists.find((a) => a.id === artistId);
    if (!artistToRemove) return;
    const pName = artists[0]?.displayName;
    if (artistToRemove.displayName === pName) {
      alert("You cannot remove the main project artist.");
      return;
    }
    const updated = artists.filter((a) => a.id !== artistId);
    setArtists(updated);
    const fullList = [pName, ...updated.filter((a) => a.displayName !== pName).map((a) => a.displayName)];

    try {
      const token = localStorage.getItem("woss_token");
      await fetch(
        `http://localhost:4000/api/user/releases/${releaseId}/artists-json`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ artistNames: fullList }),
        }
      );
      if (releaseType === "Single") {
        await syncArtistsJson(releaseId, fullList);
      }
    } catch (e) {
      console.error("update after artist removal error:", e);
    }
  };

  const toggleModal = () => setIsModalOpen((p) => !p);

  const handleAddArtist = async () => {
    const token = localStorage.getItem("woss_token");
    if (!token || !releaseId) return;

    const artistNameTrimmed = newArtist.displayName?.trim();
    const artistNameNormalized = artistNameTrimmed?.toLowerCase();

    if (!artistNameTrimmed) {
      setErrorMessage("Artist name is required.");
      setMessageType("warning");
      setFadeOut(false);
      setShowError(true);
      setTimeout(() => setFadeOut(true), 1500);
      setTimeout(() => setShowError(false), 3000);
      return;
    }

    const isDuplicate = artists.some(
      (a) =>
        a.artist_name?.trim().toLowerCase() === artistNameNormalized ||
        a.displayName?.trim().toLowerCase() === artistNameNormalized
    );
    if (isDuplicate) {
      setErrorMessage(`Failed to create artist. "${artistNameTrimmed}" already exists.`);
      setMessageType("danger");
      setFadeOut(false);
      setShowError(true);
      setTimeout(() => setFadeOut(true), 1500);
      setTimeout(() => setShowError(false), 3000);
      return;
    }

    const body = {
      artist_name: artistNameTrimmed,
      artist_legal_name: newArtist.legalName,
      artist_type: newArtist.type,
      artist_country: newArtist.country,
      artist_genre: newArtist.genre,
      artist_language: newArtist.language,
      artist_spotify_url: newArtist.createSpotifyProfile ? "" : newArtist.spotifyId,
      artist_apple_url: newArtist.createAppleMusicProfile ? "" : newArtist.appleMusicId,
    };

    try {
      const res = await fetch(
        `http://localhost:4000/api/user/releases/${releaseId}/artists`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();

      if (data.success) {
        const r = await fetch(
          `http://localhost:4000/api/user/releases/${releaseId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const rd = await r.json();
        if (rd.success && rd.release?.artists_json) {
          const parsedA = JSON.parse(rd.release.artists_json);
          setArtists(parsedA.map((n, i) => ({ id: i, displayName: n })));
        }
        setNewArtist({});
        toggleModal();
      } else {
        const msg = data.message?.toLowerCase() || "";
        setErrorMessage(
          msg.includes("duplicate") || msg.includes("already exists")
            ? `Failed to create artist. "${artistNameTrimmed}" already exists.`
            : `Failed to create artist: ${data.message || "Unknown error"}`
        );
        setMessageType("danger");
        setFadeOut(false);
        setShowError(true);
        setTimeout(() => setFadeOut(true), 1500);
        setTimeout(() => setShowError(false), 3000);
      }
    } catch (e) {
      console.error("add artist error:", e);
      setErrorMessage("An unexpected error occurred while adding the artist.");
      setMessageType("danger");
      setFadeOut(false);
      setShowError(true);
      setTimeout(() => setFadeOut(true), 1500);
      setTimeout(() => setShowError(false), 3000);
    }
  };

  const handlePrimaryGenreChange = (opt) => {
    setPrimaryGenre(opt);
    const g = genreOptions.find((x) => x.value === opt.value);
    setSubGenres(g?.subGenres || []);
    setSelectedSubGenre(null);
  };

  useEffect(() => {
    const y = new Date().getFullYear();
    setClineYear(String(y));
    setPlineYear(String(y));
  }, []);

useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const token = localStorage.getItem("woss_token") || "";
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const r = await fetch(
        `${PERM_BASE}/api/permissions/me?keys=release.create`,
        { credentials: "include", headers }
      );
      if (!r.ok) throw new Error(`perm ${r.status}`);
      const j = await r.json();
      if (!cancelled) setCanCreateRelease(!!j?.permissions?.["release.create"]);
    } catch {
      if (!cancelled) setCanCreateRelease(false);
    }
  })();
  return () => { cancelled = true; };
}, [PERM_BASE]);



  /* ---------------- render ---------------- */
  return (
    <>
      {showError && (
        <div
          className={`${
            messageType === "danger"
              ? "danger-popup"
              : messageType === "success"
              ? "success-popup"
              : "warning-popup"
          } ${fadeOut ? "fade-out" : ""}`}
        >
          {errorMessage}
        </div>
      )}

   <NewReleaseHeader
      onNew={() => navigate("/app/portal/catalog/new")} // or whatever your path is
      onDistribute={handleDistribute}
      onEdit={() => setIsEditing(true)}
      onUpdate={handleUpdateRelease}
      releaseStatus={releaseStatus}
      isReadOnly={isReadOnly}
    />


      <Container className="mt--6" fluid>
        {/* Nav buttons */}
        <Row className="mb-4">
          <Col>
            <div className="custom-button-container" style={{ maxWidth: "100%" }}>
              {buttons.map((b) => (
                <Button
                  key={b.value}
                  className={`custom-toggle-button ${view === b.value ? "primary" : "secondary"} btn-sm`}
                  type="button"
                  onClick={() => handleViewChange(b.value)}
                  style={{
                    padding: "0.4rem 0.6rem",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1rem",
                  }}
                >
                  {b.label}
                  {(b.value === "coreInfo" && sectionWarnings.coreInfo) ||
                  (b.value === "tracks" && sectionWarnings.tracks) ||
                  (b.value === "scheduling" && sectionWarnings.scheduling) ? (
                    <CustomInfoIcon className="ml-1" size="1em" />
                  ) : null}
                </Button>
              ))}
            </div>
          </Col>
        </Row>

        {/* Views */}
        {view === "tracks" && (
          <Tracks
            releaseId={releaseId}
            releaseImageUrl={releaseImageUrl}
            releaseTitle={releaseTitle}
            displayTitle={displayTitle}
            releaseArtists={artists.map((a) => a.displayName).join(", ")}
            fullArtists={artists}
            setArtists={setArtists}
            releaseDate={productReleaseDate}
            releaseGenre={primaryGenre?.label || ""}
            releaseType={releaseType}
            releaseFormat="Digital, Audio"
            project={projectName}
            audioLanguage={audioLanguage?.label || ""}
            gpidType={gpidType}
            code={gpidCode || "Creating..."}
            cLineYear={clineYear}
            cLineOwner={cLineOwner}
            label={userProfile?.label}
            updateReleaseArtistsFromTracks={updateReleaseArtistsFromTracks}
            setSectionWarnings={setSectionWarnings}
            setTrackCount={setTrackCount}
            fetchTracksData={fetchTracksData}
            tracks={tracksData}
            refreshTracksData={refreshTracksData}
            isReadOnly={isReadOnly}
          />
        )}

        {view === "scheduling" && (
          <Scheduling
            releaseId={releaseId}
            releaseArtists={artists.map((a) => a.displayName).join(", ")}
            releaseTitle={releaseTitle}
            displayTitle={displayTitle}
            releaseDate={productReleaseDate}
            releaseGenre={primaryGenre?.label || ""}
            releaseType={releaseType}
            releaseFormat="Digital, Audio"
            project={projectName}
            audioLanguage={audioLanguage?.label || ""}
            gpidType={gpidType}
            code={gpidCode || "Creating..."}
            cLineYear={clineYear}
            cLineOwner={cLineOwner}
            label={userProfile?.label}
            originalReleaseDate={originalReleaseDate}
            setOriginalReleaseDate={setOriginalReleaseDate}
            preorderDate={preorderDate}
            setPreorderDate={setPreorderDate}
            productReleaseDate={productReleaseDate}
            setProductReleaseDate={setProductReleaseDate}
            schedulingWarnings={schedulingWarnings}
            setSchedulingWarnings={setSchedulingWarnings}
            isReadOnly={isReadOnly}
          />
        )}

        {view === "review" && <Review />}

        {view === "coreInfo" && (
          <>
            {/* Summary Card */}
            <Row>
              <Col xs="12">
                <NewReleaseCard
                  releaseImageUrl={releaseImageUrl}
                  releaseId={releaseId}
                  releaseTitle={releaseTitle}
                  displayTitle={displayTitle}
                  releaseArtists={artists.map((a) => a.displayName).join(", ")}
                  releaseDate={productReleaseDate}
                  releaseGenre={primaryGenre?.label || ""}
                  releaseType={releaseType}
                  releaseFormat="Digital, Audio"
                  project={projectName}
                  audioLanguage={audioLanguage?.label || ""}
                  gpidType={gpidType}
                  code={gpidCode || "Creating..."}
                  cLineYear={clineYear}
                  cLineOwner={cLineOwner}
                  label={userProfile?.label}
                  userProfile={userProfile}
                />
              </Col>
            </Row>

            {/* Release Configuration */}
<Row>
  <Col xs="12">
    <Card className="shadow-card">
      <CardHeader className="custom-card-header">
        <h2 className="text-white">
          Release Configuration{" "}
          {sectionWarnings.releaseConfig && (
            <span className="status-info">(In Progress)</span>
          )}
        </h2>
        <p className="small">You will not be able to change these details later.</p>
        <div className="header-divider"></div>
      </CardHeader>

      {/* 🔒 Lock the whole card body when read-only (same as Release Artists) */}
      <CardBody className="mt-4" style={{ position: "relative" }} aria-disabled={isReadOnly}>
        {isReadOnly && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              cursor: "not-allowed",
              zIndex: 2,
            }}
          />
        )}

        <Row className="mt--4">
          <Col xs="12" md="3" className="mb-2">
            <FormGroup>
              <Label className="custom-label">Release Type</Label>
              <div className="d-flex flex-column flex-md-row justify-content-between gap-2">
                {["Single", "EP", "Album"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`release-type-btn ${releaseType === t ? "active" : ""} flex-fill`}
                    onClick={() => {
                      if (isReadOnly) return; // guard
                      handleReleaseTypeChange(t);
                    }}
                    disabled={isReadOnly}
                    style={{
                      cursor: isReadOnly ? "not-allowed" : "pointer",
                      pointerEvents: isReadOnly ? "none" : "auto",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </FormGroup>
          </Col>

          <Col xs="12" md="3" className="mb-2">
            <FormGroup>
              <Label className="custom-label">Project</Label>
              <Input value={projectName || "Loading..."} disabled />
            </FormGroup>
          </Col>

          <Col xs="12" md="3" className="mb-2">
            <FormGroup>
              <Label className="custom-label">Release Format</Label>
              <Input value="Digital, Audio" disabled />
            </FormGroup>
          </Col>

          <Col xs="12" md="3" className="mb-2">
            <FormGroup>
              <Label className="custom-label">Label</Label>
              <Input type="text" name="label" value={userProfile?.label || ""} readOnly />
            </FormGroup>
          </Col>
        </Row>
      </CardBody>
    </Card>
  </Col>
</Row>

            {/* Core Info */}
            <Row>
              <Col xs="12">
                <Card className="shadow-card">
                  <CardHeader className="custom-card-header mb--4">
                    <h2 className="text-white">
                      Release Title {sectionWarnings.releaseTitle && <span className="status-info">(In Progress)</span>}
                    </h2>
                    <div className="header-divider mb-3"></div>
                  </CardHeader>
                  <CardBody className="mt-4">
                    <Row>
                      <Col md={releaseType === "Single" ? "4" : "6"} xs="12" className="mb-3">
                        <FormGroup>
                          <Label className="custom-label">
                            {releaseType === "EP" ? "EP Title *" : releaseType === "Album" ? "Album Title *" : "Release Title *"}
                          </Label>
                          <Input
                            value={releaseTitle}
                            onChange={(e) => setReleaseTitle(e.target.value)}
                            placeholder="Enter Release Title"
                            className={releaseTitle ? "" : "border-warning"}
                            readOnly={isReadOnly}
                          />
                        </FormGroup>
                      </Col>
                      <Col md={releaseType === "Single" ? "4" : "6"} xs="12" className="mb-3">
                        <FormGroup>
                          <Label className="custom-label">Display Title *</Label>
                          <Input value={displayTitle} readOnly placeholder="Display Title" />
                        </FormGroup>
                      </Col>
                      {releaseType === "Single" && (
                        <Col md="4" xs="12" className="mb-3">
                          <FormGroup>
                            <Label className="custom-label">Version</Label>
                            <Input
                              placeholder="(Remix, Live, Radio Edit, Clean)"
                              value={version}
                              readOnly={isReadOnly}
                              onChange={(e) => {
                                const v = e.target.value;
                                setVersion(v);
                                setDisplayTitle(releaseTitle ? `${releaseTitle} (${v})` : "");
                              }}
                            />
                          </FormGroup>
                        </Col>
                      )}
                    </Row>
                  </CardBody>
                </Card>

                {/* Release Codes */}
                <Card className="shadow-card mt-3">
                  <CardHeader className="custom-card-header mb--4">
                    <h2 className="text-white">Release Codes</h2>
                    <div className="header-divider"></div>
                  </CardHeader>
                  <CardBody className="mt-4">
                    <Row>
                      <Col md="4" xs="12" className="mb-3">
                        <FormGroup>
                          <Label className="custom-label">GPID Type</Label>
                          <CustomSelect
                            options={[
                              { value: "EAN", label: "EAN" },
                              { value: "UPC", label: "UPC" },
                            ]}
                            value={
                              gpidType ? { value: gpidType, label: gpidType } : { value: "", label: "Select GPID Type" }
                            }
                            onChange={(opt) => setGpidType(opt.value)}
                            readOnly={isReadOnly}
                            placeholder="Select GPID Type"
                          />
                        </FormGroup>
                      </Col>
                      <Col md="4" xs="12">
                        <FormGroup>
                          <Label className="custom-label">{gpidType === "EAN" ? "EAN Code" : "UPC Code"}</Label>
                          <Input
                            placeholder={`Enter ${gpidType} code`}
                            value={gpidCode}
                            onChange={(e) => setGpidCode(e.target.value)}
                            readOnly={isReadOnly}
                          />
                          <p className="text-warning mt-2 small font-weight-600">
                            If a custom UPC or EAN is not entered, one will be generated automatically.
                          </p>
                        </FormGroup>
                      </Col>
                      <Col md="4" xs="12" className="mb-3">
                        <FormGroup>
                          <Label className="custom-label">Label Catalog Number</Label>
                          <Input
                            placeholder="Enter Label Catalog Number"
                            value={labelCatalogNumber}
                            readOnly={isReadOnly}
                            onChange={(e) => setLabelCatalogNumber(e.target.value)}
                          />
                        </FormGroup>
                      </Col>
                    </Row>
                  </CardBody>
                </Card>

                {/* Genre & Language */}
                <Card className="shadow-card mt-3">
                  <CardHeader className="custom-card-header mb--4">
                    <h2 className="text-white">
                      Genre & Language {sectionWarnings.genreLanguage && <span className="status-info">(In Progress)</span>}
                    </h2>
                    <div className="header-divider"></div>
                  </CardHeader>
                  <CardBody className="mt-4">
                    <Row>
                      <Col md="4" xs="12" className="mb-3">
                        <FormGroup>
                          <Label className="custom-label">Primary Genre *</Label>
                          <CustomSelect
                            readOnly={isReadOnly}
                            options={[{ value: "", label: "Select Primary Genre" }, ...genreOptions]}
                            value={primaryGenre || { value: "", label: "Select Primary Genre" }}
                            onChange={handlePrimaryGenreChange}
                            className={`react-select-container ${
                              !primaryGenre || primaryGenre.value === "" ? "border-warning" : ""
                            }`}
                          />
                        </FormGroup>
                      </Col>
                      <Col md="4" xs="12" className="mb-3">
                        <FormGroup>
                          <Label className="custom-label">Sub-Genre</Label>
                          <CustomSelect
                            readOnly={isReadOnly}
                            options={[
                              { value: "", label: "Select Sub-Genre" },
                              ...subGenres.map((s) => ({ value: s, label: s })),
                            ]}
                            value={selectedSubGenre}
                            onChange={setSelectedSubGenre}
                            isOptional
                          />
                        </FormGroup>
                      </Col>
                      <Col md="4" xs="12" className="mb-3">
                        <FormGroup>
                          <Label className="custom-label">Metadata Language *</Label>
                          <CustomSelect
                            readOnly={isReadOnly}
                            options={[{ value: "", label: "Select Metadata Language" }, ...languageOptions]}
                            value={metadataLanguage || { value: "", label: "Select Metadata Language" }}
                            onChange={(s) => setMetadataLanguage(s)}
                            className={`react-select-container ${
                              !metadataLanguage || metadataLanguage.value === "" ? "border-warning" : ""
                            }`}
                          />
                        </FormGroup>
                      </Col>
                    </Row>

                    <Row>
                      <Col md="4" xs="12" className="mb-3">
                        <FormGroup>
                          <Label className="custom-label">Metadata Language Country *</Label>
                          <CustomSelect
                            readOnly={isReadOnly}
                            options={[{ value: "", label: "Select a Country" }, ...countryOptions]}
                            value={metaLanguageCountry || { value: "", label: "Select a Country" }}
                            onChange={setMetaLanguageCountry}
                            className={`react-select-container ${
                              !metaLanguageCountry || metaLanguageCountry.value === "" ? "border-warning" : ""
                            }`}
                          />
                        </FormGroup>
                      </Col>
                      <Col md="4" xs="12" className="mb-3">
                        <FormGroup>
                          <Label className="custom-label">Audio Language *</Label>
                          <CustomSelect
                            readOnly={isReadOnly}
                            options={[{ value: "", label: "Select Audio Language" }, ...languageOptions]}
                            value={audioLanguage || { value: "", label: "Select Audio Language" }}
                            onChange={(s) => setAudioLanguage(s)}
                            className={`react-select-container ${
                              !audioLanguage || audioLanguage.value === "" ? "border-warning" : ""
                            }`}
                          />
                        </FormGroup>
                      </Col>
                      <Col md="4" xs="12" className="mb-3">
                        <FormGroup>
                          <Label className="custom-label">Audio Presentation *</Label>
                          <CustomSelect
                            readOnly={isReadOnly}
                            options={[{ value: "", label: "Select Audio Presentation" }, ...audioPresentationOptions]}
                            value={audioPresentation || { value: "", label: "Select Audio Presentation" }}
                            onChange={setAudioPresentation}
                            className={`react-select-container ${
                              !audioPresentation || audioPresentation.value === "" ? "border-warning" : ""
                            }`}
                          />
                        </FormGroup>
                      </Col>
                    </Row>
                  </CardBody>
                </Card>

              
                {releaseType === "Single" && (
                  <Card className="shadow-card mt-3">
                    <CardHeader className="custom-card-header mb--4">
                      <h2 className="text-white">Release Artists</h2>
                      <div className="header-divider"></div>
                    </CardHeader>

                    <CardBody
                      className="mt-4"
                      style={{ position: "relative" }}
                      aria-disabled={isReadOnly}
                    >
                      {/* Keep the read-only overlay EXACTLY as you had it */}
                      {isReadOnly && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            cursor: "not-allowed",
                            zIndex: 2,
                          }}
                        />
                      )}

                      <ArtistsModal
                        isOpen={isArtistModalOpen && !isReadOnly}
                        toggle={isReadOnly ? () => {} : toggleArtistModal}
                        addArtistToList={isReadOnly ? () => {} : addArtistToList}
                        openCreateArtistModal={isReadOnly ? () => {} : openCreateArtistModal}
                      />

                      {/* Sortable list shows the DSP pills (Apple/Spotify) for main + others.
                          Pills have their own normalization and are clickable even in read-only. */}
                      <div
                        style={{
                          position: isReadOnly ? "relative" : "static",
                          zIndex: isReadOnly ? 3 : "auto",
                          pointerEvents: "auto",
                        }}
                      >
                      <SortableList
                          items={artists}
                          toggleMenu={isReadOnly ? () => {} : toggleMenu}
                          activeMenuId={isReadOnly ? null : activeMenuId}
                          handleRemoveArtist={isReadOnly ? () => {} : handleRemoveArtist}
                          onSortEnd={isReadOnly ? () => {} : ((p) => onSortEnd(p, setArtists))}
                          useDragHandle={!isReadOnly}
                          releaseId={releaseId}
                          mainProfile={userProfile}
                        />
                      </div>

                      <Button
                        color="primary"
                        onClick={isReadOnly ? undefined : toggleArtistModal}
                        disabled={isReadOnly}
                        style={{ cursor: isReadOnly ? "not-allowed" : undefined }}
                      >
                        + Add Artist
                      </Button>
                    </CardBody>
                  </Card>
                )}

                {/* Creation modal (only when not read-only) */}
                {!isReadOnly && isModalOpen && (
                  <>
                    <div className="new-container-overlay" onClick={toggleModal}></div>
                    <div className="edit-artist-actions-menu shadow-lg rounded">
                      <button className="close-button" onClick={toggleModal}>
                        &times;
                      </button>
                          <h3 className="mb-4 text-white">Create New Artist</h3>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleAddArtist();
                        }}
                      >
                        <Row className="mb-3">
                          <Col md="6">
                            <label className="text-white text-bold">Artist Name *</label>
                            <Input
                              className="form-control-alternative text-white bg-primary-dark border-0"
                              type="text"
                              placeholder="Enter Artist Name"
                              value={newArtist.displayName || ""}
                              onChange={(e) =>
                                setNewArtist({ ...newArtist, displayName: e.target.value })
                              }
                              required
                            />
                          </Col>
                          <Col md="6">
                            <label className="text-white text-bold">Country of Origin *</label>
                            <Select
                              className="react-select-container"
                              classNamePrefix="react-select"
                              options={countryOptions}
                              value={countryOptions.find((o) => o.value === newArtist.country) || null}
                              onChange={(s) =>
                                setNewArtist({ ...newArtist, country: s ? s.value : "" })
                              }
                              placeholder="Select Country"
                              isClearable
                            />
                          </Col>
                        </Row>

                        <Row className="mb-3">
                          <Col md="6">
                            <label className="text-white text-bold">Artist Legal Name *</label>
                            <Input
                              className="form-control-alternative text-white bg-primary-dark border-0"
                              type="text"
                              placeholder="Enter Legal Name"
                              value={newArtist.legalName || ""}
                              onChange={(e) =>
                                setNewArtist({ ...newArtist, legalName: e.target.value })
                              }
                              required
                            />
                          </Col>
                          <Col md="6">
                            <label className="text-white text-bold">Genre *</label>
                            <Select
                              className="react-select-container"
                              classNamePrefix="react-select"
                              options={genreOptions}
                              value={genreOptions.find((o) => o.value === newArtist.genre) || null}
                              onChange={(s) =>
                                setNewArtist({ ...newArtist, genre: s ? s.value : "" })
                              }
                              placeholder="Select Genre"
                              isClearable
                            />
                          </Col>
                        </Row>

                        <Row className="mb-4">
                          <Col md="6">
                            <label className="text-white text-bold">Artist Type *</label>
                            <Select
                              className="react-select-container"
                              classNamePrefix="react-select"
                              options={artisttypeOptions}
                              value={artisttypeOptions.find((o) => o.value === newArtist.type) || null}
                              onChange={(s) =>
                                setNewArtist({ ...newArtist, type: s ? s.value : "" })
                              }
                              placeholder="Select Artist Type"
                              isClearable
                              required
                            />
                          </Col>
                          <Col md="6">
                            <label className="text-white text-bold">Language *</label>
                            <Select
                              className="react-select-container"
                              classNamePrefix="react-select"
                              options={languageOptions}
                              value={languageOptions.find((o) => o.value === newArtist.language) || null}
                              onChange={(s) =>
                                setNewArtist({ ...newArtist, language: s ? s.value : "" })
                              }
                              placeholder="Select Language"
                              isClearable
                            />
                          </Col>
                        </Row>

                        <div className="text-white mt-2">
                          <p className="small font-weight-500">
                            <i className="fas fa-info-circle me-2 mr-1"></i>
                            Review information before you create a new artist. To make changes later,
                            you'll need to contact your Woss Music Label Manager.
                          </p>
                        </div>

                        <hr className="mb-2" />
                        <h4 className="h3 text-white mt-4 mb-3 text-center">Digital Service Provider (DSP) IDs</h4>
                        <hr className="mt-4" />

                        <Row className="mb-3">
                          <Col md="6">
                            <label className="text-white text-bold">Artist Apple Music Profile</label>
                            <div className="d-flex align-items-center">
                              <Input
                                type="text"
                                placeholder="Paste an Apple Music URL or ID"
                                value={newArtist.appleMusicId || ""}
                                onChange={(e) => {
                                  const v = e.target.value.trim();
                                  const isSpotify =
                                    /(?:spotify\.com\/.*\/artist\/|spotify:artist:|^spotify:)/i.test(v) ||
                                    /^[a-zA-Z0-9]{22}$/.test(v);
                                  if (isSpotify) {
                                    setErrorMessage("Error testing because it's a Spotify link or ID");
                                    setMessageType("danger");
                                    setFadeOut(false);
                                    setShowError(true);
                                    setTimeout(() => setFadeOut(true), 1500);
                                    setTimeout(() => setShowError(false), 3000);
                                    return;
                                  }
                                  const idMatch = v.match(/(?:music\.apple\.com\/[^/]+\/artist\/[^/]+\/)?(\d+)/);
                                  const extracted = idMatch ? idMatch[1] : v;
                                  setNewArtist({ ...newArtist, appleMusicId: extracted });
                                }}
                                className="profile-input"
                              />
                              <a
                                className="test-button ms-2"
                                target="_blank"
                                rel="noopener noreferrer"
                                href={
                                  newArtist.appleMusicId
                                    ? `https://music.apple.com/us/artist/${newArtist.appleMusicId}`
                                    : "#"
                                }
                              >
                                Test <i className="fas fa-external-link-alt ms-1 ml-2"></i>
                              </a>
                            </div>
                            <div className="d-flex align-items-center mt-2 checkbox-wrapper">
                              <input
                                type="checkbox"
                                id="createAppleProfile"
                                checked={newArtist.createAppleMusicProfile || false}
                                onChange={(e) =>
                                  setNewArtist({
                                    ...newArtist,
                                    createAppleMusicProfile: e.target.checked,
                                  })
                                }
                              />
                              <label htmlFor="createAppleProfile" className="ms-2">
                                Create Apple Music Profile
                              </label>
                            </div>
                          </Col>

                          <Col md="6">
                            <label className="text-white text-bold">Artist Spotify Profile</label>
                            <div className="d-flex align-items-center">
                              <Input
                                type="text"
                                placeholder="Paste a Spotify URL, URI, or ID"
                                value={newArtist.spotifyId || ""}
                                onChange={(e) => {
                                  const v = e.target.value.trim();
                                  const isApple = /music\.apple\.com/.test(v) || /^\d{5,}$/.test(v);
                                  if (isApple) {
                                    setErrorMessage("Error because it's an Apple Music link or ID");
                                    setMessageType("danger");
                                    setFadeOut(false);
                                    setShowError(true);
                                    setTimeout(() => setFadeOut(true), 1500);
                                    setTimeout(() => setShowError(false), 3000);
                                    return;
                                  }
                                  const idMatch = v.match(/(?:spotify\.com\/.*\/artist\/|spotify:artist:)?([a-zA-Z0-9]{22})/);
                                  const extracted = idMatch ? idMatch[1] : v;
                                  setNewArtist({ ...newArtist, spotifyId: extracted });
                                }}
                                className="profile-input"
                              />
                              <a
                                className="test-button ms-2"
                                target="_blank"
                                rel="noopener noreferrer"
                                href={
                                  newArtist.spotifyId
                                    ? `https://open.spotify.com/artist/${newArtist.spotifyId}`
                                    : "#"
                                }
                              >
                                Test <i className="fas fa-external-link-alt ms-1 ml-2"></i>
                              </a>
                            </div>
                            <div className="d-flex align-items-center mt-2 checkbox-wrapper">
                              <input
                                type="checkbox"
                                id="createSpotifyProfile"
                                checked={newArtist.createSpotifyProfile || false}
                                onChange={(e) =>
                                  setNewArtist({
                                    ...newArtist,
                                    createSpotifyProfile: e.target.checked,
                                  })
                                }
                              />
                              <label htmlFor="createSpotifyProfile" className="ms-2">
                                Create Spotify Profile
                              </label>
                            </div>
                          </Col>
                        </Row>

                        <div className="text-white small mb-4">
                          <i className="fas fa-info-circle me-2 mt-4 mr-1"></i>
                          Only create a new Spotify profile if the artist does not have one. Once the release is
                          delivered, you can find this profile on Spotify for Artists.
                        </div>

                        <div className="d-flex justify-content-end mt-4">
                          <Button className="me-3" color="darker" onClick={toggleModal}>
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            color="white"
                            className="px-4"
                            disabled={!newArtist.displayName || !newArtist.legalName}
                          >
                            Create New Artist
                          </Button>
                        </div>
                      </form>
                    </div>
                  </>
                )}

                {/* Contributors (Single) */}
                {releaseType === "Single" && (
                  <Card className="shadow-card mt-3">
                    <CardHeader className="custom-card-header mb--4">
                      <h2 className="text-white">
                        Release Contributors{" "}
                        {sectionWarnings.releaseContributors && (
                          <span className="status-info">(In Progress)</span>
                        )}
                      </h2>
                      <div className="header-divider"></div>
                    </CardHeader>

                    <CardBody
                      className="mt-3"
                      style={{ position: "relative" }}
                      aria-disabled={isReadOnly}
                    >
                      {isReadOnly && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            cursor: "not-allowed",
                            zIndex: 2,
                          }}
                        />
                      )}

                      <ContributorsList
                        contributors={contributors}
                        setContributors={isReadOnly ? () => {} : setContributors}
                        readOnly={isReadOnly}
                      />

                      <Button
                        className="mt-2"
                        color="primary"
                        onClick={isReadOnly ? undefined : () => setIsContributorModalOpen(true)}
                        disabled={isReadOnly}
                        style={{ cursor: isReadOnly ? "not-allowed" : undefined }}
                      >
                        <i className="fas fa-plus"></i> Add New Contributor
                      </Button>
                    </CardBody>
                  </Card>
                )}

                <ContributorsModal
                  isOpen={isContributorModalOpen && !isReadOnly}
                  toggle={isReadOnly ? () => {} : toggleContributorModal}
                  contributor={newContributor}
                  setContributor={isReadOnly ? () => {} : setNewContributor}
                  setContributors={isReadOnly ? () => {} : setContributors}
                  contributors={contributors}
                />


                {/* Legal Notices */}
                <Card className="shadow-card mt-3">
                  <CardHeader className="custom-card-header mb--4">
                    <h2 className="text-white">
                      Legal Notices {sectionWarnings.legalNotices && <span className="status-info">(In Progress)</span>}
                    </h2>
                    <div className="header-divider"></div>
                  </CardHeader>
                  <CardBody className="mt-4">
                    <Row>
                      <Col md="3">
                        <FormGroup>
                          <Label className="custom-label">
                            C Line Year <i className="fas fa-info-circle"></i>
                          </Label>
                          <CustomSelect
                            readOnly={isReadOnly}
                            options={[{ value: "", label: "Select C Line Year" }, ...yearOptions]}
                            value={
                              clineYear
                                ? { value: clineYear, label: clineYear }
                                : { value: "", label: "Select C Line Year" }
                            }
                            onChange={(s) => setClineYear(s?.value || "")}
                            placeholder="Select C Line Year"
                            className={`react-select-container ${clineYearMissing ? "border-warning" : ""}`}
                          />
                        </FormGroup>
                      </Col>
                      <Col md="3">
                        <FormGroup>
                          <Label className="custom-label">
                            C Line Owner <i className="fas fa-info-circle"></i>
                          </Label>
                          {userProfile?.role === "Distributor" ? (
                            <Input
                              readOnly={isReadOnly}
                              type="text"
                              value={cLineOwner?.split(" / Distributed by")[0] ?? ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                const woss = " / Distributed by Woss Music, LLC";
                                const labelSuf = ` / Distributed by ${userProfile?.label}, a division of Woss Music, LLC`;
                                const suffix = userProfile?.label === "Woss Music" ? woss : labelSuf;
                                setCLineOwner(`${val}${suffix}`);
                              }}
                              placeholder=""
                            />
                          ) : (
                            <Input type="text" value={userProfile?.label} readOnly />
                          )}
                        </FormGroup>
                      </Col>
                      <Col md="3">
                        <FormGroup>
                          <Label className="custom-label">
                            P Line Year <i className="fas fa-info-circle"></i>
                          </Label>
                          <CustomSelect
                            readOnly={isReadOnly}
                            options={[{ value: "", label: "Select P Line Year" }, ...yearOptions]}
                            value={
                              plineYear
                                ? { value: plineYear, label: plineYear }
                                : { value: "", label: "Select P Line Year" }
                            }
                            onChange={(s) => setPlineYear(s?.value || "")}
                            placeholder="Select P Line Year"
                          />
                        </FormGroup>
                      </Col>
                      <Col md="3">
                        <FormGroup>
                          <Label className="custom-label">
                            P Line Owner <i className="fas fa-info-circle"></i>
                          </Label>
                          {userProfile?.role === "Distributor" ? (
                            <Input
                              readOnly={isReadOnly}
                              type="text"
                              value={pLineOwner?.split(" / Distributed by")[0] ?? ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                const woss = " / Distributed by Woss Music, LLC";
                                const labelSuf = ` / Distributed by ${userProfile?.label}, a division of Woss Music, LLC`;
                                const suffix = userProfile?.label === "Woss Music" ? woss : labelSuf;
                                setPLineOwner(`${val}${suffix}`);
                              }}
                              placeholder="Enter Phonographic Owner"
                            />
                          ) : (
                            <Input type="text" value={userProfile?.label} readOnly />
                          )}
                        </FormGroup>
                      </Col>
                    </Row>

                    <Row className="mt-2">
                      <Col>
                        <p className="text-muted small">
                          <strong className="mr-1">C Line Display Credit:</strong>
                          {clineYear && (
                            <>
                              ©{clineYear}{" "}
                              {userProfile?.role === "Distributor"
                                ? (() => {
                                    const w = " / Distributed by Woss Music, LLC";
                                    const l = ` / Distributed by ${userProfile?.label}, a division of Woss Music, LLC`;
                                    const suf = userProfile?.label === "Woss Music" ? w : l;
                                    const clean = cLineOwner.replace(suf, "").trim();
                                    return `${clean}${suf}`;
                                  })()
                                : userProfile?.label === "Woss Music"
                                ? "Woss Music, LLC"
                                : `${userProfile?.label} under exclusive license to Woss Music, LLC`}
                            </>
                          )}
                        </p>

                        <p className="text-muted small mt--3">
                          <strong className="mr-1">P Line Display Credit:</strong>
                          {plineYear && (
                            <>
                              ℗{plineYear}{" "}
                              {userProfile?.role === "Distributor"
                                ? (() => {
                                    const w = " / Distributed by Woss Music, LLC";
                                    const l = ` / Distributed by ${userProfile?.label}, a division of Woss Music, LLC`;
                                    const suf = userProfile?.label === "Woss Music" ? w : l;
                                    const clean = pLineOwner.replace(suf, "").trim();
                                    return `${clean}${suf}`;
                                  })()
                                : userProfile?.label === "Woss Music"
                                ? "Woss Music, LLC"
                                : `${userProfile?.label} under exclusive license to Woss Music, LLC`}
                            </>
                          )}
                        </p>

                        <div className="header-divider"></div>
                        <p className="text-muted small">
                          <i className="fas fa-info-circle"></i> C/P Line values will be applied to new
                          track. Changes made here will apply to non-edited.
                        </p>
                      </Col>
                    </Row>
                  </CardBody>
                </Card>
               {canDelete && ( 
  <div className="text-center mb-4">
    <Button color="dark" onClick={handleDeleteRelease}>
      <i className="fas fa-trash me-2"></i> Delete Release
    </Button>
  </div>
)}

              </Col>
            </Row>
          </>
        )}
      </Container>
    </>
  );
}

export default NewRelease;
