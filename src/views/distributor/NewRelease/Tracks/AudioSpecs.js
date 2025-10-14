import React, { useEffect, useState } from "react";
import { Row, Col, Input } from "reactstrap";
import { countryOptions } from "components/Data/countries";
import { trackTypeOptions } from "components/Data/trackType.js";
import axios from "axios";

const AudioSpecs = ({
  file,
  releaseId,
  schedulingRef,
  track_recording_country,
  setTrackRecordingCountry,
  track_apple_digital_master,
  setTrackAppleDigitalMaster,
  track_sample_length,
  track_tiktok_start,
  setTrackTikTokStart,
  track_volume,
  setTrackVolume,
  track_type,
  setTrackType,
  handleFileReplace,
  saveTrackField,
  isReadOnly = false, // <-- NEW
}) => {
  const [errors, setErrors] = useState({ tiktok: "" });
  const [localTikTok, setLocalTikTok] = useState(track_tiktok_start || "");
  const [localWMGFilename, setLocalWMGFilename] = useState(file.track_wmg_filename || "");
  const [, setRecordingCountryWarning] = useState(false);
  const [, setTrackTypeWarning] = useState(false);

  // simple read-only look for plain inputs/selects
  const roInputStyle = isReadOnly
    ? { backgroundColor: "#ced4da", color: "#000", cursor: "not-allowed" }
    : {};

  // Validate Recording Country
  useEffect(() => {
    setRecordingCountryWarning(!track_recording_country?.trim());
  }, [track_recording_country]);

  // Validate Track Type
  useEffect(() => {
    setTrackTypeWarning(!track_type?.trim());
  }, [track_type]);

  useEffect(() => {
    if (!track_apple_digital_master || track_apple_digital_master === "") {
      setTrackAppleDigitalMaster("No");
      saveTrackField(file.id, "track_apple_digital_master", "No");
    }
  }, [file.id, track_apple_digital_master, setTrackAppleDigitalMaster, saveTrackField]);

  useEffect(() => {
    if (file.track_recording_country) setTrackRecordingCountry(file.track_recording_country);
    if (file.track_type) setTrackType(file.track_type);
  }, [file.track_recording_country, file.track_type, setTrackRecordingCountry, setTrackType]);

  useEffect(() => {
    setLocalWMGFilename(file.track_wmg_filename || "");
  }, [file.track_wmg_filename]);

  const handleSelectChange = (setter, field) => (e) => {
    if (isReadOnly) return;
    const value = e.target.value;
    setter(value);
    saveTrackField(file.id, field, value);
  };

  const handleBlur = (field, value) => {
    if (isReadOnly) return;
    if (field === "track_tiktok_start") {
      const totalDuration = parseDurationToSeconds(file.track_duration);
      const start = parseDurationToSeconds(value);
      if (start > totalDuration) {
        setErrors((prev) => ({ ...prev, tiktok: "Start must be within track duration" }));
        return;
      } else {
        setErrors((prev) => ({ ...prev, tiktok: "" }));
      }
      setTrackTikTokStart(value);
    }
    if (field === "track_volume") {
      setTrackVolume(value);
    }
    saveTrackField(file.id, field, value);
  };

  const parseDurationToSeconds = (durationStr) => {
    const [min, sec] = durationStr?.split(":").map(Number);
    return (min || 0) * 60 + (sec || 0);
  };

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem("woss_token");
      if (!token) {
        alert("You must be logged in to download.");
        return;
      }
      const response = await fetch(`http://localhost:4000/api/user/tracks/${file.id}/play`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Download failed.");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.track_file_name || "track.wav";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 0);
    } catch (err) {
      console.error("Download error:", err);
      alert("Failed to download file.");
    }
  };

  const [volumes, setVolumes] = useState(() => ["Vol.1"]);
  const [localVolume, setLocalVolume] = useState(file.track_volume || "Vol.1");

  // Fetch volumes from DB
  useEffect(() => {
    const fetchVolumes = async () => {
      try {
        const token = localStorage.getItem("woss_token");
        const res = await fetch(
          `http://localhost:4000/api/user/releases/${file.release_id}/track-volumes`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (data.success && Array.isArray(data.volumes)) {
          const dbVolumes = data.volumes;
          const merged = [...new Set(["Vol.1", ...dbVolumes, file.track_volume])].filter(Boolean);
          setVolumes(merged);
        }
      } catch (err) {
        console.error("Failed to fetch volumes", err);
      }
    };

    fetchVolumes();
  }, [file.release_id, file.track_volume]);

  // Update localVolume if file.track_volume changes
  useEffect(() => {
    if (file.track_volume && !volumes.includes(file.track_volume)) {
      setVolumes((prev) => [...prev, file.track_volume]);
    }
    setLocalVolume(file.track_volume || "Vol.1");
  }, [file.track_volume, volumes]);

  const handleVolumeChange = (e) => {
    if (isReadOnly) return;
    const selected = e.target.value;
    setLocalVolume(selected);
    saveTrackField(file.id, "track_volume", selected);
  };

  const addVolume = async () => {
    if (isReadOnly) return;
    const nextVolNum = volumes.length + 1;
    const nextVol = `Vol.${nextVolNum}`;
    if (!volumes.includes(nextVol)) {
      setVolumes((prev) => [...prev, nextVol]);
      setLocalVolume(nextVol);
      saveTrackField(file.id, "track_volume", nextVol);

      const token = localStorage.getItem("woss_token");
      await axios.post(
        `http://localhost:4000/api/user/releases/${file.release_id}/sync-distribution-json`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (schedulingRef && schedulingRef.current) {
        schedulingRef.current.refreshDistributionData();
      } else {
        console.warn("schedulingRef is undefined or missing");
      }
    }
  };

  const removeVolume = () => {
    if (isReadOnly) return;
    const updated = [...volumes];
    if (updated.length > 1) {
      const removed = updated.pop();
      setVolumes(updated);
      if (localVolume === removed) {
        setLocalVolume("Vol.1");
        saveTrackField(file.id, "track_volume", "Vol.1");
      }
    }
  };

  return (
    <>
      <Row className="align-items-center justify-content-between mb-3">
        <Col md="6">
          <label className="text-muted d-block mb-2">Audio Filename</label>
          <Input
            type="text"
            value={file.track_file_name || "Unnamed File"}
            readOnly
            className="w-100 border-0 text-dark"
            style={{ backgroundColor: "#ced4da", color: "#000" }}
          />
        </Col>
        <Col md="6">
          <Row>
            <Col md="6">
              <label className="text-muted d-block text-start">WMG Registered Filename</label>
            </Col>
          </Row>
          <Row className="align-items-center">
            <Col md="8">
              <Input
                type="text"
                value={localWMGFilename}
                readOnly={isReadOnly}
                onChange={(e) => !isReadOnly && setLocalWMGFilename(e.target.value)}
                onBlur={() => handleBlur("track_wmg_filename", localWMGFilename)}
                placeholder="Enter WMG Registered Filename"
                className="w-100 text-dark"
                style={roInputStyle}
              />
            </Col>
            <Col md="4" className="d-flex justify-content-end">
              <button
                className="btn btn-primary me-2"
                onClick={handleDownload}
              >
                Download
              </button>
              <button
                className="btn btn-warning"
                disabled={isReadOnly}
                style={isReadOnly ? { cursor: "not-allowed" } : {}}
                onClick={() => {
                  if (isReadOnly) return;
                  document.getElementById(`replace-file-${file.id}`).click();
                }}
              >
                Replace
              </button>
            </Col>
          </Row>
          <input
            id={`replace-file-${file.id}`}
            type="file"
            accept=".wav"
            style={{ display: "none" }}
            onChange={(event) => {
              if (isReadOnly) return;
              handleFileReplace(event, file.id);
            }}
          />
        </Col>
      </Row>

      <Row className="align-items-center mb-3">
        <Col md="4">
          <label className="text-muted">ISRC *</label>
          <Input
            type="text"
            value={file.track_isrc || ""}
            className="text-dark border-0"
            readOnly
            disabled
            style={{ backgroundColor: "#ced4da", color: "#000" }}
          />
        </Col>

        <Col md="4">
          <label className="text-muted">Recording Country *</label>
          <Input
            type="select"
            value={track_recording_country || ""}
            onChange={handleSelectChange(setTrackRecordingCountry, "track_recording_country")}
            className={!track_recording_country ? "warning-border" : ""}
            disabled={isReadOnly}
            style={roInputStyle}
            onMouseDown={(e) => {
              if (isReadOnly) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            <option value="">Select Recording Country</option>
            {countryOptions.map((country) => (
              <option key={country.value} value={country.value}>
                {country.label}
              </option>
            ))}
          </Input>
        </Col>

        <Col md="4">
          <label className="text-muted">Apple Digital Master Studio</label>
          <Input
            type="text"
            value={track_apple_digital_master || "No"}
            readOnly
            className="text-dark"
            style={{ backgroundColor: "#ced4da", color: "#000" }}
          />
        </Col>
      </Row>

      <Row className="align-items-center mb-3">
        <Col md="3">
          <label className="text-muted">Sample Length</label>
          <Input
            type="text"
            value={track_sample_length}
            readOnly
            className="text-dark"
            style={{ backgroundColor: "#ced4da", color: "#000" }}
          />
        </Col>

        <Col md="3" className="position-relative">
          <label className="text-muted">TikTok Starts</label>
          <Input
            type="text"
            value={localTikTok}
            readOnly={isReadOnly}
            onChange={(e) =>
              !isReadOnly && /^[0-9:]{0,5}$/.test(e.target.value) && setLocalTikTok(e.target.value)
            }
            onBlur={() => handleBlur("track_tiktok_start", localTikTok)}
            className={errors.tiktok ? "border-danger border-2 is-invalid" : ""}
            style={roInputStyle}
          />
          {errors.tiktok && (
            <div
              className="text-danger"
              style={{
                position: "absolute",
                bottom: "-1.5rem",
                left: "1rem",
                fontSize: "0.80rem",
                fontWeight: "500",
              }}
            >
              {errors.tiktok}
            </div>
          )}
        </Col>

        <Col md="3">
          <label className="text-muted">Volume</label>
          <Input
            type="select"
            value={localVolume}
            onChange={handleVolumeChange}
            disabled={isReadOnly}
            style={roInputStyle}
            onMouseDown={(e) => {
              if (isReadOnly) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            {volumes.map((vol) => (
              <option key={vol} value={vol}>
                {vol}
              </option>
            ))}
          </Input>

          {/* Volume Actions */}
          <div style={{ position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: "0.25rem",
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span
                className="text-primary font-weight-bold"
                style={{ cursor: isReadOnly ? "not-allowed" : "pointer", fontSize: "0.8rem" }}
                onClick={addVolume}
              >
                + Volume
              </span>
              {volumes.length > 1 && (
                <span
                  className="text-danger font-weight-bold"
                  style={{ cursor: isReadOnly ? "not-allowed" : "pointer", fontSize: "0.8rem" }}
                  onClick={removeVolume}
                >
                  - Volume
                </span>
              )}
            </div>
          </div>
        </Col>

        <Col md="3">
          <label className="text-muted">Track Type *</label>
          <Input
            type="select"
            value={track_type || ""}
            onChange={handleSelectChange(setTrackType, "track_type")}
            className={!track_type ? "warning-border" : ""}
            disabled={isReadOnly}
            style={roInputStyle}
            onMouseDown={(e) => {
              if (isReadOnly) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            <option value="">Select Track Type</option>
            {trackTypeOptions.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Input>
        </Col>
      </Row>
    </>
  );
};

export default AudioSpecs;
