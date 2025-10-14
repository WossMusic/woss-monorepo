import React, { useEffect, useState } from "react";
import { Row, Col, Input } from "reactstrap";
import { FaInfoCircle } from "react-icons/fa";
import { countryOptions } from "components/Data/countries";

const InfoBox = ({ show, text, left }) =>
  show ? (
    <div
      className="info-box"
      style={{
        position: "absolute",
        left,
        top: "5px",
        padding: "5px 10px",
        backgroundColor: "#56BCB6",
        color: "white",
        borderRadius: "5px",
        maxWidth: "250px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        zIndex: 1050,
        fontSize: "12px",
      }}
    >
      {text}
    </div>
  ) : null;

const Publishing = ({
  file,
  saveTrackField,
  isHoveredPublisher,
  setIsHoveredPublisher,
  isHoveredWorkTitle,
  setIsHoveredWorkTitle,
  isHoveredSplitPercentage,
  setIsHoveredSplitPercentage,
  isHoveredCountry,
  setIsHoveredCountry,
  isHoveredRights,
  setIsHoveredRights,
  isHoveredAffiliation,
  setIsHoveredAffiliation,
  isReadOnly = false, // <-- NEW: lock editable fields
}) => {
  const [localWorkTitle, setLocalWorkTitle] = useState(file.track_work_title || "");
  const [localPublishingCountry, setLocalPublishingCountry] = useState(
    file.track_publishing_country || ""
  );
  const [workTitleWarning, setWorkTitleWarning] = useState(false);
  const [publishingCountryWarning, setPublishingCountryWarning] = useState(false);

  // unified read-only visuals for inputs/selects
  const roInputStyle = isReadOnly
    ? { backgroundColor: "#ced4da", color: "#000", borderColor: "#ced4da", cursor: "not-allowed" }
    : {};

  useEffect(() => {
    setWorkTitleWarning(!localWorkTitle || localWorkTitle.trim() === "");
  }, [localWorkTitle]);

  useEffect(() => {
    setPublishingCountryWarning(!localPublishingCountry || localPublishingCountry.trim() === "");
  }, [localPublishingCountry]);

  // Read-only fields from file
  const track_publisher_name = file.track_publisher_name || "Woss Music Publishing Group";
  const track_split_percentage = file.track_split_percentage || "15%";
  const track_rights_admin = file.track_rights_admin || "Woss Music";
  const track_affiliation = file.track_affiliation || "Warner Chappell Music";

  useEffect(() => {
    setLocalWorkTitle(file.track_work_title || "");
  }, [file.track_work_title]);

  useEffect(() => {
    setLocalPublishingCountry(file.track_publishing_country || "");
  }, [file.track_publishing_country]);

  return (
    <Row className="mb-4">
      <Col md="12">
        <Row>
          <Col md="6" style={{ position: "relative" }}>
            <label className="text-muted">
              Publisher Name
              <FaInfoCircle
                style={{ marginLeft: "10px", cursor: "pointer", color: "#56BCB6" }}
                onMouseEnter={() => setIsHoveredPublisher(true)}
                onMouseLeave={() => setIsHoveredPublisher(false)}
              />
              <InfoBox
                show={isHoveredPublisher}
                left="180px"
                text="An organization that secures and manages copyrights for musical compositions."
              />
            </label>
            <Input
              type="text"
              value={track_publisher_name}
              placeholder="Publisher Name"
              disabled
              className="border-0"
              style={{ backgroundColor: "#ced4da", color: "#000", borderColor: "#ced4da", cursor: "not-allowed" }}
            />
          </Col>

          <Col md="6" style={{ position: "relative" }}>
            <label className="text-muted">
              Work Title
              <FaInfoCircle
                style={{ marginLeft: "10px", cursor: "pointer", color: "#56BCB6" }}
                onMouseEnter={() => setIsHoveredWorkTitle(true)}
                onMouseLeave={() => setIsHoveredWorkTitle(false)}
              />
              <InfoBox
                show={isHoveredWorkTitle}
                left="125px"
                text="The title of the work according to the original songwriter and holder of the license."
              />
            </label>
            <Input
              type="text"
              value={localWorkTitle}
              readOnly={isReadOnly}
              onChange={(e) => !isReadOnly && setLocalWorkTitle(e.target.value)}
              onBlur={() => {
                if (isReadOnly) return;
                saveTrackField(file.id, "track_work_title", localWorkTitle);
              }}
              placeholder="Enter Work Title"
              className={workTitleWarning ? "warning-border" : ""}
              style={{ ...roInputStyle }}
            />
          </Col>
        </Row>

        <Row className="mt-3">
          <Col md="6" style={{ position: "relative" }}>
            <label className="text-muted">
              Publisher Percentage
              <FaInfoCircle
                style={{ marginLeft: "10px", cursor: "pointer", color: "#56BCB6" }}
                onMouseEnter={() => setIsHoveredSplitPercentage(true)}
                onMouseLeave={() => setIsHoveredSplitPercentage(false)}
              />
              <InfoBox
                show={isHoveredSplitPercentage}
                left="190px"
                text="The percentage of royalties to be split between the artist and songwriter."
              />
            </label>
            <Input
              type="text"
              value={track_split_percentage}
              placeholder="Split Percentage (e.g. 50%)"
              disabled
              className="border-0"
              style={{ backgroundColor: "#ced4da", color: "#000", borderColor: "#ced4da", cursor: "not-allowed" }}
            />
          </Col>

          <Col md="6" style={{ position: "relative" }}>
            <label className="text-muted">
              Country *
              <FaInfoCircle
                style={{ marginLeft: "10px", cursor: "pointer", color: "#56BCB6" }}
                onMouseEnter={() => setIsHoveredCountry(true)}
                onMouseLeave={() => setIsHoveredCountry(false)}
              />
              <InfoBox
                show={isHoveredCountry}
                left="125px"
                text="The country of the originally created work."
              />
            </label>
            <Input
              type="select"
              value={localPublishingCountry}
              onChange={(e) => {
                if (isReadOnly) return;
                const value = e.target.value;
                setLocalPublishingCountry(value);
                saveTrackField(file.id, "track_publishing_country", value);
              }}
              className={publishingCountryWarning ? "warning-border" : ""}
              disabled={isReadOnly}
              style={{ ...roInputStyle }}
              onMouseDown={(e) => {
                if (isReadOnly) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            >
              <option value="">Select Publishing Country</option>
              {countryOptions.map((country) => (
                <option key={country.value} value={country.value}>
                  {country.label}
                </option>
              ))}
            </Input>
          </Col>
        </Row>

        <Row className="mt-3">
          <Col md="6" style={{ position: "relative" }}>
            <label className="text-muted">
              Rights Administrator
              <FaInfoCircle
                style={{ marginLeft: "10px", cursor: "pointer", color: "#56BCB6" }}
                onMouseEnter={() => setIsHoveredRights(true)}
                onMouseLeave={() => setIsHoveredRights(false)}
              />
              <InfoBox
                show={isHoveredRights}
                left="205px"
                text="The rights holder or administrator responsible for granting licenses."
              />
            </label>
            <Input
              type="text"
              value={track_rights_admin}
              placeholder="Rights Admin (e.g. Woss Music)"
              disabled
              className="border-0"
              style={{ backgroundColor: "#ced4da", color: "#000", borderColor: "#ced4da", cursor: "not-allowed" }}
            />
          </Col>

          <Col md="6" style={{ position: "relative" }}>
            <label className="text-muted">Affiliation</label>
            <Input
              type="text"
              value={track_affiliation}
              placeholder="Affiliation (e.g. ASCAP, The MLC)"
              disabled
              className="border-0"
              style={{ backgroundColor: "#ced4da", color: "#000", borderColor: "#ced4da", cursor: "not-allowed" }}
            />
          </Col>
        </Row>
      </Col>
    </Row>
  );
};

export default Publishing;
