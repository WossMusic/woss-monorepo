import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Row, Col, CardBody } from "reactstrap";
import { VectorMap } from "@react-jvectormap/core";
import { worldMill } from "@react-jvectormap/world";
import "jvectormap-next/jquery-jvectormap.css";
import countryNameMap from "../../../components/Data/countryNameMap.json";
import { useMonth } from "../../../components/Custom/MonthContext";
import Select from "react-select";

const CountriesSection = () => {
  const [providerEarnings, setProviderEarnings] = useState({});
  const [loading, setLoading] = useState(false);
  const [viewSales, setViewSales] = useState(false);
  const monthContext = useMonth();
  const [monthOptions, setMonthOptions] = useState([]);
  const selectedMonth = monthContext?.selectedMonth ?? null;
  const setSelectedMonth = useMemo(() => monthContext?.setSelectedMonth ?? (() => {}), [monthContext]);

  // ---- helper: strip “shared as invitee” from API payload (non-destructive if not present) ----
  function stripInviteeShared(dataObj) {
    const result = {};
    const isInviteeKey = (k) =>
      /invitee/i.test(k) || /shared.*invitee/i.test(k) || /invitee.*shared/i.test(k);

    for (const [iso, entry] of Object.entries(dataObj || {})) {
      if (!entry || typeof entry !== "object") continue;

      const { total: _origTotal, units: _origUnits, ...rest } = entry;

      let total = 0;
      let units = 0;
      const cleaned = {};

      for (const [k, v] of Object.entries(rest)) {
        if (isInviteeKey(k)) continue;

        if (v && typeof v === "object") {
          const e = Number(v.earnings ?? v.total ?? 0);
          const u = Number(v.units ?? 0);
          cleaned[k] = { ...v };
          if (Number.isFinite(e)) total += e;
          if (Number.isFinite(u)) units += u;
        }
      }

      result[iso] = { ...cleaned, total, units };
    }
    return result;
  }

  useEffect(() => {
    if (!selectedMonth) return;

    const token = localStorage.getItem("woss_token");
    setLoading(true);
    setProviderEarnings({}); // clear instantly

    fetch(`http://localhost:4000/api/royalties/countries?period=${selectedMonth}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(json => {
        if (json.success && typeof json.data === "object") {
          validateCountryISOs(json.data);
          const cleaned = stripInviteeShared(json.data);
          setProviderEarnings(cleaned);
        } else {
          setProviderEarnings({});
        }
      })
      .catch(err => {
        console.error("🌐 Fetch error:", err);
        setProviderEarnings({});
      })
      .finally(() => setLoading(false));
  }, [selectedMonth]);

  useEffect(() => {
    const token = localStorage.getItem("woss_token");

    fetch("http://localhost:4000/api/royalties/periods", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.periods)) {
          const options = json.periods.map(periodStr => {
            const [year, month] = periodStr.split("-");
            const date = new Date(year, parseInt(month) - 1);
            const label = date.toLocaleString("en-US", { month: "long", year: "numeric" });
            return { label, value: periodStr };
          });

          setMonthOptions(options);

          const latest = options.at(-1);
          if (!selectedMonth || !options.find(o => o.value === selectedMonth)) {
            setSelectedMonth(latest.value);
          }
        } else {
          setMonthOptions([]);
        }
      })
      .catch((err) => {
        console.error("❌ Failed to load periods:", err);
        setMonthOptions([]);
      });
  }, [selectedMonth, setSelectedMonth]);

  const formatCurrency = (val) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parseFloat(val || 0));

  const formatUnits = (val) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(parseFloat(val || 0));

  const getColor = useCallback((iso) => {
    const entry = providerEarnings[iso];
    if (!entry || !entry.total || entry.total <= 0) return "#bbe4e1";
    const value = entry.total;
    if (value > 1000) return "#2b5e5b";
    if (value > 500) return "#33706d";
    if (value > 250) return "#3c837f";
    if (value > 100) return "#449691";
    if (value > 50) return "#4da9a3";
    if (value > 10) return "#56bcb6";
    return "#aaddda";
  }, [providerEarnings]);

  // Build colors for ALL countries, even when there’s no data → hatch pattern
  const mapColors = useMemo(() => {
    const colors = {};
    for (const iso in countryNameMap) {
      colors[iso] = providerEarnings[iso] ? getColor(iso) : "url(#diagonalHatch)";
    }
    return colors;
  }, [providerEarnings, getColor]);

  const handleRegionTipShow = (e, el, code) => {
    const upperCode = code.toUpperCase();
    const entry = providerEarnings[upperCode];
    const countryLabel = countryNameMap[upperCode] || el.html();

    const earnings = parseFloat(entry?.total ?? 0);
    const units = parseFloat(entry?.units ?? 0);

    if (earnings > 0 || units > 0) {
      el.html(`
        <div style="background: #333; color: #fff; padding: 10px 14px; border-radius: 6px; font-family: 'Segoe UI', sans-serif; min-width: 180px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);">
          <div style="font-size: 14px; font-weight: 600;">${countryLabel}</div>
          <div style="font-size: 16px; font-weight: bold; margin-top: 6px;">
            ${formatCurrency(earnings)}
          </div>
          <div style="font-size: 11px; font-style: italic; margin-top: 2px; color: #ccc;">
            ${units.toLocaleString()} Units
          </div>
        </div>
      `);
    } else {
      el.html(`
        <div style="background: #444; color: #fff; padding: 8px 12px; border-radius: 6px; font-size: 13px; font-family: 'Segoe UI', sans-serif; min-width: 160px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);">
          <div style="font-size: 14px; font-weight: 600;">${countryLabel}</div>
          <div style="font-size: 13px; font-style: italic; margin-top: 4px;">No data</div>
        </div>
      `);
    }
  };

  const validateCountryISOs = (data) => {
    const known = new Set(Object.keys(countryNameMap));
    const invalid = Object.keys(data).filter((iso) => !known.has(iso));
    if (invalid.length > 0) console.warn("⚠️ Unmapped ISOs:", invalid);
  };

  const normalizeProviderKey = (key) => {
    const k = String(key || "").toLowerCase().trim();
    if (["tiktok","musical.ly"].includes(k)) return "tiktok";
    if (["apple music", "apple"].includes(k)) return "apple";
    if (["youtube"].includes(k)) return "youtube";
    if (["spotify"].includes(k)) return "spotify";
    if (["facebook"].includes(k)) return "facebook";
    if (["instagram"].includes(k)) return "instagram";
    return k;
  };

  const sorted = Object.entries(providerEarnings)
    .filter(([, d]) => d.total > 0)
    .sort(([, a], [, b]) => b.total - a.total);

  const providerAggregates = {};
  sorted.forEach(([, d]) => {
    Object.entries(d).forEach(([rawKey, val]) => {
      const key = normalizeProviderKey(rawKey);
      if (!val || typeof val !== "object") return;

      const earnings = parseFloat(val.earnings || 0);
      const units = parseFloat(val.units || 0);
      if (earnings === 0 && units === 0) return;

      providerAggregates[key] = providerAggregates[key] || { earnings: 0, units: 0 };
      providerAggregates[key].earnings += earnings;
      providerAggregates[key].units += units;
    });
  });

  const FIXED_PROVIDERS = ["youtube", "spotify"];

  const additionalCandidates = Object.entries(providerAggregates)
    .filter(([key]) => !FIXED_PROVIDERS.includes(normalizeProviderKey(key)))
    .sort(([, a], [, b]) => {
      const scoreA = a.earnings + a.units * 0.0001;
      const scoreB = b.earnings + b.units * 0.0001;
      return scoreB - scoreA;
    })
    .slice(0, 3)
    .map(([key]) => normalizeProviderKey(key));

  const topProviders = [...FIXED_PROVIDERS, ...additionalCandidates];

  const agg = (arr) =>
    arr.reduce(
      (acc, [, d]) => {
        topProviders.forEach((key) => {
          const val = d[key];
          if (val) {
            acc[key] = acc[key] || { earnings: 0, units: 0 };
            acc[key].earnings += parseFloat(val.earnings || 0);
            acc[key].units += parseFloat(val.units || 0);
          }
        });
        acc.total += parseFloat(d.total || 0);
        acc.units += parseFloat(d.units || 0);
        return acc;
      },
      { total: 0, units: 0 }
    );

  const topLimit = 10;
  const top = sorted.slice(0, topLimit);
  const rest = sorted.slice(topLimit);
  const topAgg = agg(top);
  const restAgg = agg(rest);
  const grandTotal = agg(sorted);

  const renderRow = (label, d, bold = false) => {
    const style = bold ? { fontWeight: "bold", backgroundColor: "#f3f3f3" } : {};
    const getVal = (key, type = "earnings") => {
      const normalized = normalizeProviderKey(key);
      const val = d[normalized];
      return typeof val === "object" ? parseFloat(val[type] || 0) : 0;
    };

    const renderCell = (key) => {
      const earnings = getVal(key, "earnings");
      const units = getVal(key, "units");
      if (earnings === 0 && units === 0) return <td key={key}></td>;
      return (
        <td key={key} style={style}>
          {formatCurrency(earnings)}
          {viewSales && (
            <div style={{ fontSize: "0.55rem", color: "#666", marginTop: "2px" }}>
              {formatUnits(units)}
            </div>
          )}
        </td>
      );
    };

    const topEarnings = topProviders.reduce((sum, k) => sum + getVal(k, "earnings"), 0);
    const topUnits = topProviders.reduce((sum, k) => sum + getVal(k, "units"), 0);
    const allOtherEarnings = parseFloat(d.total || 0) - topEarnings;
    const allOtherUnits = parseFloat(d.units || 0) - topUnits;

    return (
      <tr key={label}>
        <td style={style}>{label}</td>
        {topProviders.map((key) => renderCell(key))}
        <td style={style}>
          {formatCurrency(topEarnings)}
          {viewSales && <div className="units-subtext">{formatUnits(topUnits)}</div>}
        </td>
        <td style={style}>
          {formatCurrency(allOtherEarnings)}
          {viewSales && <div className="units-subtext">{formatUnits(allOtherUnits)}</div>}
        </td>
        <td style={style}>
          <strong>{formatCurrency(d.total)}</strong>
          {viewSales && <div className="units-subtext">{formatUnits(d.units)}</div>}
        </td>
      </tr>
    );
  };

  useEffect(() => {
    const allISOs = Object.keys(countryNameMap);
    const unmatched = Object.keys(providerEarnings).filter(
      (iso) => !allISOs.includes(iso)
    );
    if (unmatched.length > 0) {
      console.warn("⚠️ These ISOs in data are not mapped in countryNameMap:", unmatched);
    }
  }, [providerEarnings]);

  return (
    <Row className="w-100 align-items-center" style={{ maxWidth: "1100px", margin: "0 auto" }}>
      <Col xs="12">
        {loading && (
          <div className="loader-container">
            <div className="loader" />
            <p className="loader-text">Processing Data...</p>
          </div>
        )}
        <div className="responsive-header">
          {/* Desktop layout */}
          <div className="d-none d-md-flex align-items-center justify-content-between position-relative">
            <div style={{ minWidth: "180px", marginLeft: "16px" }}>
              <Select
                options={monthOptions}
                value={monthOptions.find(o => o.value === selectedMonth) || null}
                onChange={s => setSelectedMonth(s?.value || "")}
                isSearchable={false}
                placeholder="Select month"
                className="dark-select-container"
                classNamePrefix="dark-select"
              />
            </div>
            <div className="desktop-title position-absolute text-center" style={{ left: "50%", transform: "translateX(-50%)", top: 0 }}>
              <h2 className="text-center mt-1 font-weight-bold">Countries Overview</h2>
            </div>
            <div className="desktop-currency" style={{ minWidth: "60px", textAlign: "right", marginRight: "16px" }}>
              <span className="currency-label">
                USD <i className="fa fa-exclamation-circle ml-1" title="Currency: US Dollar" />
              </span>
            </div>
          </div>

          {/* Mobile layout */}
          <div className="d-block d-md-none">
            <div className="mobile-title-row mb-4">
              <h2 className="font-weight-bold mb-1">Countries Overview</h2>
              <span className="currency-label">
                | USD <i className="fa fa-exclamation-circle" title="Currency: US Dollar" />
              </span>
            </div>
            <div className="mobile-select-wrapper mt-2">
              <Select
                options={monthOptions}
                value={monthOptions.find(o => o.value === selectedMonth) || null}
                onChange={s => setSelectedMonth(s?.value || "")}
                isSearchable={false}
                placeholder="Select month"
                className="dark-select-container"
                classNamePrefix="dark-select"
              />
            </div>
            <hr className="mb-2"/>
          </div>
        </div>

        <svg width="0" height="0">
          <defs>
            <pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="4" height="4">
              <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" stroke="#ccc" strokeWidth="0.5" />
            </pattern>
          </defs>
        </svg>

        {/* Map Card */}
        <CardBody className="shadow-card pt-3 pb-4" style={{ maxWidth: "1040px", margin: "0 auto" }}>
          <div style={{ width: "100%", height: "500px" }}>
            {/* ✅ Always render the map when not loading, even with zero data */}
            {!loading && (
              <VectorMap
                key={selectedMonth} // force remount on month change
                map={worldMill}
                backgroundColor="transparent"
                zoomOnScroll={false}
                panOnDrag={true}
                regionStyle={{
                  initial: { fill: "#d9e9f7", stroke: "#fff", "stroke-width": 0.5 },
                  hover: { fill: "#56BCB6", cursor: "pointer" },
                }}
                containerStyle={{ width: "100%", height: "100%" }}
                containerClassName="custom-vector-map"
                series={{
                  regions: [{ values: mapColors, attribute: "fill" }],
                }}
                onRegionTipShow={handleRegionTipShow}
              />
            )}
          </div>
        </CardBody>

        {/* Table */}
        <Row className="justify-content-center mt-4" style={{ maxWidth: "1065px", margin: "0 auto" }}>
          <Col xs="12">
            <h4 className="text-center font-weight-bold">
              Top Countries and Top Providers for Total {viewSales ? "Sales Units" : "Earnings"}
            </h4>

            <div className="text-center mt-2 mb-2 small-checkbox">
              <label className="h5">
                <input
                  type="checkbox"
                  checked={viewSales}
                  onChange={() => setViewSales((prev) => !prev)}
                  className="mr-1"
                />
                Sales Units
              </label>
            </div>

            {sorted.length === 0 ? (
              <div className="alert alert-dark text-center">
                No data available to display.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-bordered text-center shadow mb-4">
                  <thead className="bg-light">
                    <tr>
                      <th className="bg-primary text-white">Country</th>
                      {topProviders.map((key) => (
                        <th key={key} className="bg-dark text-white">
                          {key.toUpperCase()}
                        </th>
                      ))}
                      <th className="bg-dark text-white">TOP PROVIDERS</th>
                      <th className="bg-dark text-white">ALL OTHERS</th>
                      <th className="bg-primary text-white">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.map(([iso, d]) => {
                      const countryLabel = countryNameMap[iso] || iso;
                      return renderRow(countryLabel, d);
                    })}
                    {renderRow("Top Countries", topAgg, true)}
                    {renderRow("All Others", restAgg, true)}
                    {renderRow("Total", grandTotal, true)}
                  </tbody>
                </table>
              </div>
            )}
          </Col>
        </Row>
      </Col>
    </Row>
  );
};

export default CountriesSection;
