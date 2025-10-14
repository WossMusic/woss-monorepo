import React, { useEffect, useCallback, useState } from "react";
import Select from "react-select";
import { Row, Col, Input } from "reactstrap";
import { genreOptions } from "components/Data/genres";
import { languageOptions } from "components/Data/languages";
import { countryOptions } from "components/Data/countries";
import { yearOptions } from "components/Data/yearOptions";

// keep select fully opaque and show not-allowed cursor while locked
const roSelectStyles = (locked) => ({
  control: (provided, state) => ({
    ...provided,
    opacity: 1,
    cursor: locked ? "not-allowed" : "default",
  }),
  indicatorsContainer: (provided) => ({
    ...provided,
    cursor: locked ? "not-allowed" : "pointer",
  }),
  option: (provided) => ({
    ...provided,
    cursor: locked ? "not-allowed" : "pointer",
  }),
});

const OtherMetadata = ({ file, saveTrackField, setTabWarnings, isReadOnly = false }) => {
  const [fieldWarnings, setFieldWarnings] = useState({});

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    saveTrackField(file.id, field, value);
    checkMetadataWarnings({ ...file, [field]: value });
  };

  const subGenres =
    genreOptions.find((g) => g.value === file.track_primary_genre)?.subGenres || [];

  useEffect(() => {
    if (!file.track_p_line_owner) {
      saveTrackField(file.id, "track_p_line_owner", "Woss Music");
    }
  }, [file, saveTrackField]);

  const checkMetadataWarnings = useCallback(
    (fileData = file) => {
      const newWarnings = {
        track_primary_genre:
          !fileData.track_primary_genre || fileData.track_primary_genre === "",
        track_metadata_language:
          !fileData.track_metadata_language || fileData.track_metadata_language === "",
        track_metadata_country:
          !fileData.track_metadata_country || fileData.track_metadata_country === "",
        track_audio_language:
          !fileData.track_audio_language || fileData.track_audio_language === "",
        track_p_line_year: !fileData.track_p_line_year || fileData.track_p_line_year === "",
      };

      setFieldWarnings(newWarnings);

      const hasWarnings = Object.values(newWarnings).some((val) => val === true);
      if (typeof setTabWarnings === "function") {
        setTabWarnings((prev) => ({
          ...prev,
          metadata: hasWarnings,
        }));
      }
    },
    [file, setTabWarnings]
  );

  useEffect(() => {
    checkMetadataWarnings();
  }, [file, checkMetadataWarnings]);

  // common read-only look for plain inputs
  const roInputStyle = {
    backgroundColor: "#e9e9e9",
    color: "#000",
    cursor: "not-allowed",
  };

  return (
    <>
      <Row>
        <Col md="6">
          <label className="text-muted">Primary Genre *</label>
          <Select
            styles={roSelectStyles(isReadOnly)}
            className={`react-select2-container ${
              isReadOnly ? "locked-select" : ""
            } ${fieldWarnings.track_primary_genre ? "has-warning" : ""}`}
            classNamePrefix="react-select2"
            options={[{ value: "", label: "Select Primary Genre" }, ...genreOptions]}
            value={
              genreOptions.find((opt) => opt.value === file.track_primary_genre) || {
                value: "",
                label: "Select Primary Genre",
              }
            }
            onChange={(selected) => {
              if (isReadOnly) return;
              handleChange("track_primary_genre")({
                target: { value: selected?.value || "" },
              });
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
            placeholder="Select Primary Genre"
            isClearable
            isDisabled={isReadOnly}
          />
        </Col>
        <Col md="6">
          <label className="text-muted">Sub-Genre</label>
          <Select
            styles={roSelectStyles(isReadOnly)}
            className={`react-select2-container ${isReadOnly ? "locked-select" : ""}`}
            classNamePrefix="react-select2"
            options={[
              { value: "", label: "Select Sub-Genre" },
              ...subGenres.map((sub) => ({ value: sub, label: sub })),
            ]}
            value={
              subGenres.find((sub) => sub === file.track_sub_genre)
                ? { value: file.track_sub_genre, label: file.track_sub_genre }
                : { value: "", label: "Select Sub-Genre" }
            }
            onChange={(selected) => {
              if (isReadOnly) return;
              handleChange("track_sub_genre")({
                target: { value: selected?.value || "" },
              });
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
            placeholder="Select Sub-Genre"
            isClearable
            isDisabled={isReadOnly || !file.track_primary_genre}
          />
        </Col>
      </Row>

      <Row className="mt-3">
        <Col md="4">
          <label className="text-muted">Metadata Language *</label>
          <Select
            styles={roSelectStyles(isReadOnly)}
            className={`react-select2-container ${
              isReadOnly ? "locked-select" : ""
            } ${fieldWarnings.track_metadata_language ? "has-warning" : ""}`}
            classNamePrefix="react-select2"
            options={[{ value: "", label: "Select Metadata Language" }, ...languageOptions]}
            value={
              languageOptions.find((opt) => opt.value === file.track_metadata_language) || {
                value: "",
                label: "Select Metadata Language",
              }
            }
            onChange={(selected) => {
              if (isReadOnly) return;
              handleChange("track_metadata_language")({
                target: { value: selected?.value || "" },
              });
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
            placeholder="Select Metadata Language"
            isClearable
            isDisabled={isReadOnly}
          />
        </Col>
        <Col md="4">
          <label className="text-muted">Metadata Language Country *</label>
          <Select
            styles={roSelectStyles(isReadOnly)}
            className={`react-select2-container ${
              isReadOnly ? "locked-select" : ""
            } ${fieldWarnings.track_metadata_country ? "has-warning" : ""}`}
            classNamePrefix="react-select2"
            options={[
              { value: "", label: "Select Metadata Language Country" },
              ...countryOptions,
            ]}
            value={
              countryOptions.find((opt) => opt.value === file.track_metadata_country) || {
                value: "",
                label: "Select Metadata Language Country",
              }
            }
            onChange={(selected) => {
              if (isReadOnly) return;
              handleChange("track_metadata_country")({
                target: { value: selected?.value || "" },
              });
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
            placeholder="Select Metadata Language Country"
            isClearable
            isDisabled={isReadOnly}
          />
        </Col>
        <Col md="4">
          <label className="text-muted">Audio Language *</label>
          <Select
            styles={roSelectStyles(isReadOnly)}
            className={`react-select2-container ${
              isReadOnly ? "locked-select" : ""
            } ${fieldWarnings.track_audio_language ? "has-warning" : ""}`}
            classNamePrefix="react-select2"
            options={[{ value: "", label: "Select Audio Language" }, ...languageOptions]}
            value={
              languageOptions.find((opt) => opt.value === file.track_audio_language) || {
                value: "",
                label: "Select Audio Language",
              }
            }
            onChange={(selected) => {
              if (isReadOnly) return;
              handleChange("track_audio_language")({
                target: { value: selected?.value || "" },
              });
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
            placeholder="Select Audio Language"
            isClearable
            isDisabled={isReadOnly}
          />
        </Col>
      </Row>

      <Row className="mt-3">
        <Col md="6">
          <label className="text-muted">P Line Year *</label>
          <Select
            styles={roSelectStyles(isReadOnly)}
            className={`react-select2-container ${
              isReadOnly ? "locked-select" : ""
            } ${fieldWarnings.track_p_line_year ? "has-warning" : ""}`}
            classNamePrefix="react-select2"
            options={[{ value: "", label: "Select Year" }, ...yearOptions]}
            value={
              yearOptions.find((opt) => opt.value === file.track_p_line_year) || {
                value: "",
                label: "Select Year",
              }
            }
            onChange={(selected) => {
              if (isReadOnly) return;
              handleChange("track_p_line_year")({
                target: { value: selected?.value || "" },
              });
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
            placeholder="Select Year"
            isClearable
            isDisabled={isReadOnly}
          />
        </Col>
        <Col md="6">
          <label className="text-muted">P Line Owner *</label>
          <Input
            className="bg-light"
            type="text"
            value={file.track_p_line_owner || "Woss Music"}
            readOnly
            style={roInputStyle}
          />
        </Col>
      </Row>
    </>
  );
};

export default OtherMetadata;
