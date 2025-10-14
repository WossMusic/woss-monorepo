import React, {
  useEffect,
  useCallback,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import { useParams } from "react-router-dom";
import CustomInfoIcon from "components/Icons/CustomInfoIcon";
import axios from "axios";
import {
  Card,
  CardHeader,
  CardBody,
  Col,
  Row,
  Input,
  FormGroup,
  Label,
  Table,
} from "reactstrap";
import NewReleaseCard from "components/Custom/NewReleaseCard";

/** Reusable read-only styles to match NewRelease.js */
const RO_BG = "#e9ecef";
const roTextProps = (isReadOnly) =>
  isReadOnly ? { readOnly: true, style: { backgroundColor: RO_BG } } : {};
const roSelectProps = (isReadOnly) =>
  isReadOnly ? { disabled: true, style: { backgroundColor: RO_BG } } : {};
const roDateProps = (isReadOnly) =>
  // date inputs don't obey readOnly consistently; use disabled for correct UX
  isReadOnly ? { disabled: true, style: { backgroundColor: RO_BG } } : {};

const Scheduling = forwardRef(
  (
    {
      releaseId,
      releaseArtists,
      releaseTitle,
      displayTitle,
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
      originalReleaseDate,
      setOriginalReleaseDate,
      preorderDate,
      setPreorderDate,
      productReleaseDate,
      setProductReleaseDate,
      isReadOnly = true,
    },
    ref
  ) => {
    const { publicId, slug } = useParams();
    const [resolvedReleaseId, setResolvedReleaseId] = useState(releaseId || null);

    // Resolve numeric release id
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

    const [selectedTerritory, setSelectedTerritory] = useState("Worldwide");
    const [selectedPartner, setSelectedPartner] = useState("All Partners");
    const [projectName, setProjectName] = useState("");
    const [, setArtists] = useState([]);
    const [releaseImageUrl, setReleaseImageUrl] = useState(null);
    const [distributionData, setDistributionData] = useState([]);
    const [distributionNotes, setDistributionNotes] = useState("");
    const [, setTrackVolumes] = useState([]);
    const [igtPopup, setIgtPopup] = useState({
      visible: false,
      distIdx: null,
      volIdx: null,
      trackIdx: null,
      date: "",
    });

    const [dateWarnings, setDateWarnings] = useState({
      originalReleaseDate: false,
      preorderDate: false,
      productReleaseDate: false,
    });

    useEffect(() => {
      const warnings = {
        originalReleaseDate: !originalReleaseDate?.trim(),
        preorderDate: !preorderDate?.trim(),
        productReleaseDate: !productReleaseDate?.trim(),
      };
      setDateWarnings(warnings);
    }, [originalReleaseDate, preorderDate, productReleaseDate]);

    // Format date for table
    const formatDate = (isoDate) => {
      if (!isoDate) return "";
      const [year, month, day] = isoDate.split("-");
      return `${month.padStart(2, "0")}/${day.padStart(2, "0")}/${year}`;
    };

    const saveDistributionJson = async (newData) => {
      if (!resolvedReleaseId) return;
      try {
        const token = localStorage.getItem("woss_token");
        await axios.put(
          `http://localhost:4000/api/user/releases/${resolvedReleaseId}`,
          {
            distribution_json: JSON.stringify(newData),
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } catch (err) {
        console.error("❌ Error saving distribution_json:", err);
      }
    };

    const updateTrackField = async (distIdx, volIdx, trackIdx, field, value) => {
      const updated = [...distributionData];
      updated[distIdx].volumes[volIdx].tracks[trackIdx][field] = value;
      setDistributionData(updated);
      saveDistributionJson(updated);
    };

    const saveSchedulingField = async (field, value) => {
      if (!resolvedReleaseId) return;
      try {
        const token = localStorage.getItem("woss_token");
        await axios.put(
          `http://localhost:4000/api/user/releases/${resolvedReleaseId}`,
          {
            [field]: String(value ?? "").replace(/^'+|'+$/g, ""),
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } catch (err) {
        console.error(`Failed to update ${field}:`, err);
      }
    };

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
            setArtists([
              { id: 1, displayName: name, country: "Unknown", genre: "Unknown", type: "Main Artist" },
            ]);
          }
        } catch (err) {
          console.error("Error fetching project name:", err);
        }
      };
      fetchProjectName();
    }, [setArtists]);

    // Save generic field helper
    const saveField = useCallback(
      async (field, value) => {
        if (!resolvedReleaseId) return;
        try {
          const token = localStorage.getItem("woss_token");
          await axios.put(
            `http://localhost:4000/api/user/releases/${resolvedReleaseId}`,
            { [field]: value },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (err) {
          console.error(`Failed to update ${field}:`, err);
        }
      },
      [resolvedReleaseId]
    );

    // 1) Fetch Non-Date Fields (Artwork, Distribution Data)
    useEffect(() => {
      const fetchNonDateData = async () => {
        if (!resolvedReleaseId) return;
        const token = localStorage.getItem("woss_token");
        if (!token) return;
        try {
          const res = await fetch(`http://localhost:4000/api/user/releases/${resolvedReleaseId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.success) {
            const r = data.release;
            if (r.artwork_url) setReleaseImageUrl(`http://localhost:4000${r.artwork_url}`);
            if (r.distribution_json) setDistributionData(JSON.parse(r.distribution_json));
            setSelectedTerritory(r.territory || "Worldwide");
            if (!r.territory) await saveField("territory", "Worldwide");
            setSelectedPartner(r.partner || "All Partners");
            if (!r.partner) await saveField("partner_exclusivity", "All Partners");
            setDistributionNotes(r.distribution_notes || "");
          }
        } catch (err) {
          console.error("Error fetching non-date fields:", err);
        }
      };
      fetchNonDateData();
    }, [resolvedReleaseId, saveField]);

    // 2) Fetch Date Fields
    useEffect(() => {
      const fetchDateFields = async () => {
        if (!resolvedReleaseId) return;
        const token = localStorage.getItem("woss_token");
        if (!token) return;
        try {
          const res = await fetch(`http://localhost:4000/api/user/releases/${resolvedReleaseId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.success) {
            const r = data.release;
            setOriginalReleaseDate(r.original_release_date?.slice(0, 10) || "");
            setPreorderDate(r.preorder_date?.slice(0, 10) || "");
            setProductReleaseDate(r.product_release_date?.slice(0, 10) || "");
          }
        } catch (err) {
          console.error("Error fetching date fields:", err);
        }
      };
      fetchDateFields();
    }, [resolvedReleaseId, setOriginalReleaseDate, setPreorderDate, setProductReleaseDate]);

    const priceOptions = {
      "1 Low Track Single": "$0.69",
      "1 Mid Track Single": "$0.99",
      "1 Premium Track Single": "$1.29",
    };
    const pdOptions = ["Yes", "No", "Bundle Only"];
    const etuOptions = ["Yes", "No"];
    const adssOptions = ["Yes", "No"];
    const ugcOptions = ["Block", "No Action", "Monetize"];

    // Refresh distribution data for external changes
    const refreshDistributionData = useCallback(async () => {
      if (!resolvedReleaseId) return;
      const token = localStorage.getItem("woss_token");
      const res = await axios.get(`http://localhost:4000/api/user/releases/${resolvedReleaseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data?.release?.distribution_json
        ? JSON.parse(res.data.release.distribution_json)
        : [];
      setDistributionData(data);
    }, [resolvedReleaseId]);

    useImperativeHandle(ref, () => ({
      refreshDistributionData,
    }));

    useEffect(() => {
      refreshDistributionData();
    }, [refreshDistributionData]);

    useEffect(() => {
      const fetchTrackVolumes = async () => {
        if (!resolvedReleaseId) return;
        try {
          const token = localStorage.getItem("woss_token");
          const res = await axios.get(
            `http://localhost:4000/api/user/releases/${resolvedReleaseId}/track-volumes`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (res.data.success) {
            setTrackVolumes(res.data.volumes);
          }
        } catch (err) {
          console.error("❌ Failed to fetch track volumes:", err);
        }
      };

      fetchTrackVolumes();
    }, [resolvedReleaseId]);

    const [releaseTracks, setReleaseTracks] = useState([]);

    useEffect(() => {
      const fetchReleaseTracks = async () => {
        if (!resolvedReleaseId) return;
        try {
          const token = localStorage.getItem("woss_token");
          const res = await axios.get(
            `http://localhost:4000/api/user/releases/${resolvedReleaseId}/tracks`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (res.data.success) {
            setReleaseTracks(res.data.tracks);
          }
        } catch (err) {
          console.error("❌ Failed to fetch release tracks:", err);
        }
      };

      fetchReleaseTracks();
    }, [resolvedReleaseId]);

    return (
      <>
        {/* Summary Card */}
        <Row>
          <Col xs="12">
            <NewReleaseCard
              releaseImageUrl={releaseImageUrl}
              releaseId={resolvedReleaseId}
              releaseTitle={releaseTitle}
              displayTitle={displayTitle}
              releaseArtists={releaseArtists}
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
              label={label || "Woss Music"}
            />
          </Col>
        </Row>

        {/* IGT Date popup (disabled when read-only) */}
        {igtPopup.visible && !isReadOnly && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              backgroundColor: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
            onClick={() => setIgtPopup({ ...igtPopup, visible: false })}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "white",
                padding: "2rem",
                borderRadius: "8px",
                minWidth: "320px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                textAlign: "center",
              }}
            >
              <h2 className="mb-3 text-dark">Add Instant Grat Date</h2>
              <Input
                type="date"
                value={igtPopup.date}
                onChange={(e) => setIgtPopup({ ...igtPopup, date: e.target.value })}
              />
              <div className="d-flex justify-content-between mt-4">
                <button className="btn btn-dark" onClick={() => setIgtPopup({ ...igtPopup, visible: false })}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const updated = [...distributionData];
                    updated[igtPopup.distIdx].volumes[igtPopup.volIdx].tracks[igtPopup.trackIdx].igtDate =
                      igtPopup.date;
                    setDistributionData(updated);
                    setIgtPopup({ ...igtPopup, visible: false });
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scheduling & Distribution */}
        <Row className="mt-0">
          <Col xs="12">
            <Card className="shadow-card bg-white text-dark">
              <CardHeader className="custom-card-header mb--4">
                <h2 className="text-white">Scheduling & Distribution</h2>
                <div className="header-divider"></div>
              </CardHeader>
              <CardBody>
                {/* Dates */}
                <Row className="mb-4 mt-4">
                  <Col md="4">
                    <FormGroup>
                      <Label className="custom-label">
                        Original Release Date{" "}
                        {dateWarnings.originalReleaseDate && <CustomInfoIcon className="ml-1" size="1em" />}
                      </Label>
                      <Input
                        type="date"
                        value={originalReleaseDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOriginalReleaseDate(val);
                          saveSchedulingField("original_release_date", val);
                        }}
                        className={dateWarnings.originalReleaseDate ? "warning-border" : ""}
                        {...roDateProps(isReadOnly)}
                      />
                    </FormGroup>
                  </Col>
                  <Col md="4">
                    <FormGroup>
                      <Label className="custom-label">
                        Product Preorder Date{" "}
                        {dateWarnings.preorderDate && <CustomInfoIcon className="ml-1" size="1em" />}
                      </Label>
                      <Input
                        type="date"
                        value={preorderDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPreorderDate(val);
                          saveSchedulingField("preorder_date", val);
                        }}
                        className={dateWarnings.preorderDate ? "warning-border" : ""}
                        {...roDateProps(isReadOnly)}
                      />
                    </FormGroup>
                  </Col>
                  <Col md="4">
                    <FormGroup>
                      <Label className="custom-label">
                        Product Release Date{" "}
                        {dateWarnings.productReleaseDate && <CustomInfoIcon className="ml-1" size="1em" />}
                      </Label>
                      <Input
                        type="date"
                        value={productReleaseDate}
                        onChange={(e) => {
                          const iso = e.target.value;
                          setProductReleaseDate(iso);
                          saveSchedulingField("product_release_date", iso);
                        }}
                        className={dateWarnings.productReleaseDate ? "warning-border" : ""}
                        {...roDateProps(isReadOnly)}
                      />
                    </FormGroup>
                  </Col>
                </Row>

                {/* Territories */}
                <Row className="mb-4">
                  <Col>
                    <FormGroup tag="fieldset">
                      <Label className="custom-label d-block mb-2">Territories</Label>
                      <div className="d-flex flex-wrap">
                        {["Worldwide", "Only In", "World Excluding", "Existing Distribution Groups"].map(
                          (option, index) => (
                            <div
                              key={index}
                              className="d-flex align-items-center"
                              style={{ marginLeft: "1.2rem", marginRight: "2.5rem" }}
                            >
                              <Input
                                type="radio"
                                value={option}
                                checked={selectedTerritory === option}
                                onChange={() => {
                                  setSelectedTerritory(option);
                                  saveSchedulingField("territory", option);
                                  setDistributionData((prev) =>
                                    prev.map((dist) => ({ ...dist, territory: option }))
                                  );
                                }}
                                disabled={isReadOnly}
                              />
                              <Label className="mb-0 text-muted" style={{ fontSize: "0.85rem" }}>
                                {option}
                              </Label>
                            </div>
                          )
                        )}
                      </div>
                    </FormGroup>
                  </Col>
                </Row>

                {/* Partners Section */}
                <Row className="mb-4">
                  <Col>
                    <FormGroup tag="fieldset">
                      <Label className="custom-label d-block mb-2">Partners</Label>
                      <div className="d-flex flex-wrap">
                        {["All Partners", "Only To", "All Partners Excluding"].map((option, index) => (
                          <div
                            key={index}
                            className="d-flex align-items-center"
                            style={{ marginLeft: "1.2rem", marginRight: "2rem" }}
                          >
                            <Input
                              type="radio"
                              name="partners"
                              value={option}
                              checked={selectedPartner === option}
                              onChange={() => {
                                setSelectedPartner(option);
                                saveSchedulingField("partner_exclusivity", option);
                                setDistributionData((prevData) =>
                                  prevData.map((dist) => ({
                                    ...dist,
                                    exclusivity: option,
                                  }))
                                );
                              }}
                              disabled={isReadOnly}
                            />
                            <Label className="mb-0 text-muted" style={{ fontSize: "0.85rem" }}>
                              {option}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </FormGroup>
                  </Col>
                </Row>

                {/* Notes */}
                <Row>
                  <Col md="12">
                    <FormGroup>
                      <Label className="custom-label">Distribution Notes</Label>
                      <Input
                        type="textarea"
                        placeholder="Enter Distribution Notes"
                        value={distributionNotes}
                        onChange={(e) => setDistributionNotes(e.target.value)}
                        onBlur={(e) => saveSchedulingField("distribution_notes", e.target.value)}
                        {...roTextProps(isReadOnly)}
                      />
                    </FormGroup>
                  </Col>
                </Row>
              </CardBody>
            </Card>
          </Col>
        </Row>

        {/* Details Table */}
        <Row className="mt-0">
          <Col xs="12">
            <Card className="shadow-card bg-white text-dark">
              <CardHeader className="custom-card-header">
                <h2 className="text-white">Details</h2>
                <div className="header-divider" />
              </CardHeader>
              <CardBody>
                {distributionData.map((distOuter, distIdxOuter) => (
                  <div key={distOuter.id || distIdxOuter} className="mb-4">
                    <h5 className="text-dark font-weight-bold mb-3">{distOuter.name}</h5>
                    <Table bordered responsive className="text-dark">
                      <thead className="text-white">
                        <tr className="text-center">
                          <th className="bg-dark">Territory</th>
                          <th className="bg-dark">Exclusivity</th>
                          <th className="bg-dark">Release / Track</th>
                          <th className="bg-dark">Price Code</th>
                          <th className="bg-dark">Pre-Order Date</th>
                          <th className="bg-dark">Release Date</th>
                          <th className="bg-dark">Inst Grat Date</th>
                          <th className="bg-dark">PD</th>
                          <th className="bg-dark">ETU</th>
                          <th className="bg-dark">Ad SS</th>
                          <th className="bg-dark">UGC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {distributionData.map((dist, distIdx) => {
                          const volumeGroups = {};
                          const seenTrackIds = new Set();

                          (dist.volumes || []).forEach((vol, volIdx) => {
                            const volName = vol.name?.trim() || "Vol.1";
                            if (!volumeGroups[volName]) volumeGroups[volName] = [];
                            vol.tracks.forEach((track) => {
                              volumeGroups[volName].push({ ...track, volIdx });
                              seenTrackIds.add(track.id);
                            });
                          });

                          releaseTracks
                            .filter((track) => track.distribution_id === dist.id && !seenTrackIds.has(track.id))
                            .forEach((track) => {
                              const volName = track.track_volume?.trim() || "Vol.1";
                              if (!volumeGroups[volName]) volumeGroups[volName] = [];
                              volumeGroups[volName].push({ ...track, volIdx: -1 });
                              seenTrackIds.add(track.id);
                            });

                          const sortedVolumes = Object.entries(volumeGroups)
                            .map(([volume, tracks]) => ({ volume, tracks }))
                            .sort((a, b) => {
                              const aNum = parseInt(a.volume.replace("Vol.", ""), 10) || 0;
                              const bNum = parseInt(b.volume.replace("Vol.", ""), 10) || 0;
                              return aNum - bNum;
                            });

                          const totalTracks = sortedVolumes.reduce((sum, v) => sum + v.tracks.length, 0);
                          let isFirstVolume = true;

                          return (
                            <React.Fragment key={distIdx}>
                              {sortedVolumes.map((volData, volIdx) => (
                                <React.Fragment key={`${distIdx}-${volData.volume}`}>
                                  {/* Volume Header Row */}
                                  <tr className="volume-row">
                                    {isFirstVolume && (
                                      <>
                                        <td rowSpan={totalTracks + sortedVolumes.length} className="align-middle text-center">
                                          {dist.territory}
                                        </td>
                                        <td rowSpan={totalTracks + sortedVolumes.length} className="align-middle text-center">
                                          {dist.exclusivity}
                                        </td>
                                      </>
                                    )}
                                    <td colSpan={9} className="bg-dark text-white font-weight-bold">
                                      {volData.volume}
                                    </td>
                                  </tr>

                                  {/* Track Rows */}
                                  {volData.tracks.map((track, trackIdx) => {
                                    isFirstVolume = false;
                                    const actualVolIdx =
                                      track.volIdx !== -1
                                        ? track.volIdx
                                        : dist.volumes?.findIndex((v) => v.name?.trim() === volData.volume) ?? -1;

                                    return (
                                      <tr key={`${distIdx}-${track.id}`}>
                                        <td
                                          className="align-middle text-start"
                                          style={{
                                            maxWidth: "150px",
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                          }}
                                          title={track.track_display_title || track.track_title || track.track_file_name}
                                        >
                                          {`${trackIdx + 1}. ${
                                            track.track_display_title || track.track_title || track.track_file_name
                                          }`}
                                        </td>

                                        {/* Price Code */}
                                        <td className="align-middle">
                                          <Input
                                            type="select"
                                            value={track.price || "1 Mid Track Single"}
                                            style={{ fontSize: "0.75rem" }}
                                            className="form-control-sm"
                                            onChange={(e) =>
                                              updateTrackField(distIdx, actualVolIdx, trackIdx, "price", e.target.value)
                                            }
                                            {...roSelectProps(isReadOnly)}
                                          >
                                            {Object.keys(priceOptions).map((priceKey) => (
                                              <option key={priceKey} value={priceKey}>
                                                {priceKey}
                                              </option>
                                            ))}
                                          </Input>
                                          <small className="text-muted">
                                            USD: {priceOptions[track.price || "1 Mid Track Single"]}
                                          </small>
                                        </td>

                                        {/* Dates (display only) */}
                                        <td className="align-middle text-center">
                                          {formatDate(track.preorder_date || preorderDate)}
                                        </td>
                                        <td className="align-middle text-center">
                                          {formatDate(track.release_date || productReleaseDate)}
                                        </td>

                                        {/* IGT */}
                                        <td className="align-middle text-center">
                                          {track.igtDate ? (
                                            <div className="d-flex align-items-center justify-content-center">
                                              <span>{formatDate(track.igtDate)}</span>
                                              {!isReadOnly && (
                                                <span
                                                  onClick={() =>
                                                    updateTrackField(distIdx, actualVolIdx, trackIdx, "igtDate", "")
                                                  }
                                                  style={{
                                                    marginLeft: "8px",
                                                    cursor: "pointer",
                                                    fontSize: "1.5rem",
                                                    color: "red",
                                                  }}
                                                >
                                                  ×
                                                </span>
                                              )}
                                            </div>
                                          ) : (
                                            <span
                                              style={{
                                                cursor: isReadOnly ? "not-allowed" : "pointer",
                                                color: isReadOnly ? "#6c757d" : "#56bcb6",
                                                fontWeight: "bold",
                                                pointerEvents: isReadOnly ? "none" : "auto",
                                              }}
                                              onClick={
                                                isReadOnly
                                                  ? undefined
                                                  : () =>
                                                      setIgtPopup({
                                                        visible: true,
                                                        distIdx,
                                                        volIdx: actualVolIdx,
                                                        trackIdx,
                                                        date: track.igtDate || "",
                                                      })
                                              }
                                            >
                                              + Add IGT
                                            </span>
                                          )}
                                        </td>

                                        {/* PD / ETU / Ad SS / UGC */}
                                        {[pdOptions, etuOptions, adssOptions, ugcOptions].map((opts, i) => {
                                          const field = ["pd", "etu", "adss", "ugc"][i];
                                          return (
                                            <td key={i} className="align-middle text-center">
                                              <Input
                                                type="select"
                                                value={track[field] || opts[0]}
                                                className="form-control-sm"
                                                style={{ fontSize: "0.75rem" }}
                                                onChange={(e) =>
                                                  updateTrackField(
                                                    distIdx,
                                                    actualVolIdx,
                                                    trackIdx,
                                                    field,
                                                    e.target.value
                                                  )
                                                }
                                                {...roSelectProps(isReadOnly)}
                                              >
                                                {opts.map((opt) => (
                                                  <option key={opt} value={opt}>
                                                    {opt}
                                                  </option>
                                                ))}
                                              </Input>
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    );
                                  })}
                                </React.Fragment>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                ))}
              </CardBody>
            </Card>
          </Col>
        </Row>
      </>
    );
  }
);

export default Scheduling;
