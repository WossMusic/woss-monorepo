import React, { useEffect, useMemo, useState } from "react";
import { Row, Col, Table } from "reactstrap";
import countryNameMap from "../../../components/Data/countryNameMap.json";
import { useMonth } from "../../../components/Custom/MonthContext";
import Select from "react-select";

const countryColors = [
  "#224b48", "#2b5e5b", "#33706d", "#3c837f", "#449691", "#6eb3b1"
];

const TracksSection = () => {
  const [trackData, setTrackData] = useState([]);
  const [trackCountries, setTrackCountries] = useState({});
  const [viewMode, setViewMode] = useState("distribution");
  const [hovered, setHovered] = useState({ trackIndex: null, type: null, country: null });
  const [viewSales, setViewSales] = useState(false);
  const [monthOptions, setMonthOptions] = useState([]);
  const [, setMonthlySummary] = useState(null);
  const [loading, setLoading] = useState(false);

  // ✅ Use real context values directly
  const { selectedMonth, setSelectedMonth } = useMonth();

  useEffect(() => {
    if (!selectedMonth) return;

    const fetchAllData = async () => {
      setLoading(true);
      const token = localStorage.getItem("woss_token");
      const headers = { Authorization: `Bearer ${token}` };

      try {
        const [tracksRes, countriesRes, summaryRes] = await Promise.all([
          fetch(`http://localhost:4000/api/royalties/tracks-summary?period=${selectedMonth}`, { headers }),
          fetch(`http://localhost:4000/api/royalties/tracks-summary-countries?period=${selectedMonth}`, { headers }),
          fetch(`http://localhost:4000/api/royalties/monthly-tracks-summary?period=${selectedMonth}`, { headers }),
        ]);

        const tracksJson = await tracksRes.json();
        const countriesJson = await countriesRes.json();
        const summaryJson = await summaryRes.json();

        if (tracksJson.success) setTrackData(tracksJson.tracks);
        if (countriesJson.success) setTrackCountries(countriesJson.tracks);
        if (summaryJson.success && summaryJson.data) {
          setMonthlySummary(summaryJson.data);
        } else {
          setMonthlySummary(null);
        }
      } catch (err) {
        console.error("❌ Fetch error:", err);
        setTrackData([]);
        setTrackCountries({});
        setMonthlySummary(null);
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
          label: new Date(Date.UTC(+p.split("-")[0], +p.split("-")[1] - 1))
            .toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
        }));
        setMonthOptions(opts);

        // ✅ This check and update should be after state is set
        const latest = opts.at(-1);
        if (!selectedMonth && latest) {
          setSelectedMonth(latest.value);
        }
      } catch (err) {
        console.error("Error loading periods:", err);
      }
    };

    loadPeriods();
  }, [selectedMonth, setSelectedMonth]);

  const filteredTracks = useMemo(() => {
    return trackData.map(track => {
      const countriesRaw = trackCountries[track.title] || [];
      const countries = countriesRaw.map(c => ({
        ...c,
        country: c.iso,
        displayName: countryNameMap[c.iso] || c.iso
      }));

      const totalCountryEarnings = countries.reduce((sum, c) => sum + c.earnings, 0);
      const sortedCountries = [...countries].sort((a, b) => b.earnings - a.earnings);
      const top5 = sortedCountries.slice(0, 5);
      const allOthers = sortedCountries.slice(5);
      const othersEarnings = allOthers.reduce((s, c) => s + c.earnings, 0);
      const othersUnits = allOthers.reduce((s, c) => s + c.units, 0);

      const topBars = top5.map((c, idx) => ({
        country: c.displayName,
        earnings: c.earnings,
        units: c.units,
        color: countryColors[idx] || "#ccc",
        percent: totalCountryEarnings ? (c.earnings / totalCountryEarnings) * 100 : 0
      }));

      const allBars = [...topBars];
      if (othersEarnings > 0) {
        allBars.push({
          country: "All Others",
          earnings: othersEarnings,
          units: othersUnits,
          color: countryColors[topBars.length] || "#ccc",
          percent: totalCountryEarnings ? (othersEarnings / totalCountryEarnings) * 100 : 0
        });
      }

      return {
        ...track,
        countryList: countries,
        totalCountryEarnings,
        countryBars: allBars,
        downloads: track.downloads || 0,
        downloads_units: track.downloads_units || 0,
        subscription: track.subscription || 0,
        subscription_units: track.subscription_units || 0,
        adSupported: track.adSupported || 0,
        ad_supported_units: track.ad_supported_units || 0
      };
    });
  }, [trackData, trackCountries]);

  const handleMouseEnter = (i, type, country) =>
    setHovered({ trackIndex: i, type, country });
  const handleMouseLeave = () =>
    setHovered({ trackIndex: null, type: null, country: null });

  const formatCurrency = value =>
    new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value || 0));

  const formatUnits = value =>
    new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0
    }).format(Number(value || 0));

  const [distPage, setDistPage] = useState(1);
  const tracksPerPage = 1;

  const paginatedTracks = useMemo(() => {
    if (filteredTracks.length > 10) {
      const start = (distPage - 1) * tracksPerPage;
      return filteredTracks.slice(start, start + tracksPerPage);
    }
    return filteredTracks;
  }, [filteredTracks, distPage]);

  const totalPages = Math.ceil(filteredTracks.length / tracksPerPage);

  return (
    <div className="position-relative" style={{ minHeight: "700px" }}>
      {loading && (
        <div className="loader-container">
          <div className="loader" />
          <p className="loader-text">Processing Data...</p>
        </div>
      )}

      {!loading && (
        <Row className="w-100 mb-4 align-items-center" style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <Col xs="12">
            <div className="responsive-header mb-4">
              {/* ✅ Desktop layout */}
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
                  <h2 className="font-weight-bold mb-1">Tracks Overview</h2>
                  <p className="h5 text-muted mb-0">by Channel or Country</p>
                </div>
                <div className="desktop-currency" style={{ minWidth: "60px", textAlign: "right", marginRight: "16px" }}>
                  <span className="currency-label">
                    USD <i className="fa fa-exclamation-circle ml-1" title="Currency: US Dollar" />
                  </span>
                </div>
              </div>

              {/* ✅ Mobile layout */}
              <div className="d-block d-md-none px-2">
                <div className="mobile-title-row mb-3">
                  <div>
                    <h2 className="font-weight-bold mb-1">Tracks Overview</h2>
                    <p className="h5 text-muted mb-0">by Channel or Country</p>
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

            {/* Toggle */}
            <div className="selector-container mb-4 d-flex justify-content-center gap-4">
              <label className={`selector-option ${viewMode === "distribution" ? "active" : ""}`}>
                <input
                  type="radio" name="viewMode" value="distribution"
                  checked={viewMode === "distribution"}
                  onChange={() => setViewMode("distribution")}
                />
                <span className="custom-radio"></span> Channels
              </label>
              <label className={`selector-option ${viewMode === "countries" ? "active" : ""}`}>
                <input
                  type="radio" name="viewMode" value="countries"
                  checked={viewMode === "countries"}
                  onChange={() => setViewMode("countries")}
                />
                <span className="custom-radio"></span> Countries
              </label>
            </div>

            <Row className="justify-content-center" style={{ maxWidth: "1100px", margin: "0 auto" }}>
              <Col xs="12">
                {/* Track summary table */}
                <Table className="shadow table text-center bg-white no-outer-border">
                  <thead className="text-white">
                    <tr className="bg-primary">
                      <th>#</th><th className="text-left">Track</th><th>Streams</th><th>Total Earnings</th>
                    </tr>
                  </thead>
                  <tbody className="text-dark">
                    {paginatedTracks.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-muted">No track data available for this month.</td>
                      </tr>
                    ) : paginatedTracks.map((track, idx) => {
                      const isCountryMode = viewMode === "countries";
                      const total = isCountryMode
                        ? track.totalCountryEarnings
                        : track.downloads + track.subscription + track.adSupported;

                      let bars = isCountryMode ? track.countryBars.map(b => ({
                        ...b,
                        type: "country",
                        label: countryNameMap[b.country] || b.country
                      })) : [
                        { type: "downloads", label: "Downloads", color: "#492599", value: track.downloads, units: track.downloads_units, percent: total ? (track.downloads / total) * 100 : 0 },
                        { type: "subscription", label: "Subscription", color: "#5b30bf", value: track.subscription, units: track.subscription_units, percent: total ? (track.subscription / total) * 100 : 0 },
                        { type: "adSupported", label: "Ad Supported", color: "#8B5CF6", value: track.adSupported, units: track.ad_supported_units, percent: total ? (track.adSupported / total) * 100 : 0 }
                      ];

                      const filteredBars = bars.filter(b => (b.value || b.earnings || 0) > 0 || (b.units || 0) > 0);
                      if (filteredBars.length === 0) {
                        filteredBars.push({
                          type: "placeholder",
                          label: "No Data",
                          color: "#ccc",
                          value: 0,
                          units: 0,
                          percent: 100
                        });
                      }

                      return (
                        <tr key={idx}>
                          <td>{(distPage - 1) * tracksPerPage + idx + 1}</td>
                          <td className="text-left">{track.title}</td>
                          <td className="position-relative">
                            <div className="d-flex position-relative">
                              {filteredBars.map((bar, i) => {
                                const isHovering = hovered.trackIndex === idx && hovered.type === bar.type && hovered.country === bar.label;
                                return (
                                  <div
                                    key={i}
                                    className={`bar position-relative tracks-bar-${bar.type}`}
                                    style={{ width: `${bar.percent}%`, backgroundColor: bar.color, height: "12px", marginRight: "1px", cursor: "pointer" }}
                                    onMouseEnter={() => handleMouseEnter(idx, bar.type, bar.label)}
                                    onMouseLeave={handleMouseLeave}
                                  >
                                    {isHovering && (
                                      <div className={`hover-tooltip tracks-tooltip tracks-tooltip-${bar.type}`}>
                                        <div>{bar.label}</div>
                                        <div>{formatCurrency(bar.value || bar.earnings)} USD</div>
                                        <i>{formatUnits(bar.units)} Units</i>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                          <td className="font-weight-bold">{total > 0 ? `${formatCurrency(total)} USD` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>

                {/* Pagination */}
                {filteredTracks.length > 10 && (
                  <div className="custom-pagination text-center mt-3">
                    <button
                      className="pagination-btn"
                      onClick={() => distPage > 1 && setDistPage(distPage - 1)}
                      disabled={distPage === 1}
                    >
                      Previous
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        className={`pagination-btn number ${distPage === i + 1 ? "active" : ""}`}
                        onClick={() => setDistPage(i + 1)}
                      >
                        {i + 1}
                      </button>
                    ))}

                    <button
                      className="pagination-btn"
                      onClick={() => distPage < totalPages && setDistPage(distPage + 1)}
                      disabled={distPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                )}
              </Col>
            </Row>

            {/* Earnings detail table */}
            <div className="mt-2">
              <h4 className="text-center font-weight-bold">Top Tracks for Total Earnings</h4>
              <div className="text-center mt-2 mb-2 small-checkbox">
                <label className="h5">
                  <input type="checkbox" checked={viewSales} onChange={() => setViewSales(prev => !prev)} className="mr-1" />
                  Sales Units
                </label>
              </div>

              {viewMode === "distribution" && (() => {
                return (
                  <>
                    <Row className="justify-content-center" style={{ maxWidth: "1100px", margin: "0 auto" }}>
                      <Col xs="12">
                        <div className="table-responsive">
                          <Table className="table shadow table-bordered table-hover text-center bg-white no-outer-border">
                            <thead className="bg-light">
                              <tr>
                                <th className="bg-primary text-white">Top Tracks</th>
                                <th className="bg-dark text-white">Downloads</th>
                                <th className="bg-dark text-white">Streams: Subscription</th>
                                <th className="bg-dark text-white">Streams: Ad Supported</th>
                                <th className="bg-primary text-white">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {trackData.length === 0 ? (
                                <tr>
                                  <td colSpan="5" className="text-muted">No track data available for this month.</td>
                                </tr>
                              ) : (
                                <>
                                  {trackData.map((track, idx) => {
                                    const dl = track.downloads || 0;
                                    const sub = track.subscription || 0;
                                    const ad = track.adSupported || 0;
                                    const dlU = track.downloads_units || 0;
                                    const subU = track.subscription_units || 0;
                                    const adU = track.ad_supported_units || 0;
                                    const total = dl + sub + ad;
                                    const totalU = dlU + subU + adU;

                                    return (
                                      <tr key={idx}>
                                        <td>{track.title}</td>
                                        <td>
                                          {formatCurrency(dl)}
                                          {viewSales && <div className="units-subtext">{formatUnits(dlU)}</div>}
                                        </td>
                                        <td>
                                          {formatCurrency(sub)}
                                          {viewSales && <div className="units-subtext">{formatUnits(subU)}</div>}
                                        </td>
                                        <td>
                                          {formatCurrency(ad)}
                                          {viewSales && <div className="units-subtext">{formatUnits(adU)}</div>}
                                        </td>
                                        <td>
                                          <strong>{formatCurrency(total)}</strong>
                                          {viewSales && <div className="units-subtext">{formatUnits(totalU)}</div>}
                                        </td>
                                      </tr>
                                    );
                                  })}

                                  {/* ✅ Totals Row */}
                                  <tr style={{  fontWeight: "bold" }}>
                                    <td>Total</td>
                                    <td>
                                      {formatCurrency(trackData.reduce((sum, t) => sum + (t.downloads || 0), 0))}
                                      {viewSales && (
                                        <div className="units-subtext">
                                          {formatUnits(trackData.reduce((sum, t) => sum + (t.downloads_units || 0), 0))}
                                        </div>
                                      )}
                                    </td>
                                    <td>
                                      {formatCurrency(trackData.reduce((sum, t) => sum + (t.subscription || 0), 0))}
                                      {viewSales && (
                                        <div className="units-subtext">
                                          {formatUnits(trackData.reduce((sum, t) => sum + (t.subscription_units || 0), 0))}
                                        </div>
                                      )}
                                    </td>
                                    <td>
                                      {formatCurrency(trackData.reduce((sum, t) => sum + (t.adSupported || 0), 0))}
                                      {viewSales && (
                                        <div className="units-subtext">
                                          {formatUnits(trackData.reduce((sum, t) => sum + (t.ad_supported_units || 0), 0))}
                                        </div>
                                      )}
                                    </td>
                                    <td>
                                      <strong>
                                        {formatCurrency(trackData.reduce((sum, t) =>
                                          sum + (t.downloads || 0) + (t.subscription || 0) + (t.adSupported || 0), 0))}
                                      </strong>
                                      {viewSales && (
                                        <div className="units-subtext">
                                          {formatUnits(trackData.reduce((sum, t) =>
                                            sum + (t.downloads_units || 0) + (t.subscription_units || 0) + (t.ad_supported_units || 0), 0))}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                </>
                              )}
                            </tbody>
                          </Table>
                        </div>
                      </Col>
                    </Row>
                  </>
                );
              })()}

              {viewMode === "countries" && (
                <Row className="justify-content-center" style={{ maxWidth: "1100px", margin: "0 auto" }}>
                  <Col xs="12">
                    <div className="table-responsive">
                      <Table striped bordered hover className="text-center shadow">
                        {(() => {
                          // 1️⃣ Aggregate earnings per country
                          const countryEarnings = {};
                          filteredTracks.forEach(track => {
                            (trackCountries[track.title] || []).forEach(({ iso, earnings }) => {
                              if (!iso) return;
                              countryEarnings[iso] = (countryEarnings[iso] || 0) + earnings;
                            });
                          });

                          // 2️⃣ Sort & identify top countries
                          const sortedCountries = Object.entries(countryEarnings)
                            .sort((a, b) => b[1] - a[1])
                            .map(([iso]) => iso);

                          const topCountries = sortedCountries.slice(0, 5);
                          const otherCountries = sortedCountries.slice(5);

                          // 3️⃣ Define final display columns
                          const showAllOthers = otherCountries.length > 0;
                          const allColumns = [...topCountries];
                          if (showAllOthers) allColumns.push("All Others");

                          // 4️⃣ Totals tracking
                          const colTotals = {};
                          let grandTotalEarnings = 0;
                          let grandTotalUnits = 0;

                          // 5️⃣ Build table rows
                          const matrixRows = filteredTracks.map((track, idx) => {
                            const countryList = trackCountries[track.title] || [];
                            const countryMap = Object.fromEntries(
                              countryList.map(c => [c.iso || c.country, c])
                            );

                            const earnings = {};
                            const units = {};
                            let rowTotal = 0;
                            let rowUnits = 0;

                            allColumns.forEach(iso => {
                              if (iso === "All Others") {
                                const others = countryList.filter(
                                  c => !topCountries.includes(c.iso || c.country)
                                );
                                const e = others.reduce((s, x) => s + x.earnings, 0);
                                const u = others.reduce((s, x) => s + x.units, 0);
                                earnings[iso] = e;
                                units[iso] = u;
                              } else {
                                const e = countryMap[iso]?.earnings || 0;
                                const u = countryMap[iso]?.units || 0;
                                earnings[iso] = e;
                                units[iso] = u;
                              }

                              rowTotal += earnings[iso];
                              rowUnits += units[iso];

                              if (!colTotals[iso]) colTotals[iso] = { earnings: 0, units: 0 };
                              colTotals[iso].earnings += earnings[iso];
                              colTotals[iso].units += units[iso];
                            });

                            grandTotalEarnings += rowTotal;
                            grandTotalUnits += rowUnits;

                            return (
                              <tr key={idx}>
                                <td>{`${idx + 1}. ${track.title}`}</td>
                                {allColumns.map((iso, i) => (
                                  <td key={i}>
                                    {formatCurrency(earnings[iso])}
                                    {viewSales && units[iso] > 0 && (
                                      <div className="units-subtext">{formatUnits(units[iso])}</div>
                                    )}
                                  </td>
                                ))}
                                <td className="font-weight-bold">
                                  {formatCurrency(rowTotal)}
                                  {viewSales && rowUnits > 0 && (
                                    <div className="units-subtext">{formatUnits(rowUnits)}</div>
                                  )}
                                </td>
                              </tr>
                            );
                          });

                          return (
                            <>
                              <thead className="bg-light">
                                <tr>
                                  <th className="bg-primary text-white">Top Tracks</th>
                                  {allColumns.map((iso, i) => (
                                    <th key={i} className="bg-dark text-white">
                                      {countryNameMap[iso] || iso}
                                    </th>
                                  ))}
                                  <th className="bg-primary text-white">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {matrixRows}
                                <tr style={{fontWeight: "bold" }}>
                                  <td>Total</td>
                                  {allColumns.map((iso, i) => (
                                    <td key={i}>
                                      {formatCurrency(colTotals[iso].earnings)}
                                      {viewSales && colTotals[iso].units > 0 && (
                                        <div className="units-subtext">{formatUnits(colTotals[iso].units)}</div>
                                      )}
                                    </td>
                                  ))}
                                  <td >
                                    <strong>{formatCurrency(grandTotalEarnings)}</strong>
                                    {viewSales && (
                                      <div className="units-subtext">{formatUnits(grandTotalUnits)}</div>
                                    )}
                                  </td>
                                </tr>
                              </tbody>
                            </>
                          );
                        })()}
                      </Table>
                    </div>
                  </Col>
                </Row>
              )}
            </div>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default TracksSection;
