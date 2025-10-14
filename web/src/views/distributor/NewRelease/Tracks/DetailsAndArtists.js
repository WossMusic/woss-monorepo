import React, { useState, useEffect } from "react";
import { Row, Col, Input, Button } from "reactstrap";
import { languageOptions } from "components/Data/languages.js";
import { countryOptions } from "components/Data/countries.js";
import { artisttypeOptions } from "components/Data/artistType.js";
import { genreOptions } from "components/Data/genres.js";
import { isDuplicateArtistName } from "components/Custom/isDuplicateArtistName";
import { parentalAdvisoryOptions } from "components/Data/parentalAdvisory.js";
import ArtistsModal from "components/Custom/ArtistsModal";
import Select from "react-select";

// Keep react-select fully opaque while disabled and show "not-allowed" cursor
const roSelectStyles = (locked) => ({
  control: (base) => ({
    ...base,
    cursor: locked ? "not-allowed" : "default",
  }),
  valueContainer: (base) => ({
    ...base,
    cursor: locked ? "not-allowed" : "text",
  }),
  input: (base) => ({
    ...base,
    cursor: locked ? "not-allowed" : "text",
  }),
  singleValue: (base) => ({
    ...base,
    cursor: locked ? "not-allowed" : "default",
  }),
  placeholder: (base) => ({
    ...base,
    cursor: locked ? "not-allowed" : "text",
  }),
  indicatorsContainer: (base) => ({
    ...base,
    cursor: locked ? "not-allowed" : "pointer",
  }),
  dropdownIndicator: (base) => ({
    ...base,
    cursor: locked ? "not-allowed" : "pointer",
  }),
  clearIndicator: (base) => ({
    ...base,
    cursor: locked ? "not-allowed" : "pointer",
  }),
  menu: (base) => ({
    ...base,
    cursor: locked ? "not-allowed" : "default",
  }),
  menuList: (base) => ({
    ...base,
    cursor: locked ? "not-allowed" : "default",
  }),
  option: (base) => ({
    ...base,
    cursor: locked ? "not-allowed" : "pointer",
  }),
});

const DetailsAndArtists = ({
  file,
  setFile,
  fullArtists,
  saveTrackField,
  releaseType,
  projectName,
  updateReleaseArtistsFromTracks,
  setTabWarnings,
  isReadOnly = false,
}) => {
  const [localTitle, setLocalTitle] = useState(file.track_title || "");
  const [localDisplay, setLocalDisplay] = useState(file.track_display_title || "");
  const [localVersion, setLocalVersion] = useState(file.track_version || "");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const toggleArtistModal = () => {
    if (isReadOnly) return;
    setIsModalOpen(!isModalOpen);
  };
  const [showNewArtistModal, setShowNewArtistModal] = useState(false);
  const toggleModal = () => setShowNewArtistModal(!showNewArtistModal);
  const [newArtist, setNewArtist] = useState({ displayName: "", country: "", genre: "", type: "" });
  const [parentalNotice, setParentalNotice] = useState(file.track_parental || "");
  const [trackArtists, setTrackArtists] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [showError, setShowError] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [messageType, setMessageType] = useState("warning");

  // shared styles for read-only inputs
  const roInputStyle = isReadOnly
    ? { backgroundColor: "#ced4da", color: "#000", borderColor: "#ced4da", cursor: "not-allowed" }
    : {};
  const roCursor = isReadOnly ? { cursor: "not-allowed" } : {};

  const isArtistAlreadyInOtherTracks = async (nameToCheck) => {
    const token = localStorage.getItem("woss_token");
    const releaseId = localStorage.getItem("currentReleaseId");
    if (!token || !releaseId || !nameToCheck) return false;

    try {
      const res = await fetch(`http://localhost:4000/api/user/releases/${releaseId}/tracks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success || !Array.isArray(data.tracks)) return false;

      const normalizedName = nameToCheck.trim().toLowerCase();
      for (const track of data.tracks) {
        if (track.id === file.id) continue;
        let trackArtists = [];
        try {
          trackArtists = JSON.parse(track.track_artists_json || "[]");
        } catch {
          continue;
        }
        const hasDuplicate = trackArtists.some(
          (a) => a?.name?.trim().toLowerCase() === normalizedName
        );
        if (hasDuplicate) return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleAddArtist = async () => {
    if (isReadOnly) return;
    const token = localStorage.getItem("woss_token");
    const releaseId = localStorage.getItem("currentReleaseId");
    if (!token || !releaseId) return;

    const artistNameTrimmed = newArtist.displayName?.trim();
    if (!artistNameTrimmed) {
      setErrorMessage("Artist name is required.");
      setMessageType("warning");
      setFadeOut(false);
      setShowError(true);
      setTimeout(() => setFadeOut(true), 1500);
      setTimeout(() => setShowError(false), 3000);
      return;
    }

    const isDuplicateInUI = isDuplicateArtistName(
      artistNameTrimmed,
      [...(fullArtists || []), ...(trackArtists || [])]
    );
    const isDuplicateInDB = await isArtistAlreadyInOtherTracks(artistNameTrimmed);

    if (isDuplicateInUI || isDuplicateInDB) {
      setErrorMessage(`Artist "${artistNameTrimmed}" already exists in this release.`);
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
      artist_spotify_url: newArtist.createSpotifyProfile ? "" : newArtist.spotifyId || "",
      artist_apple_url: newArtist.createAppleMusicProfile ? "" : newArtist.appleMusicId || "",
    };

    try {
      const res = await fetch(`http://localhost:4000/api/user/releases/${releaseId}/artists`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        const updated = [...trackArtists, { id: Date.now(), displayName: artistNameTrimmed }];
        setTrackArtists(updated);

        await fetch(`http://localhost:4000/api/user/tracks/${file.id}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            track_artists_json: JSON.stringify(updated.map((a) => ({ name: a.displayName }))),
          }),
        });

        if (["EP", "Album"].includes(releaseType) && typeof updateReleaseArtistsFromTracks === "function") {
          updateReleaseArtistsFromTracks();
        }

        toggleModal();
        setNewArtist({});
      } else {
        setErrorMessage(`Failed to create artist. "${artistNameTrimmed}" already exists.`);
        setMessageType("danger");
        setFadeOut(false);
        setShowError(true);
        setTimeout(() => setFadeOut(true), 1500);
        setTimeout(() => setShowError(false), 3000);
      }
    } catch (err) {
      console.error("❌ Error adding artist:", err);
      setErrorMessage("An unexpected error occurred while adding the artist.");
      setMessageType("danger");
      setFadeOut(false);
      setShowError(true);
      setTimeout(() => setFadeOut(true), 1500);
      setTimeout(() => setShowError(false), 3000);
    }
  };

  // ✅ Move this ABOVE handleRemoveArtist
  const refreshTrack = async (trackId) => {
    const token = localStorage.getItem("woss_token");
    const res = await fetch(`http://localhost:4000/api/user/tracks/${trackId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const updated = await res.json();
    setFile(updated);
  };

  const handleRemoveArtist = async (artistIdToRemove) => {
    if (isReadOnly) return;
    const projectNameMain = trackArtists[0]?.displayName;
    const artistToRemove = trackArtists.find((a) => a.id === artistIdToRemove);

    if (!artistToRemove || artistToRemove.displayName === projectNameMain) {
      alert("You cannot remove the main project artist.");
      return;
    }

    const updated = trackArtists.filter((a) => a.id !== artistIdToRemove);
    setTrackArtists(updated);

    const formattedForDB = updated.map((a) => ({ name: a.displayName }));

    try {
      const token = localStorage.getItem("woss_token");
      await fetch(`http://localhost:4000/api/user/tracks/${file.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ track_artists_json: JSON.stringify(formattedForDB) }),
      });

      await refreshTrack(file.id);
    } catch (err) {
      console.error("❌ Failed to update artists:", err);
    }
  };

  useEffect(() => {
    let parsed = [];
    try {
      parsed = file.track_artists_json ? JSON.parse(file.track_artists_json) : [];
    } catch {}

    // Fallback from release artists (fullArtists) if track-specific is empty
    const fallbackArtists =
      parsed.length === 0 && fullArtists?.length > 0
        ? fullArtists.map((artist, index) => ({
            id: artist.id ?? index,
            displayName:
              artist.artist_name || artist.name || artist.displayName || "Unknown Artist",
          }))
        : [];

    const defaultSingleArtist =
      parsed.length === 0 && releaseType === "Single" && projectName
        ? [{ id: 0, displayName: projectName }]
        : [];

    const artists =
      parsed.length > 0
        ? parsed.map((a, index) => ({
            id: a.id ?? index,
            displayName: a.name || "Unnamed Artist",
          }))
        : fallbackArtists.length > 0
        ? fallbackArtists
        : defaultSingleArtist;

    setTrackArtists(artists);
  }, [file.track_artists_json, fullArtists, releaseType, projectName]);

  useEffect(() => {
    if (typeof setTabWarnings === "function") {
      const titleMissing = !localTitle || localTitle.trim() === "";
      const parentalMissing = !parentalNotice || parentalNotice.trim() === "";
      const isInvalid = titleMissing || parentalMissing;

      setTabWarnings((prev) => {
        if (prev.details === isInvalid) return prev;
        return { ...prev, details: isInvalid };
      });
    }
  }, [localTitle, parentalNotice, setTabWarnings]);

  // Initialize default artist for EP or Album if no track_artists_json
  useEffect(() => {
    if (
      ["EP", "Album", "Single"].includes(releaseType) &&
      (!file.track_artists_json || file.track_artists_json === "[]") &&
      projectName
    ) {
      const token = localStorage.getItem("woss_token");
      const defaultArtist = { name: projectName };
      const initialArtists = [defaultArtist];

      setTrackArtists([{ id: 0, displayName: projectName }]);

      fetch(`http://localhost:4000/api/user/tracks/${file.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          artists_json: JSON.stringify([projectName]),
          track_artists_json: JSON.stringify(initialArtists),
        }),
      }).catch((err) => console.error("❌ Failed to initialize track artist:", err));
    }
  }, [file.id, releaseType, file.track_artists_json, projectName]);

  // Update Display Title when Title or Version changes
  useEffect(() => {
    const titleHasParens = /\(.*\)/.test(localTitle);
    const versionFormatted = localVersion
      ? titleHasParens
        ? `[${localVersion}]`
        : `(${localVersion})`
      : "";
    setLocalDisplay(localVersion ? `${localTitle} ${versionFormatted}` : localTitle);
  }, [localTitle, localVersion]);

  const handleTitleBlur = () => {
    if (isReadOnly) return;
    saveTrackField(file.id, "track_title", localTitle);
    saveTrackField(file.id, "track_display_title", localDisplay);
  };

  const handleVersionBlur = () => {
    if (isReadOnly) return;
    saveTrackField(file.id, "track_version", localVersion);
    const titleHasParens = /\(.*\)/.test(localTitle);
    const versionFormatted = localVersion
      ? titleHasParens
        ? `[${localVersion}]`
        : `(${localVersion})`
      : "";
    const updatedDisplay = localVersion ? `${localTitle} ${versionFormatted}` : localTitle;
    setLocalDisplay(updatedDisplay);
    saveTrackField(file.id, "track_display_title", updatedDisplay);
  };

  return (
    <>
      {showError && (
        <div
          className={`${
            messageType === "danger" ? "danger-popup" : "warning-popup"
          } ${fadeOut ? "fade-out" : ""}`}
        >
          {errorMessage}
        </div>
      )}

      <Row className="mt-3">
        <Col md="4">
          <label className="text-muted">Track Title *</label>
          <Input
            type="text"
            value={localTitle}
            readOnly={isReadOnly}
            onChange={(e) => !isReadOnly && setLocalTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="Enter Track Title"
            className={`form-control ${
              !localTitle.trim() ? "is-invalid thicker-invalid-border" : ""
            }`}
            style={{ ...roInputStyle }}
          />
        </Col>
        <Col md="4">
          <label className="text-muted">Display Title *</label>
          <Input
            type="text"
            value={localDisplay}
            readOnly
            className="border-0"
            style={{ backgroundColor: "#ced4da", color: "#000", borderColor: "#ced4da", cursor: "not-allowed" }}
          />
        </Col>
        <Col md="4">
          <label className="text-muted">Version</label>
          <Input
            type="text"
            value={localVersion}
            readOnly={isReadOnly}
            onChange={(e) => !isReadOnly && setLocalVersion(e.target.value)}
            onBlur={handleVersionBlur}
            placeholder="(Live, Radio Edit, Clean)"
            style={{ ...roInputStyle }}
          />
        </Col>
      </Row>

      <Row className="mt-3">
        <Col md="4">
          <label className="text-muted">Parental Advisory Notice *</label>
          <Select
            styles={roSelectStyles(isReadOnly)}
            className={`react-select2-container ${isReadOnly ? "locked-select" : ""} ${
              !parentalNotice || parentalNotice === "" ? "has-warning" : ""
            }`}
            classNamePrefix="react-select2"
            options={[{ value: "", label: "Select Parental Advisory Notice" }, ...parentalAdvisoryOptions]}
            value={
              parentalAdvisoryOptions.find((opt) => opt.value === parentalNotice) || {
                value: "",
                label: "Select Parental Advisory Notice",
              }
            }
            onChange={(selected) => {
              if (isReadOnly) return;
              const value = selected?.value ?? "";
              setParentalNotice(value);
              saveTrackField(file.id, "track_parental", value);
            }}
            onMouseDown={(e) => {
              if (isReadOnly) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            onTouchStart={(e) => {
              if (isReadOnly) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            placeholder="Select Parental Advisory Notice"
            isClearable
            isDisabled={isReadOnly}
          />
        </Col>
      </Row>

      <Row className="mt-4">
        <Col xs="12">
          <label className="text-muted d-block mb-2">Main Artists</label>
          <div className="sortable-container">
            {trackArtists.length > 0 ? (
              trackArtists.map((artist, index) => (
                <div
                  key={index}
                  className={`bg-primary artist-box d-flex justify-content-between align-items-center ${
                    index === 0 ? "static" : ""
                  }`}
                >
                  <div className="d-flex align-items-center">
                    {index === 0 && <i className="fas fa-star text-white mr-3"></i>}
                    <div className="artist-icon">
                      <i className="fas fa-user-circle"></i>
                    </div>
                    <div className="artist-info">
                      <p className="mb-0">{artist.displayName}</p>
                    </div>
                  </div>

                  {artist.displayName !== projectName && releaseType !== "Single" && (
                    <Button
                      color="danger"
                      size="sm"
                      className="ml-2"
                      style={roCursor}
                      onClick={() => {
                        if (isReadOnly) return;
                        handleRemoveArtist(artist.id);
                      }}
                    >
                      <i className="fas fa-trash-alt"></i>
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-warning">No main artists available</p>
            )}
          </div>

          {["EP", "Album"].includes(releaseType) && (
            <div className="mt-4 text-left">
              <Button color="primary" onClick={toggleArtistModal} style={roCursor}>
                + Add Artist
              </Button>
            </div>
          )}

          <ArtistsModal
            isOpen={isModalOpen}
            toggle={toggleArtistModal}
            addArtistToList={async (artist) => {
              if (isReadOnly) return;
              const newName = artist.artist_name?.trim();
              if (!newName) return;

              const token = localStorage.getItem("woss_token");
              const matched = fullArtists.find((a) => a.artist_name === newName);
              const newArtistObj = matched
                ? { id: matched.id, name: matched.artist_name }
                : { name: newName };

              const updatedArtists = [
                ...trackArtists,
                {
                  id: newArtistObj.id || Date.now(),
                  displayName: newArtistObj.name,
                },
              ];

              setTrackArtists(updatedArtists);

              const formattedForDB = updatedArtists.map((a) => ({
                name: a.displayName,
              }));

              try {
                const payload = {
                  track_artists_json: JSON.stringify(formattedForDB),
                };

                if (releaseType === "Single") {
                  payload.artists_json = JSON.stringify([newName]);
                }

                await fetch(`http://localhost:4000/api/user/tracks/${file.id}`, {
                  method: "PUT",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(payload),
                });

                if (
                  ["EP", "Album"].includes(releaseType) &&
                  typeof updateReleaseArtistsFromTracks === "function"
                ) {
                  updateReleaseArtistsFromTracks();
                }
              } catch (err) {
                console.error("❌ Failed to update track artists:", err);
              }
            }}
            openCreateArtistModal={() => {
              if (isReadOnly) return;
              toggleArtistModal();
              setShowNewArtistModal(true);
            }}
          />
        </Col>
      </Row>

      {showNewArtistModal && (
        <>
          {showError && (
            <div className={`${messageType === "danger" ? "danger-popup" : "warning-popup"} ${fadeOut ? "fade-out" : ""}`}>
              {errorMessage}
            </div>
          )}
          <div className="new-container-overlay" onClick={toggleModal}></div>
          <div className="edit-artist-actions-menu shadow-lg rounded">
            <button className="close-button" onClick={toggleModal}>
              &times;
            </button>

            <h3 className="mb-4 text-white">Create New Artist</h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (isReadOnly) return;
                handleAddArtist();
              }}
            >
              <Row className="mb-3">
                <Col md="6">
                  <label className="text-white">Artist name *</label>
                  <Input
                    className="form-control-alternative text-white bg-primary-dark border-0"
                    type="text"
                    placeholder="Enter Artist Name"
                    value={newArtist.displayName || ""}
                    readOnly={isReadOnly}
                    onChange={(e) =>
                      !isReadOnly && setNewArtist({ ...newArtist, displayName: e.target.value })
                    }
                    required
                    style={{ ...roInputStyle }}
                  />
                </Col>
                <Col md="6">
                  <label className="text-white">Country of Origin *</label>
                  <Select
                    className="react-select-container"
                    classNamePrefix="react-select"
                    options={countryOptions}
                    value={countryOptions.find((opt) => opt.value === newArtist.country) || null}
                    onChange={(selected) =>
                      !isReadOnly && setNewArtist({ ...newArtist, country: selected?.value || "" })
                    }
                    placeholder="Select Country"
                    isClearable
                    isDisabled={isReadOnly}
                    styles={roSelectStyles(isReadOnly)}
                  />
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md="6">
                  <label className="text-white">Artist legal name *</label>
                  <Input
                    className="form-control-alternative text-white bg-primary-dark border-0"
                    type="text"
                    placeholder="Enter Legal Name"
                    value={newArtist.legalName || ""}
                    readOnly={isReadOnly}
                    onChange={(e) =>
                      !isReadOnly && setNewArtist({ ...newArtist, legalName: e.target.value })
                    }
                    required
                    style={{ ...roInputStyle }}
                  />
                </Col>
                <Col md="6">
                  <label className="text-white">Genre *</label>
                  <Select
                    className="react-select-container"
                    classNamePrefix="react-select"
                    options={genreOptions}
                    value={genreOptions.find((opt) => opt.value === newArtist.genre) || null}
                    onChange={(selected) =>
                      !isReadOnly && setNewArtist({ ...newArtist, genre: selected?.value || "" })
                    }
                    placeholder="Select Genre"
                    isClearable
                    isDisabled={isReadOnly}
                    styles={roSelectStyles(isReadOnly)}
                  />
                </Col>
              </Row>

              <Row className="mb-4">
                <Col md="6">
                  <label className="text-white">Artist type *</label>
                  <Select
                    className="react-select-container"
                    classNamePrefix="react-select"
                    options={artisttypeOptions}
                    value={artisttypeOptions.find((opt) => opt.value === newArtist.type) || null}
                    onChange={(selected) =>
                      !isReadOnly && setNewArtist({ ...newArtist, type: selected?.value || "" })
                    }
                    placeholder="Select Artist Type"
                    isClearable
                    isDisabled={isReadOnly}
                    styles={roSelectStyles(isReadOnly)}
                  />
                </Col>
                <Col md="6">
                  <label className="text-white">Language *</label>
                  <Select
                    className="react-select-container"
                    classNamePrefix="react-select"
                    options={languageOptions}
                    value={languageOptions.find((opt) => opt.value === newArtist.language) || null}
                    onChange={(selected) =>
                      !isReadOnly && setNewArtist({ ...newArtist, language: selected?.value || "" })
                    }
                    placeholder="Select Language"
                    isClearable
                    isDisabled={isReadOnly}
                    styles={roSelectStyles(isReadOnly)}
                  />
                </Col>
              </Row>

              <div className="text-white mt-2">
                <p className="small font-weight-500">
                  <i className="fas fa-info-circle me-2 mr-1"></i>
                  Review information before you create a new artist. To make changes later, you'll
                  need to contact your Woss Music Label Manager.
                </p>
              </div>

              <hr className="mb-2" />
              <h4 className="text-white mt-4 mb-3 text-center">
                Digital Service Provider (DSP) IDs
              </h4>
              <hr className="mt-4" />

              <Row className="mb-3">
                <Col md="6">
                  <label className="text-white">Artist Apple Music Profile</label>
                  <div className="d-flex align-items-center">
                    <Input
                      type="text"
                      placeholder="Paste an Apple Music URL or ID"
                      value={newArtist.appleMusicId || ""}
                      readOnly={isReadOnly}
                      onChange={(e) => {
                        if (isReadOnly) return;
                        const inputValue = e.target.value.trim();
                        const isSpotify =
                          /(?:spotify\.com\/.*\/artist\/|spotify:artist:|^spotify:)/i.test(
                            inputValue
                          ) || /^[a-zA-Z0-9]{22}$/.test(inputValue);
                        if (isSpotify) {
                          setErrorMessage("Error because it's a Spotify link or ID");
                          setMessageType("danger");
                          setFadeOut(false);
                          setShowError(true);
                          setTimeout(() => setFadeOut(true), 1500);
                          setTimeout(() => setShowError(false), 3000);
                          return;
                        }
                        const idMatch = inputValue.match(
                          /(?:music\.apple\.com\/[^/]+\/artist\/[^/]+\/)?(\d+)/
                        );
                        const extractedId = idMatch ? idMatch[1] : inputValue;
                        setNewArtist({ ...newArtist, appleMusicId: extractedId });
                      }}
                      className="profile-input"
                      style={{ ...roInputStyle }}
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
                      onClick={(e) => {
                        if (!newArtist.appleMusicId || isReadOnly) e.preventDefault();
                      }}
                      style={roCursor}
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
                        !isReadOnly &&
                        setNewArtist({
                          ...newArtist,
                          createAppleMusicProfile: e.target.checked,
                        })
                      }
                      disabled={isReadOnly}
                    />
                    <label htmlFor="createAppleProfile" className="ms-2">
                      Create Apple Music Profile
                    </label>
                  </div>
                </Col>

                <Col md="6">
                  <label className="text-white">Artist Spotify Profile</label>
                  <div className="d-flex align-items-center">
                    <Input
                      type="text"
                      placeholder="Paste a Spotify URL, URI, or ID"
                      value={newArtist.spotifyId || ""}
                      readOnly={isReadOnly}
                      onChange={(e) => {
                        if (isReadOnly) return;
                        const inputValue = e.target.value.trim();
                        const isAppleMusic =
                          /music\.apple\.com/.test(inputValue) || /^\d{5,}$/.test(inputValue);
                        if (isAppleMusic) {
                          setErrorMessage("Error testing because it's an Apple Music link or ID");
                          setMessageType("danger");
                          setFadeOut(false);
                          setShowError(true);
                          setTimeout(() => setFadeOut(true), 1500);
                          setTimeout(() => setShowError(false), 3000);
                          return;
                        }
                        const idMatch = inputValue.match(
                          /(?:spotify\.com\/.*\/artist\/|spotify:artist:)?([a-zA-Z0-9]{22})/
                        );
                        const extractedId = idMatch ? idMatch[1] : inputValue;
                        setNewArtist({ ...newArtist, spotifyId: extractedId });
                      }}
                      className="profile-input"
                      style={{ ...roInputStyle }}
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
                      onClick={(e) => {
                        if (!newArtist.spotifyId || isReadOnly) e.preventDefault();
                      }}
                      style={roCursor}
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
                        !isReadOnly &&
                        setNewArtist({ ...newArtist, createSpotifyProfile: e.target.checked })
                      }
                      disabled={isReadOnly}
                    />
                    <label htmlFor="createSpotifyProfile" className="ms-2">
                      Create Spotify Profile
                    </label>
                  </div>
                </Col>
              </Row>

              <div className="d-flex justify-content-end mt-4">
                <Button className="me-3" color="darker" onClick={toggleModal}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  color="white"
                  className="px-4"
                  onClick={(e) => {
                    if (isReadOnly) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  style={roCursor}
                >
                  Create New Artist
                </Button>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
};

export default DetailsAndArtists;
