import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Nav,
  NavItem,
  TabContent,
  TabPane,
} from "reactstrap";
import DetailsAndArtists from "./Tracks/DetailsAndArtists";
import Contributors from "./Tracks/Contributors";
import Metadata from "./Tracks/OtherMetadata";
import AudioSpecs from "./Tracks/AudioSpecs";
import Publishing from "./Tracks/Publishing";
import { FaGripVertical, FaChevronDown, FaChevronUp, FaTrash } from "react-icons/fa";
import { SortableContainer, SortableElement, SortableHandle } from "react-sortable-hoc";
import { arrayMoveImmutable } from "array-move";
import NewReleaseCard from "components/Custom/NewReleaseCard";
import ISRCInput from "components/Custom/ISRCGenerator";
import CustomInfoIcon from "components/Icons/CustomInfoIcon";

const getGlobalIsEditing = () => {
  const keys = [
    "woss_edit_mode",         // "on"/"off"
    "edit_release",           // "true"/"false"
    "isEditingRelease",       // "true"/"false"
    "coreinfo_is_editing",    // "true"/"false"
    "newrelease_is_editing",  // "true"/"false"
  ];
  for (const k of keys) {
    const v = localStorage.getItem(k) ?? sessionStorage.getItem(k);
    if (v === "on" || v === "true") return true;
  }
  return false;
};

function Tracks({
  releaseId,
  releaseArtists,
  releaseTitle,
  displayTitle,
  fullArtists,
  releaseDate,
  releaseGenre,
  releaseType,
  releaseFormat,
  project,
  audioLanguage,
  gpidType,
  code,
  cLineYear,
  cLineOwner,
  label,
  updateReleaseArtistsFromTracks,
  selectedTerritory,
  partnerExclusivity,
  schedulingRef,
  setSectionWarnings,
  setTrackCount,
  fetchTracksData,
  isReadOnly: propIsReadOnly, // optional override
}) {
  const { publicId, slug, trackId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [resolvedReleaseId, setResolvedReleaseId] = useState(releaseId || null);

  // final lock flag used in this component
  const [isReadOnly, setIsReadOnly] = useState(() =>
    propIsReadOnly !== undefined ? !!propIsReadOnly : !getGlobalIsEditing()
  );

  // follow prop when provided
  useEffect(() => {
    if (propIsReadOnly !== undefined) setIsReadOnly(!!propIsReadOnly);
  }, [propIsReadOnly]);

  // react to storage changes and custom event from your Edit button
  useEffect(() => {
    const onStorage = (e) => {
      if (!e || !e.key) return;
      const watch = [
        "woss_edit_mode",
        "edit_release",
        "isEditingRelease",
        "coreinfo_is_editing",
        "newrelease_is_editing",
      ];
      if (watch.includes(e.key)) setIsReadOnly(!getGlobalIsEditing());
    };
    const onCustom = (e) => setIsReadOnly(!Boolean(e?.detail?.editing));
    window.addEventListener("storage", onStorage);
    window.addEventListener("woss:edit-mode", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("woss:edit-mode", onCustom);
    };
  }, []);

  // Resolve to numeric id from publicId or slug (with fallbacks)
  const resolveByPublicId = useCallback(async (pid) => {
    const token = localStorage.getItem("woss_token");
    if (!token || !pid) return;
    try {
      const res = await fetch(`http://localhost:4000/api/user/releases/public/${pid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.release?.id) {
        setResolvedReleaseId(Number(data.release.id));
        localStorage.setItem("currentReleaseId", String(data.release.id));
      }
    } catch (e) {
      console.error("resolveByPublicId failed:", e);
    }
  }, []);

  const resolveBySlug = useCallback(async (s) => {
    const token = localStorage.getItem("woss_token");
    if (!token || !s) return;
    try {
      const res = await fetch(`http://localhost:4000/api/user/releases/slug/${s}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.release?.id) {
        setResolvedReleaseId(Number(data.release.id));
        localStorage.setItem("currentReleaseId", String(data.release.id));
      }
    } catch (e) {
      console.error("resolveBySlug failed:", e);
    }
  }, []);

  useEffect(() => {
    if (releaseId) {
      setResolvedReleaseId(releaseId);
      return;
    }
    if (publicId) {
      resolveByPublicId(publicId);
      return;
    }
    if (slug) {
      resolveBySlug(slug);
      return;
    }
    const ls = localStorage.getItem("currentReleaseId");
    if (ls) setResolvedReleaseId(Number(ls));
  }, [releaseId, publicId, slug, resolveByPublicId, resolveBySlug]);

  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);
  const [activeTab, setActiveTab] = useState("details");
  const [isHoveredPublisher, setIsHoveredPublisher] = useState(false);
  const [isHoveredWorkTitle, setIsHoveredWorkTitle] = useState(false);
  const [isHoveredSplitPercentage, setIsHoveredSplitPercentage] = useState(false);
  const [isHoveredCountry, setIsHoveredCountry] = useState(false);
  const [isHoveredRights, setIsHoveredRights] = useState(false);
  const [isHoveredAffiliation, setIsHoveredAffiliation] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [setArtists] = useState([]); // kept for NewReleaseCard prop compatibility
  const [productReleaseDate, setProductReleaseDate] = useState("");
  const [releaseImageUrl, setReleaseImageUrl] = useState(null);

  // Only keep state that is actively used
  const [track_primary_genre, setTrackPrimaryGenre] = useState("");
  const [track_sub_genre, setTrackSubGenre] = useState("");
  const [track_metadata_language, setTrackMetadataLanguage] = useState("");
  const [track_metadata_country, setTrackMetadataCountry] = useState("");
  const [track_audio_language, setTrackAudioLanguage] = useState("");
  const [track_p_line_year, setTrackPLineYear] = useState("");
  const [track_p_line_owner, setTrackPLineOwner] = useState("Woss Music");
  const [track_sample_length, setTrackSampleLength] = useState("01:00");
  const [track_tiktok_start, setTrackTikTokStart] = useState("00:00");
  const [track_volume, setTrackVolume] = useState("Vol.1");
  const [track_type, setTrackType] = useState("");
  const [track_recording_country, setTrackRecordingCountry] = useState("");
  const [track_apple_digital_master, setTrackAppleDigitalMaster] = useState("No");
  const [, setRelease] = useState(null);
  const [totalFilesForRelease, setTotalFilesForRelease] = useState(1);
  const [, setTracksMissing] = useState(false);

    const [tabWarnings, setTabWarnings] = useState({
    details: false,
    contributors: false,
    metadata: false,
    audio: false,
    publishing: false,
  });

  // Roles that actually have Role Types (keep in sync with UI).
  const roleTypesMap = React.useMemo(
    () => ({
      Composer: [
        "Additional","All Music by","Arrangement","Co-Composer","Composition",
        "Featured","Music","Music by","Original","Other Synths","Vocal"
      ],
      Producer: [
        "Additional","Assistant","Executive", "Producer","Remix & Production","Recording",
        "Original","Featured","Vocal","Film","Series","Video"
      ],
      // Optional: include if you expose it in the Tracks UI
      Vocals: [
        "Additional Vocal Effects","Additional Vocal Recording","Additional Vocals","Boy Alto",
        "Boy Soprano","Choral Backing Vocals","Chorister","Choir","Counter-Tenor","Descant",
        "Duet","Falsetto","Female Chorus","Junior Vocals","Lead","Lead Vocal Recording",
        "Mezzo-Soprano","Rapper","Solo","Solo Domra","Solo Soprano","Soprano","Spoken Voice",
        "Vocal","Vocal & Instrumental Ensemble","Vocal Bed","Vocal Direction Assistant",
        "Vocal Ensemble","Vocal Recording","Voice","Voice Over","Voices","Whispers","Yells"
      ],
    }),
    []
  );

  const roleHasTypes = useCallback(
    (role) => Array.isArray(roleTypesMap[role]) && roleTypesMap[role].length > 0,
    [roleTypesMap]
  );

  // -------------------- WARNINGS --------------------
  useEffect(() => {
    if (!uploadedFiles || uploadedFiles.length === 0) {
      setTabWarnings({
        details: true,
        contributors: true,
        metadata: true,
        audio: true,
        publishing: true,
        isrc: true,
      });
      return;
    }

    const detailsWarning = uploadedFiles.some((file) => {
      const artists = JSON.parse(file.track_artists_json || "[]");
      const parentalNoticeMissing =
        !file.track_parental ||
        file.track_parental === "" ||
        file.track_parental === "Select Parental Advisory Notice";
      return !file.track_title || artists.length === 0 || parentalNoticeMissing;
    });

    // ✅ Role Type is required ONLY when the role has predefined types.
    const contributorsWarning = uploadedFiles.some((file) => {
      const contributors = JSON.parse(file.track_contributors_json || "[]");
      return (
        contributors.length === 0 ||
        contributors.some((c) => {
          const needsRoleType = roleHasTypes(c?.role);
          return !c?.category || !c?.role || (needsRoleType && !c?.roleType);
        })
      );
    });

    const metadataWarning = uploadedFiles.some(
      (file) =>
        !file.track_primary_genre ||
        !file.track_metadata_language ||
        !file.track_metadata_country ||
        !file.track_audio_language ||
        !file.track_p_line_year
    );

    const audioWarning = uploadedFiles.some(
      (file) => !file.track_recording_country?.trim() || !file.track_type?.trim()
    );

    const publishingWarning = uploadedFiles.some(
      (file) => !file.track_publisher_name || !file.track_work_title
    );

    const isrcWarning = uploadedFiles.some(
      (file) => !file.track_isrc || file.track_isrc.trim() === ""
    );

    setTabWarnings({
      details: detailsWarning,
      contributors: contributorsWarning,
      metadata: metadataWarning,
      audio: audioWarning,
      publishing: publishingWarning,
      isrc: isrcWarning,
    });
  }, [uploadedFiles, roleHasTypes]);



  // Bubble up to NewRelease
  useEffect(() => {
    const anyTrackWarning = Object.values(tabWarnings).some((w) => w === true);
    setSectionWarnings((prev) => ({
      ...prev,
      tracks: anyTrackWarning,
    }));
  }, [tabWarnings, setSectionWarnings]);

  useEffect(() => {
    if (setTracksMissing) {
      setTracksMissing((prev) => ({
        ...prev,
        tracks: uploadedFiles.length === 0,
      }));
    }
  }, [uploadedFiles, setTracksMissing]);

  useEffect(() => {
    setTracksMissing(uploadedFiles.length === 0);
  }, [uploadedFiles]);

  // -------------------- FETCH BASICS --------------------
  useEffect(() => {
    const fetchRelease = async () => {
      if (!resolvedReleaseId) return;
      const token = localStorage.getItem("woss_token");
      if (!token) return;

      try {
        const res = await fetch(
          `http://localhost:4000/api/user/releases/${resolvedReleaseId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (data.success && data.release) {
          setProductReleaseDate(data.release.product_release_date?.slice(0, 10) || "");
        }
      } catch (err) {
        console.error("❌ Error fetching release:", err);
      }
    };

    fetchRelease();
  }, [resolvedReleaseId]);

  useEffect(() => {
    const fetchTotalFiles = async () => {
      if (!resolvedReleaseId) return;
      try {
        const token = localStorage.getItem("woss_token");
        const res = await axios.get(
          `http://localhost:4000/api/user/releases/${resolvedReleaseId}/tracks-count`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setTotalFilesForRelease(res.data.count || 1);
      } catch (err) {
        console.error("❌ Error fetching total files for release:", err);
        setTotalFilesForRelease(1);
      }
    };

    fetchTotalFiles();
  }, [resolvedReleaseId]);

  const updateTrackField = async (trackId, field, value) => {
    const token = localStorage.getItem("woss_token");
    try {
      await fetch(`http://localhost:4000/api/user/tracks/${trackId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          [field]: JSON.stringify(value),
        }),
      });
    } catch (err) {
      console.error(`❌ Failed to update ${field}:`, err);
    }
  };

  useEffect(() => {
    const fetchReleaseDetails = async () => {
      if (!resolvedReleaseId) return;
      const token = localStorage.getItem("woss_token");
      try {
        const res = await fetch(`http://localhost:4000/api/user/releases/${resolvedReleaseId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        if (data.success) {
          const releaseData = data.release;
          setRelease(releaseData);

          const parsedArtists = JSON.parse(releaseData.artists_json || "[]");
          const structured = parsedArtists.map((name) => ({ name }));

          if ((releaseType === "EP" || releaseType === "Album") && Array.isArray(data.tracks)) {
            data.tracks.forEach((track) => {
              let currentArtists = [];

              try {
                currentArtists = track.track_artists_json
                  ? JSON.parse(track.track_artists_json)
                  : [];
              } catch (e) {
                console.warn("Error parsing artists for track", track.id);
              }

              const namesSet = new Set(currentArtists.map((a) => a.name));
              namesSet.add(projectName);

              const newStructured = Array.from(namesSet).map((name) => ({ name }));

              if (namesSet.size !== currentArtists.length) {
                fetch(`http://localhost:4000/api/user/tracks/${track.id}`, {
                  method: "PUT",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    artists_json: JSON.stringify(Array.from(namesSet)),
                    track_artists_json: JSON.stringify(newStructured),
                  }),
                });
              }
            });

            await fetch(`http://localhost:4000/api/user/releases/${resolvedReleaseId}`, {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                artists_json: JSON.stringify([projectName]),
              }),
            });
          }

          if (releaseData.release_type === "Single" && parsedArtists.length) {
            await fetch(
              `http://localhost:4000/api/user/releases/${resolvedReleaseId}/tracks/update-artists`,
              {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  track_artists_json: JSON.stringify(structured),
                }),
              }
            );
          }
        }
      } catch (err) {
        console.error("❌ Failed to fetch release:", err);
      }
    };

    if (resolvedReleaseId) {
      fetchReleaseDetails();
    }
  }, [resolvedReleaseId, releaseType, projectName]);

   // debounce timers for field saves (per track+field)
  const saveTimersRef = useRef({});

  const saveTrackField = (trackId, field, value) => {
    const token = localStorage.getItem("woss_token");
    if (!token) return;

    // ✅ Optimistic local update so the input doesn't flash/revert while typing
    setUploadedFiles((prev) =>
      prev.map((file) => (file.id === trackId ? { ...file, [field]: value } : file))
    );

    // ✅ Debounce network call to avoid a PUT per keystroke
    const key = `${trackId}:${field}`;
    if (saveTimersRef.current[key]) {
      clearTimeout(saveTimersRef.current[key]);
    }

    saveTimersRef.current[key] = setTimeout(async () => {
      try {
        await axios.put(
          `http://localhost:4000/api/user/tracks/${trackId}`,
          { [field]: value },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (err) {
        console.error(`❌ Failed to save ${field}:`, err);
        // Optional: show a toast; usually no need to revert local state
      } finally {
        delete saveTimersRef.current[key];
      }
    }, 400); // adjust debounce window if desired
  };

  const fetchTracks = useCallback(async () => {
    if (!resolvedReleaseId) return;
    try {
      const token = localStorage.getItem("woss_token");

      const res = await axios.get(
        `http://localhost:4000/api/user/releases/${resolvedReleaseId}/tracks`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.data.success) {
        const normalizedTracks = res.data.tracks.map((track) => {
          let parsedArtists = [];
          let parsedContributors = [];

          try {
            parsedArtists = track.track_artists_json ? JSON.parse(track.track_artists_json) : [];
          } catch {}

          try {
            parsedContributors = track.track_contributors_json
              ? JSON.parse(track.track_contributors_json)
              : [];
          } catch {}

          if (releaseType === "Single" && parsedArtists.length === 0 && projectName) {
            parsedArtists = [{ name: projectName }];
            track.track_artists_json = JSON.stringify(parsedArtists);
          }

          return {
            ...track,
            id: track.id,
            public_id: track.public_id,
            audio_url: `http://localhost:4000/api/user/tracks/${track.id}/play`,
            status: track.status?.toLowerCase() || "uploading",
            track_file_name: track.track_file_name,
            track_duration: track.track_duration,
            track_artists_json: JSON.stringify(parsedArtists),
            track_contributors_json: JSON.stringify(parsedContributors),
            track_display_title:
              track.track_display_title || track.track_title || track.track_file_name || "-",
          };
        });

        setUploadedFiles(normalizedTracks);

        if (typeof setSectionWarnings === "function") {
          setSectionWarnings((prev) => ({
            ...prev,
            tracks: normalizedTracks.length === 0,
          }));
        }
      } else {
        if (typeof setSectionWarnings === "function") {
          setSectionWarnings((prev) => ({
            ...prev,
            tracks: true,
          }));
        }
      }
    } catch (error) {
      console.error("Error loading saved tracks:", error);
      if (typeof setSectionWarnings === "function") {
        setSectionWarnings((prev) => ({
          ...prev,
          tracks: true,
        }));
      }
    }
  }, [resolvedReleaseId, releaseType, projectName, setSectionWarnings]);

  useEffect(() => {
    if (resolvedReleaseId) {
      fetchTracks();
    }
  }, [resolvedReleaseId, fetchTracks]);


  // ---------- Deep-link auto-expand ----------
  // 1) Legacy param style: /track/:trackId
  useEffect(() => {
    if (!trackId || uploadedFiles.length === 0) return;
    const t = uploadedFiles.find((f) => f.public_id === trackId);
    if (t) setExpandedRow(t.id);
  }, [trackId, uploadedFiles]);

  // 2) Preferred query style: ?track=<publicTrackId>
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const qTrack = qs.get("track");
    if (!qTrack || uploadedFiles.length === 0) return;
    const t = uploadedFiles.find((f) => f.public_id === qTrack);
    if (t) setExpandedRow(t.id);
  }, [location.search, uploadedFiles]);

  useEffect(() => {
    const fetchArtwork = async () => {
      const token = localStorage.getItem("woss_token");
      if (!token) return;

      const idToUse =
        resolvedReleaseId ||
        Number(localStorage.getItem("currentReleaseId") || "") ||
        null;
      if (!idToUse) return;

      try {
        const res = await fetch(`http://localhost:4000/api/user/releases/${idToUse}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && data.release?.artwork_url) {
          setReleaseImageUrl(`http://localhost:4000${data.release.artwork_url}`);
        }
      } catch (err) {
        console.error("Error fetching release artwork:", err);
      }
    };

    fetchArtwork();
  }, [resolvedReleaseId]);

  useEffect(() => {
    const fetchProjectName = async () => {
      try {
        const token = localStorage.getItem("woss_token");
        if (!token) return;

        const { data } = await axios.get("http://localhost:4000/api/auth/profile/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (data.success && data.profile?.project_name) {
          const name = data.profile.project_name;
          setProjectName(name);
        }
      } catch (err) {
        console.error("Error fetching project name:", err);
      }
    };

    fetchProjectName();
  }, [setArtists]);

  const updateISRC = useCallback((fileId, newISRC) => {
    setUploadedFiles((prevFiles) =>
      prevFiles.map((file) => {
        if (file.id !== fileId) return file;
        if (file.isrc === newISRC) return file;
        return { ...file, isrc: newISRC };
      })
    );
  }, []);

  const [uploadError, setUploadError] = useState(null);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // ---------- Build a BASE LIST path that stays on Tracks ----------
  const isNewSchemeTracks = /\/app\/portal\/catalog\/tracks\/[^/]+/.test(location.pathname);
  const baseListPath = publicId
    ? (isNewSchemeTracks
        ? `/app/portal/catalog/tracks/${publicId}`
        : `/app/portal/catalog/core-info/${publicId}/tracks`)
    : slug
    ? `/app/portal/new-release/${slug}/tracks`
    : null;

  // ✅ Toggle Row Expansion (stay on Tracks via ?track=public_id)
  const toggleRowExpansion = (fileId) => {
    setExpandedRow((prev) => {
      const next = prev === fileId ? null : fileId;

      if (baseListPath) {
        const file = uploadedFiles.find((f) => f.id === fileId);
        if (next && file?.public_id) {
          navigate(`${baseListPath}?track=${encodeURIComponent(file.public_id)}`, {
            replace: false,
          });
        } else {
          navigate(baseListPath, { replace: false });
        }
      }

      return next;
    });
  };

// ✅ Frontend: safer replace handler (Tracks.js)
const handleFileReplace = async (event, trackId) => {
  const file = event.target.files?.[0];
  if (!file) return;

  // Accept common WAV MIME variants and fallback to extension check
  const okTypes = ["audio/wav", "audio/wave", "audio/x-wav"];
  const looksLikeWav = okTypes.includes(file.type) || /\.wav$/i.test(file.name);
  if (!looksLikeWav) {
    alert("Only WAV files (.wav) are allowed.");
    return;
  }

  const token = localStorage.getItem("woss_token");
  if (!token) return;

  try {
    const fd = new FormData();
    // Append under multiple common field names so the backend can read at least one
    fd.append("track_file", file);
    fd.append("file", file);
    fd.append("track_file_name", file.name);

    const res = await axios.put(
      `http://localhost:4000/api/user/tracks/${trackId}/replace`,
      fd,
      {
        headers: { Authorization: `Bearer ${token}` }, // axios sets multipart boundary automatically
        withCredentials: true,
      }
    );

    await fetchTracks();
    await syncDistributionJson();
  } catch (err) {
    const msg =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err.message ||
      "Unknown error";
    console.error("❌ Failed to replace track:", err);
    alert(`Failed to replace track.\n${msg}`);
  }
};


  const handleFileInputChange = (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== "audio/wav") {
      alert("Only WAV files are allowed.");
      return;
    }

    if (releaseType === "Single" && uploadedFiles.length >= 1) {
      alert("Only one track is allowed for a Single release.");
      return;
    }

    const tempId = Date.now();
    const audio = new Audio(URL.createObjectURL(file));

    setUploadedFiles((prev) => [
      ...prev,
      {
        id: tempId,
        track_file_name: file.name,
        audio_url: URL.createObjectURL(file),
        status: "uploading",
      },
    ]);

    audio.onloadedmetadata = async () => {
      const duration = audio.duration;
      const token = localStorage.getItem("woss_token");
      if (!resolvedReleaseId || !token) {
        console.error("❌ Missing resolvedReleaseId or token.");
        return;
      }

      try {
        const formData = new FormData();
        formData.append("track_file", file);
        formData.append("track_duration", formatTime(duration));
        formData.append("track_isrc", file.track_isrc || "");
        formData.append("track_title", file.track_title || "");
        formData.append("track_display_title", file.track_display_title || "");
        formData.append("track_version", file.track_version || "");
        formData.append("track_primary_genre", file.track_primary_genre || "");
        formData.append("track_sub_genre", file.track_sub_genre || "");
        formData.append("track_metadata_language", file.track_metadata_language || "");
        formData.append("track_metadata_country", file.track_metadata_country || "");
        formData.append("track_audio_language", file.track_audio_language || "");

        if (releaseType === "Single") {
          const contributorRes = await fetch(
            `http://localhost:4000/api/user/releases/${resolvedReleaseId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const contributorData = await contributorRes.json();
          if (contributorData.success && contributorData.release?.contributors_json) {
            formData.append("track_contributors_json", contributorData.release.contributors_json);
          }
        }

        formData.append("track_p_line_year", file.track_p_line_year || "");
        formData.append("track_p_line_owner", file.track_p_line_owner || "");
        formData.append("track_recording_country", file.track_recording_country || "");
        formData.append("track_apple_digital_master", file.track_apple_digital_master || "No");
        formData.append("track_sample_length", file.track_sample_length || "01:00");
        formData.append("track_tiktok_start", file.track_tiktok_start || "00:00");
        formData.append("track_type", file.track_type || "");
        formData.append(
          "track_publisher_name",
          file.track_publisher_name || "Woss Music Publishing Group"
        );
        formData.append("track_work_title", file.track_work_title || "");
        formData.append("track_split_percentage", file.track_split_percentage || "15%");
        formData.append("track_publishing_country", file.track_publishing_country || "");
        formData.append("track_rights_admin", file.track_rights_admin || "Woss Music");
        formData.append("track_affiliation", file.track_affiliation || "Warner Chappell Music");
        formData.append("track_wmg_filename", file.track_wmg_filename || "");

        // Upload
        const response = await axios.post(
          `http://localhost:4000/api/user/releases/${resolvedReleaseId}/tracks`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data",
            },
          }
        );

        const newTrackId = response.data.track_id;
        console.log("✅ Track uploaded successfully");

        await syncDistributionJson();
        await fetchTracks();

        if (uploadedFiles.length === 0) {
          setExpandedRow(newTrackId);
        }

        schedulingRef?.current?.refreshDistributionData();
      } catch (err) {
        console.error("❌ Upload failed:", err);
      }
    };
  };

  const handleDelete = async (trackIdLocal) => {
    const token = localStorage.getItem("woss_token");
    if (!token) return;
    try {
      await axios.delete(`http://localhost:4000/api/user/tracks/${trackIdLocal}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await syncDistributionJson();

      setUploadedFiles((prev) => {
        const updated = prev.filter((file) => file.id !== trackIdLocal);

        if (typeof setSectionWarnings === "function") {
          setSectionWarnings((prevWarnings) => ({
            ...prevWarnings,
            tracks: updated.length === 0,
          }));
        }

        // If we deleted the expanded one, also clean the query (stay on Tracks)
        if (expandedRow === trackIdLocal && baseListPath) {
          navigate(baseListPath, { replace: false });
        }

        return updated;
      });
    } catch (err) {
      console.error("❌ Failed to delete track:", err);
    }
  };

  const syncDistributionJson = async () => {
    const token = localStorage.getItem("woss_token");
    if (!token || !resolvedReleaseId) return;

    try {
      const releaseRes = await axios.get(
        `http://localhost:4000/api/user/releases/${resolvedReleaseId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const currentTerritory = releaseRes.data?.release?.territory || "Worldwide";
      const currentExclusivity = releaseRes.data?.release?.partner_exclusivity || "All Partners";

      const syncRes = await axios.post(
        `http://localhost:4000/api/user/releases/${resolvedReleaseId}/sync-distribution-json`,
        null,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      let distributionData = syncRes.data?.distribution_json || [];

      const hasTracks = distributionData.some((dist) =>
        dist.volumes?.some((vol) => vol.tracks?.length > 0)
      );
      if (!hasTracks) {
        await axios.put(
          `http://localhost:4000/api/user/releases/${resolvedReleaseId}`,
          { distribution_json: null },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log("✅ distribution_json cleared (no tracks).");
        schedulingRef?.current?.refreshDistributionData();
        return;
      }

      distributionData = distributionData.map((dist) => ({
        ...dist,
        territory: currentTerritory,
        exclusivity: currentExclusivity,
      }));

      await axios.put(
        `http://localhost:4000/api/user/releases/${resolvedReleaseId}`,
        { distribution_json: JSON.stringify(distributionData) },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log("✅ distribution_json synced with latest territory/exclusivity.");
      schedulingRef?.current?.refreshDistributionData();
    } catch (err) {
      console.error("❌ Failed to sync distribution_json:", err);
    }
  };

  // -------------------- Sortable list --------------------
  const DragHandle = SortableHandle(({ disabled }) => (
    <FaGripVertical
      className="text-muted"
      style={{ cursor: disabled ? "not-allowed" : "grab", pointerEvents: disabled ? "none" : "auto" }}
    />
  ));

  const SortableListForTracks = SortableContainer(
    ({ files, toggleRowExpansion, expandedRow, onDelete, activeTab, setActiveTab }) => (
      <div>
        <ColumnTitles />
        {files.map((file, index) => (
          <SortableItemForTracks
            key={`track-${file.id}`}
            index={index}
            file={file}
            toggleRowExpansion={toggleRowExpansion}
            expandedRow={expandedRow}
            onDelete={onDelete}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        ))}
      </div>
    )
  );

  const ColumnTitles = () => (
    <div className="row bg-dark text-white py-3 px-4 rounded mb-2 mt-2">
      <div className="col-6 col-md-2 text-center">
        <strong>Track Title</strong>
      </div>
      <div className="col-5 text-center d-none d-md-block">
        <strong>Playback</strong>
      </div>
      <div className="col-4 col-md-2 text-center d-none d-md-block">
        <strong>ISRC</strong>
      </div>
      <div className="col-2 text-center">
        <strong>Status</strong>
      </div>
    </div>
  );

  const SortableItemBase = React.memo(
    ({ file, toggleRowExpansion, expandedRow, onDelete, activeTab, setActiveTab }) => (
      <div className="row bg-dark text-white py-3 px-4 rounded mb-2 mt-2 d-flex align-items-center justify-content-between">
        <div className="col-auto text-center d-none d-md-block">
          <DragHandle disabled={isReadOnly} />
        </div>

        <div className="col-2 col-md-3 text-truncate">
          <strong>{file.track_display_title || file.track_title || ""}</strong>
        </div>

        <div className="col-3 mr-6 text-center d-none d-md-block">
          <audio controls>
            <source
              src={`http://localhost:4000/uploads/tracks/${file.track_file_name}`}
              type="audio/wav"
            />
          </audio>
        </div>

        <div className="col-2 col-md-2 text-center d-none d-md-block">
          <ISRCInput
            file={file}
            updateISRC={updateISRC}
            saveTrackField={saveTrackField}
            refreshTracksData={fetchTracksData}
            isReadOnly={isReadOnly}
          />
        </div>

        <div className="col-1 d-flex align-items-center justify-content-start">
          {(() => {
            const rawStatus = (file.status || "uploading").toLowerCase();
            let statusClass = "text-warning";
            let label = "Uploading";

            if (rawStatus === "ready") {
              statusClass = "text-success";
              label = "Ready";
            } else if (rawStatus === "error") {
              statusClass = "text-danger";
              label = "Error";
            }

            return (
              <>
                <div
                  className={`status-dot me-2 bg-${statusClass.replace("text-", "")}`}
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                  }}
                ></div>
                <div
                  className={`status-text ${statusClass}`}
                  style={{
                    fontSize: "13px",
                    fontWeight: "bold",
                  }}
                >
                  {label}
                </div>
              </>
            );
          })()}
        </div>

        <div className="col-auto text-center d-flex justify-content-end">
          <Button
            size="sm"
            color="danger"
            className="me-2"
            disabled={isReadOnly}
            style={isReadOnly ? { cursor: "not-allowed" } : undefined}
            onClick={(event) => {
              event.stopPropagation();
              if (!isReadOnly) onDelete(file.id);
            }}
          >
            <FaTrash style={{ pointerEvents: "none" }} />
          </Button>

          <Button
            size="sm"
            color="light"
            onClick={(event) => {
              event.stopPropagation();
              toggleRowExpansion(file.id);
            }}
          >
            {expandedRow === file.id ? (
              <FaChevronUp style={{ pointerEvents: "none" }} />
            ) : (
              <FaChevronDown style={{ pointerEvents: "none" }} />
            )}
          </Button>
        </div>

        {/* Expanded Row Content */}
        {expandedRow === file.id && (
          <div className="col-12 mt-3">
            <Nav tabs>
              {[
                { id: "details", label: "Details & Artists" },
                { id: "contributors", label: "Contributors" },
                { id: "metadata", label: "Other Metadata" },
                { id: "audio", label: "Audio Specs" },
                { id: "publishing", label: "Publishing" },
              ].map((tab) => (
                <NavItem key={tab.id}>
                  <Button
                    color={activeTab === tab.id ? "primary" : "link"}
                    onClick={() => setActiveTab(tab.id)}
                    style={{ position: "relative" }}
                  >
                    {tab.label}

                    {tab.id === "details" && tabWarnings.details && (
                      <CustomInfoIcon className="ml-1" size="1.1em" />
                    )}
                    {tab.id === "contributors" && tabWarnings.contributors && (
                      <CustomInfoIcon className="ml-1" size="1.1em" />
                    )}
                    {tab.id === "metadata" && tabWarnings.metadata && (
                      <CustomInfoIcon className="ml-1" size="1.1em" />
                    )}
                    {tab.id === "audio" && tabWarnings.audio && (
                      <CustomInfoIcon className="ml-1" size="1.1em" />
                    )}
                    {tab.id === "publishing" && tabWarnings.publishing && (
                      <CustomInfoIcon className="ml-1" size="1.1em" />
                    )}
                  </Button>
                </NavItem>
              ))}
            </Nav>

            <TabContent activeTab={activeTab} className="mt-4 mb-4">
              <TabPane tabId="details">
                {projectName && (
                  <DetailsAndArtists
                    file={file}
                    fullArtists={fullArtists}
                    saveTrackField={saveTrackField}
                    releaseType={releaseType}
                    projectName={projectName}
                    updateReleaseArtistsFromTracks={updateReleaseArtistsFromTracks}
                    setTabWarnings={setTabWarnings}
                    isReadOnly={isReadOnly}
                  />
                )}
              </TabPane>

              <TabPane tabId="contributors">
                <Contributors
                  contributors={
                    file.track_contributors_json ? JSON.parse(file.track_contributors_json) : []
                  }
                  setContributors={(newList) =>
                    updateTrackField(file.id, "track_contributors_json", newList)
                  }
                  releaseType={releaseType}
                  file={file}
                  saveTrackField={saveTrackField}
                  setTabWarnings={setTabWarnings}
                  isReadOnly={isReadOnly}
                />
              </TabPane>

              <TabPane tabId="metadata">
                <Metadata
                  file={file}
                  track_primary_genre={track_primary_genre}
                  setTrackPrimaryGenre={setTrackPrimaryGenre}
                  track_sub_genre={track_sub_genre}
                  setTrackSubGenre={setTrackSubGenre}
                  track_metadata_language={track_metadata_language}
                  setTrackMetadataLanguage={setTrackMetadataLanguage}
                  track_metadata_country={track_metadata_country}
                  setTrackMetadataCountry={setTrackMetadataCountry}
                  track_audio_language={track_audio_language}
                  setTrackAudioLanguage={setTrackAudioLanguage}
                  track_p_line_year={track_p_line_year}
                  setTrackPLineYear={setTrackPLineYear}
                  track_p_line_owner={track_p_line_owner}
                  setTrackPLineOwner={setTrackPLineOwner}
                  saveTrackField={saveTrackField}
                  isReadOnly={isReadOnly}
                />
              </TabPane>

              <TabPane tabId="audio">
                <AudioSpecs
                  file={file}
                  handleFileReplace={handleFileReplace}
                  totalFilesForRelease={totalFilesForRelease}
                  track_recording_country={track_recording_country}
                  setTrackRecordingCountry={setTrackRecordingCountry}
                  track_apple_digital_master={track_apple_digital_master}
                  setTrackAppleDigitalMaster={setTrackAppleDigitalMaster}
                  track_sample_length={track_sample_length}
                  setTrackSampleLength={setTrackSampleLength}
                  track_tiktok_start={track_tiktok_start}
                  setTrackTikTokStart={setTrackTikTokStart}
                  track_volume={track_volume}
                  setTrackVolume={setTrackVolume}
                  track_type={track_type}
                  setTrackType={setTrackType}
                  saveTrackField={saveTrackField}
                  schedulingRef={schedulingRef}
                  isReadOnly={isReadOnly}
                />
              </TabPane>

              <TabPane tabId="publishing">
                <Publishing
                  file={file}
                  saveTrackField={saveTrackField}
                  isHoveredPublisher={isHoveredPublisher}
                  setIsHoveredPublisher={setIsHoveredPublisher}
                  isHoveredWorkTitle={isHoveredWorkTitle}
                  setIsHoveredWorkTitle={setIsHoveredWorkTitle}
                  isHoveredSplitPercentage={isHoveredSplitPercentage}
                  setIsHoveredSplitPercentage={setIsHoveredSplitPercentage}
                  isHoveredCountry={isHoveredCountry}
                  setIsHoveredCountry={setIsHoveredCountry}
                  isHoveredRights={isHoveredRights}
                  setIsHoveredRights={setIsHoveredRights}
                  isHoveredAffiliation={isHoveredAffiliation}
                  setIsHoveredAffiliation={setIsHoveredAffiliation}
                  track_work_title={file.track_work_title}
                  track_publishing_country={file.track_publishing_country}
                  isReadOnly={isReadOnly}
                />
              </TabPane>
            </TabContent>
          </div>
        )}
      </div>
    )
  );

  const SortableItemForTracks = SortableElement(SortableItemBase);

  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (uploadError) {
      setFadeOut(false);
      const fadeTimer = setTimeout(() => setFadeOut(true), 2500);
      const clearTimer = setTimeout(() => setUploadError(null), 4000);
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(clearTimer);
      };
    }
  }, [uploadError]);

  return (
    <div>
      <NewReleaseCard
        releaseImageUrl={releaseImageUrl}
        releaseId={resolvedReleaseId}
        releaseTitle={releaseTitle}
        displayTitle={displayTitle}
        releaseArtists={releaseArtists}
        setArtists={setArtists}
        releaseDate={productReleaseDate}
        releaseGenre={releaseGenre}
        releaseType={releaseType}
        releaseFormat="Digital, Audio"
        project={projectName || project}
        audioLanguage={audioLanguage}
        gpidType={gpidType}
        code={code || "Creating..."}
        cLineYear={cLineYear}
        cLineOwner={cLineOwner}
        label="Woss Music"
      />

      <Card className="shadow-card mt-4 mb-5">
        <CardHeader className="custom-card-header mb--4">
          <h2 className="text-white">Tracks ({uploadedFiles.length})</h2>
          <div className="header-divider"></div>
        </CardHeader>
        <CardBody>
          {uploadedFiles.length > 0 ? (
            <SortableListForTracks
              useDragHandle
              files={uploadedFiles}
              onSortEnd={({ oldIndex, newIndex }) => {
                if (isReadOnly) return;
                setUploadedFiles((prev) => arrayMoveImmutable(prev, oldIndex, newIndex));
              }}
              toggleRowExpansion={toggleRowExpansion}
              expandedRow={expandedRow}
              onDelete={handleDelete}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
          ) : (
            <div className="text-muted text-center mt-3">
              No tracks uploaded. Add one to begin.
            </div>
          )}
          <div>
            {/* Button to Upload Files */}
            {!(releaseType === "Single" && uploadedFiles.length >= 1) && (
              <div className="d-flex justify-content-center mt-3">
                <label
                  htmlFor="file-upload-more"
                  className="btn btn-primary"
                  style={{ cursor: isReadOnly ? "not-allowed" : "pointer" }}
                  onClick={(e) => {
                    if (isReadOnly) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                >
                  Upload WAV File
                </label>
                <input
                  id="file-upload-more"
                  type="file"
                  accept=".wav"
                  style={{ display: "none" }}
                  onChange={handleFileInputChange}
                  disabled={isReadOnly}
                />
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {uploadError && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#f5365c",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            zIndex: 9999,
            fontSize: "0.9rem",
            fontWeight: "bold",
            opacity: fadeOut ? 0 : 1,
            transition: "opacity 1.5s ease-in-out",
          }}
        >
          <div className="d-flex align-items-center justify-content-between">
            <span>{uploadError}</span>
            <button
              className="btn-close ms-3"
              onClick={() => setUploadError(null)}
              style={{ background: "none", border: "none", color: "#fff" }}
            ></button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Tracks;
