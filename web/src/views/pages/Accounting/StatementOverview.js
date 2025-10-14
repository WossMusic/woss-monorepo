import React, { useEffect, useState } from "react";
import { Row, Col, Card, CardBody } from "reactstrap";
import { useMonth } from "../../../components/Custom/MonthContext";
import TxtIcon from "../../../assets/images/txt_icon.svg";
import PdfIcon from "../../../assets/images/pdf_icon.svg";
import TxtIconHover from "../../../assets/images/txt_icon_hover.svg";
import PdfIconHover from "../../../assets/images/pdf_icon_hover.svg";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleDown } from "@fortawesome/free-regular-svg-icons";
import Select from "react-select";

const API_BASE = "http://localhost:4000";

/* ---------------- Download card ---------------- */
const DownloadCard = ({
  fileAvailable,
  fileSize,
  downloadUrl,
  title,
  icon,
  hoverIcon,
  fileTypeLabel,
  forceDownload = false,
  downloadName = "",
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = async (e) => {
    if (!forceDownload) return; // normal link behavior
    if (!fileAvailable || !downloadUrl) return;

    e.preventDefault();
    try {
      const res = await fetch(downloadUrl, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        downloadName ||
        decodeURIComponent(downloadUrl.split("/").pop() || "download");
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      console.error("❌ Download failed, opening in new tab as fallback:", err);
      window.open(downloadUrl, "_blank");
    }
  };

  return (
    <div className="d-flex align-items-center p-4 rounded h-100">
      <div
        onMouseEnter={() => fileAvailable && setIsHovered(true)}
        onMouseLeave={() => fileAvailable && setIsHovered(false)}
        className="mr-4 d-flex align-items-center justify-content-center"
        style={{ width: "50px" }}
      >
        <img
          src={fileAvailable && isHovered ? hoverIcon : icon}
          alt={`${title} icon`}
          style={{ height: "75px" }}
        />
      </div>

      <div className="flex-grow-1">
        <h2 className="font-weight-bold mb-1">{title}</h2>
        <p className="mb-1 text-muted font-weight-bold h5">
          {fileAvailable && fileSize ? `${fileSize} ` : ""}
          {fileTypeLabel}
        </p>

        {fileAvailable ? (
          <a
            href={downloadUrl}
            className="text-black font-weight-bold h4"
            onClick={handleClick}
          >
            DOWNLOAD <FontAwesomeIcon icon={faCircleDown} className="ml-1" />
          </a>
        ) : (
          <span className="text-muted font-weight-bold h4">
            NO FILE AVAILABLE <FontAwesomeIcon icon={faCircleDown} className="ml-1" />
          </span>
        )}
      </div>
    </div>
  );
};

/* ---------------- utils ---------------- */
const safeFixed = (num, decimals = 2) => {
  if (num === null || num === undefined || isNaN(num)) return "0.00";
  return Number(num).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const formatFileSize = (bytes) => {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
};

const parseSizeFromHead = (res) => {
  const cl = res.headers.get("Content-Length");
  const alt = res.headers.get("X-File-Size");
  const n = parseInt(cl || alt || "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/* ===================================================== */

const StatementOverview = () => {
  const { selectedMonth, setSelectedMonth } = useMonth();
  const [monthOptions, setMonthOptions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const [fileAvailable, setFileAvailable] = useState(false);
  const [fileSize, setFileSize] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState("");

  const [splitFileAvailable, setSplitFileAvailable] = useState(false);
  const [splitDownloadUrl, setSplitDownloadUrl] = useState("");
  const [splitFileSize, setSplitFileSize] = useState(null);

  // Statement PDF
  const [projectName, setProjectName] = useState("");
  const [pdfAvailable, setPdfAvailable] = useState(false);
  const [pdfSize, setPdfSize] = useState(null);
  const [pdfUrl, setPdfUrl] = useState("");

  const defaultSummary = {
    openingBalance: 0,
    payment: 0,
    royaltyEarnings: 0,
    distributionCharges: 0,
    reservesTaken: 0,
    incomingSharedRoyalties: 0,
    outgoingSharedRoyalties: 0,
    netActivity: 0,
    closingBalance: 0,
  };
  const summaryData = summary || defaultSummary;

  /* ---------- months ---------- */
  useEffect(() => {
    const loadPeriods = async () => {
      try {
        const token = localStorage.getItem("woss_token");
        if (!token) return;
        const res = await fetch(`${API_BASE}/api/royalties/periods`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.periods)) {
          const opts = data.periods
            .filter((p) => typeof p === "string" && /^\d{4}-\d{2}$/.test(p))
            .sort()
            .map((p) => ({
              value: p,
              label: new Date(
                Date.UTC(+p.split("-")[0], +p.split("-")[1] - 1)
              ).toLocaleString("en-US", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              }),
            }));
          setMonthOptions(opts);
          if (!selectedMonth && opts.length > 0) {
            setSelectedMonth(opts.at(-1).value);
          }
        }
      } catch {}
    };
    loadPeriods();
  }, [selectedMonth, setSelectedMonth]);

  /* ---------- profile (for future naming) ---------- */
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("woss_token");
        if (!token) return;
        const res = await fetch(`${API_BASE}/api/auth/profile/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data?.profile?.project_name) setProjectName(data.profile.project_name);
      } catch {}
    };
    fetchProfile();
  }, []);

  /* ---------- summary + role-aware file probes (quiet) ---------- */
  useEffect(() => {
    if (!selectedMonth) return;

    const token = localStorage.getItem("woss_token");
    if (!token) return;

    let userId = "";
    try {
      userId = String(JSON.parse(atob(token.split(".")[1])).userId || "");
    } catch {}
    if (!userId) return;

    // Quiet HEAD that returns 200 with size, 204 when missing
    const quietHead = async (filename) => {
      const url = `${API_BASE}/api/royalties/exports/${encodeURIComponent(filename)}`;
      try {
        const res = await fetch(url, { method: "HEAD", cache: "no-store" });
        if (res.status === 200) {
          const size = parseSizeFromHead(res);
          return { ok: true, size, url };
        }
      } catch {}
      return { ok: false };
    };

    const setRegularOff = () => {
      setFileAvailable(false);
      setFileSize(null);
      setDownloadUrl("");
    };
    const setSplitOff = () => {
      setSplitFileAvailable(false);
      setSplitFileSize(null);
      setSplitDownloadUrl("");
    };

    const checkFiles = async (flags = {}) => {
      const safePeriod = selectedMonth.replace("-", "_");
      const regularName = `Statement_${userId}_${safePeriod}.txt`;
      const splitName = `Statement_Split_${userId}_${safePeriod}.txt`;

      const skipRegular = flags.skipRegularStatementFile === true;
      const isInvitee = flags.isInviteeOnly === true;

      if (isInvitee || skipRegular) {
        // Invitee or split-only → only probe split
        setRegularOff();
        const split = await quietHead(splitName);
        if (split.ok && split.size > 0) {
          setSplitFileAvailable(true);
          setSplitFileSize(formatFileSize(split.size));
          setSplitDownloadUrl(split.url);
        } else {
          setSplitOff();
        }
      } else {
        // Main artist → probe regular first; if missing, fallback to split
        const regular = await quietHead(regularName);
        if (regular.ok && regular.size > 0) {
          setFileAvailable(true);
          setFileSize(formatFileSize(regular.size));
          setDownloadUrl(regular.url);
          setSplitOff(); // regular exists; don't show split
        } else {
          // Regular missing → try split as graceful fallback
          setRegularOff();
          const split = await quietHead(splitName);
          if (split.ok && split.size > 0) {
            setSplitFileAvailable(true);
            setSplitFileSize(formatFileSize(split.size));
            setSplitDownloadUrl(split.url);
          } else {
            setSplitOff();
          }
        }
      }
    };

    const fetchSummary = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/api/royalties/summary?period=${selectedMonth}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (data.success && data.summary) {
          setSummary(data.summary);
          await checkFiles(data.summary);
        } else {
          setSummary(null);
          await checkFiles({});
        }
      } catch {
        setSummary(null);
        await checkFiles({});
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [selectedMonth]);

  /* ---------- PDF finder (quiet via withdrawals/probe) ---------- */
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      setPdfAvailable(false);
      setPdfUrl("");
      setPdfSize(null);
      if (!selectedMonth) return;

      const token = localStorage.getItem("woss_token") || "";
      let userId = "";
      try {
        userId = String(JSON.parse(atob(token.split(".")[1] || "")).userId || "");
      } catch {}
      if (!userId) return;

      const [yy, mm] = selectedMonth.split("-");
      const lastDay = new Date(Number(yy), Number(mm), 0).getDate();
      const names = [];
      for (let d = lastDay; d >= 1; d--) {
        const dd = String(d).padStart(2, "0");
        names.push(`${userId}_Payment_Advice_${yy}-${mm}-${dd}.pdf`);
      }

      const probe = async (name) => {
        const url = `${API_BASE}/api/withdrawals/exports/probe/${encodeURIComponent(name)}`;
        try {
          const r = await fetch(url, { method: "HEAD", signal: ctrl.signal, cache: "no-store" });
          if (r.status === 200) {
            const size = Number(r.headers.get("Content-Length") || 0);
            return {
              ok: true,
              url: `${API_BASE}/api/withdrawals/exports/${encodeURIComponent(name)}`,
              size,
            };
          }
        } catch {}
        return { ok: false };
      };

      let found = null;
      const BATCH = 4;
      for (let i = 0; i < names.length && !found; i += BATCH) {
        const results = await Promise.allSettled(names.slice(i, i + BATCH).map(probe));
        for (const r of results) if (r.status === "fulfilled" && r.value?.ok) { found = r.value; break; }
      }
      if (found) {
        setPdfAvailable(true);
        setPdfUrl(found.url);
        if (found.size) setPdfSize(formatFileSize(found.size));
        ctrl.abort();
      }
    })();
    return () => ctrl.abort();
  }, [selectedMonth, projectName]);

  /* ---------- UI ---------- */
  return (
    <div className="position-relative" style={{ minHeight: "700px" }}>
      {loading && (
        <div className="loader-container">
          <div className="loader" />
          <p className="loader-text">Processing Data...</p>
        </div>
      )}

      {!loading && (
        <>
          {/* Header */}
          <Row className="w-100 align-items-center" style={{ maxWidth: "1100px", margin: "0 auto" }}>
            <Col xs="12">
              <div className="responsive-header mb-4">
                {/* Desktop */}
                <div className="d-none d-md-flex align-items-center justify-content-between position-relative">
                  <div style={{ minWidth: "180px", marginLeft: "16px" }}>
                    {/* ⬇️ Always render Select, even with empty options */}
                    <Select
                      options={monthOptions}
                      value={monthOptions.find(o => o.value === selectedMonth) || null}
                      onChange={s => setSelectedMonth(s?.value || "")}
                      isSearchable={false}
                      placeholder="Select..."
                      className="dark-select-container"
                      classNamePrefix="dark-select"
                    />
                  </div>
                  <div
                    className="desktop-title position-absolute text-center"
                    style={{ left: "50%", transform: "translateX(-50%)", top: 0 }}
                  >
                    <h2 className="text-center mt-1 font-weight-bold">Statements Overview</h2>
                  </div>
                  <div className="desktop-currency" style={{ minWidth: "60px", textAlign: "right", marginRight: "16px" }}>
                    <span className="currency-label">
                      USD <i className="fa fa-exclamation-circle ml-1" title="Currency: US Dollar" />
                    </span>
                  </div>
                </div>

                {/* Mobile */}
                <div className="d-block d-md-none">
                  <div className="mobile-title-row mb-4">
                    <h2 className="font-weight-bold mb-1">Statements Overview</h2>
                    <span className="currency-label">
                      | USD <i className="fa fa-exclamation-circle" title="Currency: US Dollar" />
                    </span>
                  </div>
                  <div className="mobile-select-wrapper mt-2">
                    {/* ⬇️ Always render on mobile as well */}
                    <Select
                      options={monthOptions}
                      value={monthOptions.find(o => o.value === selectedMonth) || null}
                      onChange={s => setSelectedMonth(s?.value || "")}
                      isSearchable={false}
                      placeholder="Select..."
                      className="dark-select-container"
                      classNamePrefix="dark-select"
                    />
                  </div>
                  <hr />
                </div>
              </div>

              {/* Summary Cards */}
              <Row className="justify-content-center text-center" style={{ maxWidth: "1100px", margin: "0 auto" }}>
                <Col xs="12" md="4">
                  <Card className="shadow text-center">
                    <CardBody className="bg-dark text-white rounded-top p-2">
                      <h5 className="text-uppercase text-white mb-0">
                        Current Period Opening Balance <i className="fas fa-info-circle" />
                      </h5>
                    </CardBody>
                    <CardBody className="bg-light rounded-bottom p-3">
                      <span className="h3 font-weight-bold text-dark">{safeFixed(summaryData.openingBalance)}</span>
                    </CardBody>
                  </Card>
                </Col>
                <Col xs="12" md="4">
                  <Card className="shadow text-center">
                    <CardBody className="bg-dark text-white rounded-top p-2">
                      <h5 className="text-uppercase text-white mb-0">
                        Net Activity <i className="fas fa-info-circle" />
                      </h5>
                    </CardBody>
                    <CardBody className="bg-light rounded-bottom p-3">
                      <span className="h3 font-weight-bold text-dark">{safeFixed(summaryData.netActivity)}</span>
                    </CardBody>
                  </Card>
                </Col>
                <Col xs="12" md="4">
                  <Card className="shadow text-center">
                    <CardBody className="bg-success text-white rounded-top p-2">
                      <h5 className="text-uppercase mb-0">
                        Closing Balance (+payable) <i className="fas fa-info-circle" />
                      </h5>
                    </CardBody>
                    <CardBody className="bg-light-green rounded-bottom p-3">
                      <span className="h3 font-weight-bold text-dark">{safeFixed(summaryData.closingBalance)}</span>
                    </CardBody>
                  </Card>
                </Col>
              </Row>
            </Col>
          </Row>

          {/* Financial Details + Downloads */}
          <Row className="justify-content-center mt--4" style={{ maxWidth: "1100px", margin: "0 auto" }}>
            <Col xs="12" className="d-flex justify-content-center">
              <div className="financial-details p-4 rounded w-100 text-center" style={{ maxWidth: "1100px", margin: "0 auto" }}>
                <hr />
                <h4>Current Period Opening Balance <span>{safeFixed(summaryData.openingBalance)}</span></h4>
                <h4>Payment Sent <span>{safeFixed(summaryData.payment)}</span></h4>
                <hr />
                <h4>Royalty Earnings <span>{safeFixed(summaryData.royaltyEarnings)}</span></h4>
                <h4>Distribution Charges <span>{safeFixed(summaryData.distributionCharges)}</span></h4>
                <hr />
                <h2 className="font-weight-bold">Net Activity <span>{safeFixed(summaryData.netActivity)}</span></h2>
                <hr />
                <h4>Incoming Shared Royalties <span>{safeFixed(Math.abs(summaryData.incomingSharedRoyalties))}</span></h4>
                <h4>Outgoing Shared Royalties <span>{summaryData.outgoingSharedRoyalties > 0 ? `-${safeFixed(summaryData.outgoingSharedRoyalties)}` : safeFixed(summaryData.outgoingSharedRoyalties)}</span></h4>
                <hr />
                <h2 className="font-weight-bold">Closing Balance <span>{safeFixed(summaryData.closingBalance)}</span></h2>
                <hr />
              </div>
            </Col>

            <Row className="w-100" style={{ maxWidth: "1100px", margin: "0 auto" }}>
              {/* Earnings Detail */}
              <Col xs="12" md="4" className="mb-4">
                <DownloadCard
                  fileAvailable={fileAvailable}
                  fileSize={fileSize}
                  downloadUrl={downloadUrl}
                  title="Earnings Detail"
                  icon={TxtIcon}
                  hoverIcon={TxtIconHover}
                  fileTypeLabel="Microsoft Excel (.txt)"
                />
              </Col>

              {/* Split Earnings Detail */}
              <Col xs="12" md="4" className="mb-4">
                <DownloadCard
                  fileAvailable={splitFileAvailable}
                  fileSize={splitFileSize}
                  downloadUrl={splitDownloadUrl}
                  title="Split Earnings Detail"
                  icon={TxtIcon}
                  hoverIcon={TxtIconHover}
                  fileTypeLabel="Microsoft Excel (.txt)"
                />
              </Col>

              {/* Statement PDF */}
              <Col xs="12" md="4" className="mb-4">
                <DownloadCard
                  fileAvailable={pdfAvailable}
                  fileSize={pdfSize}
                  downloadUrl={pdfUrl}
                  title="Statement"
                  icon={PdfIcon}
                  hoverIcon={PdfIconHover}
                  fileTypeLabel="PDF File (.pdf)"
                  forceDownload={true}
                  downloadName={pdfUrl ? decodeURIComponent(pdfUrl.split("/").pop()) : "Statement.pdf"}
                />
              </Col>
            </Row>
          </Row>
        </>
      )}
    </div>
  );
};

export default StatementOverview;
