import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Input } from "reactstrap";
import CustomInfoIcon from "components/Icons/CustomInfoIcon";

const ISRCInput = ({
  file,
  updateISRC,
  saveTrackField,
  refreshTracksData,
  isReadOnly = false, // <-- parent-controlled readOnly
}) => {
  const [localISRC, setLocalISRC] = useState(file.track_isrc || "");
  // Internal lock while generating so users can’t type mid-generation
  const [isWorking, setIsWorking] = useState(false);

  // Effective readOnly: parent lock OR in-progress generation
  const effectiveReadOnly = Boolean(isReadOnly || isWorking);

  useEffect(() => {
    setLocalISRC(file.track_isrc || "");
  }, [file.track_isrc]);

  const handleGenerate = () => {
    if (effectiveReadOnly) return; // respect read-only
    const generatedISRC = "Creating...";
    setIsWorking(true);

    setLocalISRC(generatedISRC);
    updateISRC(file.id, generatedISRC);
    saveTrackField(file.id, "track_isrc", generatedISRC);

    // Simulate async generation -> replace with real API if you have one
    setTimeout(() => {
      const finalISRC = "ISRC Created";
      setLocalISRC(finalISRC);
      updateISRC(file.id, finalISRC);
      saveTrackField(file.id, "track_isrc", finalISRC);
      setIsWorking(false);
      if (typeof refreshTracksData === "function") refreshTracksData();
    }, 2000);
  };

  const handleBlur = async () => {
    if (effectiveReadOnly) return; // don’t write when read-only
    updateISRC(file.id, localISRC);
    await saveTrackField(file.id, "track_isrc", localISRC);
    if (typeof refreshTracksData === "function") {
      refreshTracksData(); // refresh warnings
    }
  };

  const isWarning = !localISRC.trim(); // warn if ISRC empty

  return (
    <div className="d-flex align-items-center position-relative" style={{ width: "100%" }}>
      {/* Reserve space for info icon */}
      <div style={{ width: "1.5em", minWidth: "1.5em" }}>
        {isWarning && <CustomInfoIcon size="1em" color="warning" />}
      </div>

      <Input
        type="text"
        value={localISRC}
        placeholder="Enter ISRC"
        className={`form-control ${isWarning ? "is-invalid thicker-invalid-border" : ""}`}
        readOnly={effectiveReadOnly}
        onChange={(e) => {
          if (effectiveReadOnly) return;
          setLocalISRC(e.target.value);
        }}
        onBlur={handleBlur}
        style={{
          // match the read-only color used elsewhere
          backgroundColor: effectiveReadOnly ? "#e9ecef" : undefined,
          cursor: effectiveReadOnly ? "not-allowed" : undefined,
        }}
        title={effectiveReadOnly ? "Read-only" : undefined}
      />

      <span
        onClick={handleGenerate}
        className="text-primary isrc-generate-button"
        style={{
          marginLeft: 8,
          cursor: effectiveReadOnly ? "not-allowed" : "pointer",
          opacity: effectiveReadOnly ? 0.5 : 1,
          pointerEvents: effectiveReadOnly ? "none" : "auto",
          userSelect: "none",
        }}
        aria-disabled={effectiveReadOnly}
        title={effectiveReadOnly ? "Read-only" : "Generate ISRC"}
      >
        Generate
      </span>
    </div>
  );
};

ISRCInput.propTypes = {
  file: PropTypes.object.isRequired,
  updateISRC: PropTypes.func.isRequired,
  saveTrackField: PropTypes.func.isRequired,
  refreshTracksData: PropTypes.func,
  isReadOnly: PropTypes.bool,
};

export default ISRCInput;
