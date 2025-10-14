import React, { useEffect, useMemo, useState, useRef } from "react";
import { Row, Col, Table } from "reactstrap";
import { useMonth } from "../../../components/Custom/MonthContext";
import { Card, CardBody } from "reactstrap";
import Select from "react-select";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Title,
  Legend
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Title, Legend);
ChartJS.defaults.font.family = "Segoe UI, sans-serif";

const SharedSection = () => {
  const [viewMode, setViewMode] = useState("Net Incoming");
  const [monthOptions, setMonthOptions] = useState([]);
  const [, setMonthlySummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [incomingTracks, setIncomingTracks] = useState([]);
  const [outgoingTracks, setOutgoingTracks] = useState([]);
  const [chartKey] = useState(0);
  const [page, setPage] = useState(1);
  const chartCanvasRef = useRef(null);
  const chartInstance = useRef(null);
  const hasNoData =
    (viewMode === "Net Incoming" && incomingTracks.every(t => !parseFloat(t.net_shared_royalty))) ||
    (viewMode === "Net Outgoing" && outgoingTracks.every(t => !parseFloat(t.net_shared_royalty)));

  const perPage = 10;

  const { selectedMonth, setSelectedMonth } = useMonth();

  useEffect(() => {
    if (!selectedMonth) return;

    const fetchAllData = async () => {
      setLoading(true);
      const token = localStorage.getItem("woss_token");
      const headers = { Authorization: `Bearer ${token}` };

      try {
        const [summaryRes, incomingRes, outgoingRes] = await Promise.all([
          fetch(`http://localhost:4000/api/royalties/monthly-tracks-summary?period=${selectedMonth}`, { headers }),
          fetch(`http://localhost:4000/api/royalties/tracks-incoming-summary?period=${selectedMonth}`, { headers }),
          fetch(`http://localhost:4000/api/royalties/tracks-outgoing-summary?period=${selectedMonth}`, { headers }),
        ]);

        const summaryJson  = await summaryRes.json();
        const incomingJson = await incomingRes.json();
        const outgoingJson = await outgoingRes.json();

        setMonthlySummary(summaryJson.success ? summaryJson.data : null);

        const incoming = incomingJson.success ? incomingJson.tracks || [] : [];
        const outgoing = outgoingJson.success ? outgoingJson.tracks || [] : [];

        // 👇 merge duplicates by track and sum percentages + amounts
        setIncomingTracks(aggregateByTrack(incoming));
        setOutgoingTracks(aggregateByTrack(outgoing));
      } catch (err) {
        console.error("❌ Fetch error:", err);
        setMonthlySummary(null);
        setIncomingTracks([]);
        setOutgoingTracks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [selectedMonth]);

  useEffect(() => {
    const loadPeriods = async () => {
      try {
        const token = localStorage.getItem("woss_token");
        const res = await fetch("http://localhost:4000/api/royalties/periods", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!data.success || !Array.isArray(data.periods)) return;

        const sorted = data.periods.sort();
        const opts = sorted.map(p => ({
          value: p,
          label: new Date(Date.UTC(+p.split("-")[0], +p.split("-")[1] - 1)).toLocaleString("en-US", {
            month: "long", year: "numeric", timeZone: "UTC"
          })
        }));
        setMonthOptions(opts);

        const latest = opts.at(-1);
        if (!selectedMonth && latest) setSelectedMonth(latest.value);
      } catch (err) {
        console.error("Error loading periods:", err);
      }
    };

    loadPeriods();
  }, [selectedMonth, setSelectedMonth]);

  useEffect(() => {
    setPage(1);
  }, [viewMode, selectedMonth]);

  const formatCurrency = value =>
    new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value || 0));

  const currentSource = viewMode === "Net Incoming" ? incomingTracks : outgoingTracks;

  const paginatedTracks = useMemo(() => {
    const start = (page - 1) * perPage;
    return currentSource.slice(start, start + perPage);
  }, [currentSource, page]);

  const totalPages = useMemo(() => {
    return Math.ceil(currentSource.length / perPage);
  }, [currentSource]);

  const handlePrevious = () => {
    if (page > 1) {
      setPage(p => p - 1);
    } else if (viewMode === "Net Outgoing") {
      setViewMode("Net Incoming");
    }
  };

  const handleNext = () => {
    if (page < totalPages) {
      setPage(p => p + 1);
    } else if (viewMode === "Net Incoming") {
      setViewMode("Net Outgoing");
    }
  };

  // ---- Sum all split percentages for a given track (by id when present, else by title) ----
  const sumSplitPercentForTrack = (track) => {
    const source = viewMode === "Net Incoming" ? incomingTracks : outgoingTracks;
    const keyId = track.track_id ?? track.id ?? null;
    const keyTitle = String(track.track_title || "").trim();

    return source.reduce((acc, t) => {
      const sameById = keyId != null && (t.track_id === keyId || t.id === keyId);
      const sameByTitle = keyId == null && String(t.track_title || "").trim() === keyTitle;
      if (sameById || sameByTitle) {
        acc += parseFloat(t.split_percentage || 0) || 0;
      }
      return acc;
    }, 0);
  };

  useEffect(() => {
    const canvas = chartCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const source = viewMode === "Net Incoming" ? incomingTracks : outgoingTracks;
    const labels = source.map(track => track.track_title);
    const data = source.map(track => parseFloat(track.net_shared_royalty || 0));

    if (!labels.length || data.every(v => v === 0)) return;

    chartInstance.current = new ChartJS(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "",
          data,
          backgroundColor: "#492599"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 10, bottom: 10, left: 10, right: 10 }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#111827",
            displayColors: false,
            titleFont: { size: 13, weight: "bold", family: "'Inter', sans-serif" },
            bodyFont: { size: 12, family: "'Inter', sans-serif" },
            bodyColor: "#D1D5DB",
            callbacks: {
              label: context => {
                const index = context.dataIndex;
                const track = source[index];

                const gross = parseFloat(track.original_earnings || 0);
                const feePercent = parseFloat(track.distribution_fee || 0) / 100;
                const netRoyalty = +(gross - gross * feePercent).toFixed(6);
                const netShared = parseFloat(track.net_shared_royalty || 0);

                return [
                  `Net Royalties: $${netRoyalty.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                  `Net Shared Royalties: ${viewMode === "Net Outgoing" ? "-" : ""}$${netShared.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                ];
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: val => `$${val}`,
              font: { size: 12, family: "'Inter', sans-serif" },
              color: "#1F2937"
            },
            grid: { drawTicks: false, color: "#E5E7EB", drawBorder: false }
          },
          x: {
            ticks: {
              autoSkip: true,
              maxRotation: 0,
              minRotation: 0,
              font: { size: 12, weight: "bold", family: "'Inter', sans-serif" },
              color: "#1F2937"
            },
            grid: { display: false }
          }
        },
        elements: { bar: { borderRadius: 0, borderSkipped: false } }
      }
    });
  }, [incomingTracks, outgoingTracks, viewMode]);

  // --- add helper near the top of file ---
  function aggregateByTrack(rows = []) {
    const map = new Map();
    for (const r of rows) {
      const key =
        r.release_track_id ??
        r.track_id ??
        r.trackId ??
        r.isrc ??
        r.track_title; // last-resort fallback

      const pct = parseFloat(r.split_percentage || 0) || 0;
      const net = parseFloat(r.net_shared_royalty || 0) || 0;

      if (map.has(key)) {
        const acc = map.get(key);
        acc.split_percentage = +(parseFloat(acc.split_percentage || 0) + pct).toFixed(6);
        acc.net_shared_royalty = +(parseFloat(acc.net_shared_royalty || 0) + net).toFixed(6);
        // keep first seen values for static fields (title, fee, earnings, etc.)
      } else {
        map.set(key, {
          ...r,
          split_percentage: pct,
          net_shared_royalty: net,
        });
      }
    }
    return Array.from(map.values());
  }

  return (
    <div className="position-relative" style={{ minHeight: "700px" }}>
      {loading && (
        <div className="loader-container">
          <div className="loader" />
          <p className="loader-text">Processing Data...</p>
        </div>
      )}

      {!loading && (
        <Row className="w-100 align-items-center" style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <Col xs="12">
            <div className="responsive-header mb-4">
              <div className="d-none d-md-flex align-items-center justify-content-between position-relative">
                <div style={{ minWidth: "180px", marginLeft: "16px" }}>
                  {/* Always render Select, even if options are empty */}
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
                  <h2 className="font-weight-bold mb-1">Shared Royalties Overview</h2>
                  <p className="h5 text-muted mb-0">by Incoming Shared or Outgoing Shared</p>
                </div>
                <div className="desktop-currency" style={{ minWidth: "60px", textAlign: "right", marginRight: "16px" }}>
                  <span className="currency-label">
                    USD <i className="fa fa-exclamation-circle ml-1" title="Currency: US Dollar" />
                  </span>
                </div>
              </div>

              <div className="d-block d-md-none px-2">
                <div className="mobile-title-row mb-3">
                  <div>
                    <h2 className="font-weight-bold mb-1">Shared Royalties Overview</h2>
                    <p className="h5 text-muted mb-0">by Incoming Shared or Outgoing Shared</p>
                  </div>
                  <span className="currency-label">
                    | USD <i className="fa fa-exclamation-circle" title="Currency: US Dollar" />
                  </span>
                </div>
                <div className="mobile-select-wrapper mt-2">
                  {/* Always render on mobile as well */}
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
                <hr className="mb-2" />
              </div>
            </div>

            <div className="selector-container d-flex justify-content-center gap-4">
              {["Net Incoming", "Net Outgoing"].map(type => (
                <label key={type} className={`selector-option ${viewMode === type ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="viewMode"
                    value={type}
                    checked={viewMode === type}
                    onChange={() => {
                      setLoading(true);
                      setTimeout(() => {
                        setViewMode(type);
                        setLoading(false);
                      }, 200);
                    }}
                  />
                  <span className="custom-radio"></span> {type}
                </label>
              ))}
            </div>

            <Row className="justify-content-center" style={{ maxWidth: "1100px", margin: "0 auto" }}>
              <Col xs="12">
                <div className="shared-chart-wrapper position-relative">
                  {hasNoData && (
                    <div className="no-data-overlay">
                      <p>No Data Reported</p>
                    </div>
                  )}

                  <Card>
                    <CardBody>
                      <Card
                        className="p-4"
                        style={{ marginBottom: 0, boxShadow: "none", border: "1px solid rgba(89, 89, 89, 0.12)" }}
                      >
                        <CardBody className="p-0" style={{ height: "400px" }}>
                          {(viewMode === "Net Incoming" && incomingTracks.every(t => !parseFloat(t.net_shared_royalty))) ||
                          (viewMode === "Net Outgoing" && outgoingTracks.every(t => !parseFloat(t.net_shared_royalty))) ? (
                            <div className="d-flex justify-content-center align-items-center h-100">
                              <h5 className="text-muted">No chart data for this selection.</h5>
                            </div>
                          ) : (
                            <div style={{ height: "100%", width: "100%" }}>
                              <canvas key={chartKey} ref={chartCanvasRef} style={{ height: "100%", width: "100%" }} />
                            </div>
                          )}
                        </CardBody>
                      </Card>
                    </CardBody>
                  </Card>

                  {/* Table for Net Incoming */}
                  {viewMode === "Net Incoming" && (
                    <div className="table-responsive">
                      <Table className="table shadow table-bordered table-hover text-center bg-white no-outer-border">
                        <thead className="bg-light">
                          <tr>
                            <th className="bg-primary text-white">Tracks</th>
                            <th className="bg-dark text-white">Net Royalties</th>
                            <th className="bg-dark text-white">Incoming Percentage</th>
                            <th className="bg-primary text-white">Net Shared Royalties</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedTracks.length === 0 ? (
                            <tr><td colSpan="4" className="text-muted">No incoming shared royalties.</td></tr>
                          ) : (
                            <>
                              {paginatedTracks.map((track, idx) => {
                                const gross = parseFloat(track.original_earnings || 0);
                                const feePercent = parseFloat(track.distribution_fee || 0) / 100;
                                const netRoyalty = +(gross - gross * feePercent).toFixed(6);
                                const netShared = parseFloat(track.net_shared_royalty || 0);
                                const totalPct = sumSplitPercentForTrack(track);

                                return (
                                  <tr key={idx}>
                                    <td>{track.track_title}</td>
                                    <td>{formatCurrency(netRoyalty)}</td>
                                    <td>{totalPct.toFixed(2)}%</td>
                                    <td><strong>{formatCurrency(netShared)}</strong></td>
                                  </tr>
                                );
                              })}
                              <tr style={{ fontWeight: "bold" }}>
                                <td colSpan="3" className="text-center pl-3">Total</td>
                                <td>{formatCurrency(incomingTracks.reduce((s, t) => s + parseFloat(t.net_shared_royalty || 0), 0))}</td>
                              </tr>
                            </>
                          )}
                        </tbody>
                      </Table>
                    </div>
                  )}

                  {/* Table for Net Outgoing */}
                  {viewMode === "Net Outgoing" && (
                    <div className="table-responsive">
                      <Table className="table shadow table-bordered table-hover text-center bg-white no-outer-border">
                        <thead className="bg-light">
                          <tr>
                            <th className="bg-primary text-white">Tracks</th>
                            <th className="bg-dark text-white">Net Royalties</th>
                            <th className="bg-dark text-white">Outgoing Percentage</th>
                            <th className="bg-primary text-white">Net Shared Royalties</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedTracks.length === 0 ? (
                            <tr><td colSpan="4" className="text-muted">No outgoing shared royalties.</td></tr>
                          ) : (
                            <>
                              {paginatedTracks.map((track, idx) => {
                                const gross = parseFloat(track.original_earnings || 0);
                                const feePercent = parseFloat(track.distribution_fee || 0) / 100;
                                const netRoyalty = +(gross - gross * feePercent).toFixed(6);
                                const netShared = parseFloat(track.net_shared_royalty || 0);
                                const totalPct = sumSplitPercentForTrack(track);

                                return (
                                  <tr key={idx}>
                                    <td>{track.track_title}</td>
                                    <td>{formatCurrency(netRoyalty)}</td>
                                    <td>{totalPct.toFixed(2)}%</td>
                                    <td><strong>{viewMode === "Net Outgoing" ? "-" : ""}{formatCurrency(netShared)}</strong></td>
                                  </tr>
                                );
                              })}
                              <tr style={{ fontWeight: "bold" }}>
                                <td colSpan="3" className="text-center pl-3">Total</td>
                                <td>
                                  {viewMode === "Net Outgoing" ? "-" : ""}
                                  {formatCurrency(
                                    outgoingTracks.reduce((s, t) => s + parseFloat(t.net_shared_royalty || 0), 0)
                                  )}
                                </td>
                              </tr>
                            </>
                          )}
                        </tbody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="d-flex justify-content-center mt-3">
                    <button
                      onClick={handlePrevious}
                      className="btn btn-sm btn-secondary mr-2"
                      disabled={page === 1 && viewMode === "Net Incoming"}
                    >
                      Previous
                    </button>
                    <span className="align-self-center mx-2">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={handleNext}
                      className="btn btn-sm btn-secondary ml-2"
                      disabled={page === totalPages && viewMode === "Net Outgoing"}
                    >
                      Next
                    </button>
                  </div>
                )}
              </Col>
            </Row>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default SharedSection;
