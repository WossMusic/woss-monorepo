import React, { useEffect, useRef, useState, useCallback  } from "react";
import { Card, CardBody, Col, Row } from "reactstrap";
import countryMap from "../../../components/Data/countryNameMap";
import { useMonth } from "../../../components/Custom/MonthContext";
import Select from "react-select";
import ReactDOM from "react-dom";
import {
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  Title,
  Tooltip,
  Legend,
  Chart as ChartJS
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, BarController, Title, Tooltip, Legend);

const formatPeriodMonth = (period) => {
  if (!period) return "";
  const [year, month] = period.split("-");
  const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1));
  return date.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
};

  // Add this at the top of TrendsSection.js
const productTypeMap = {
  "Internet Single": "Internet Single",
  "Internet Video": "Internet Video",
  "Electronic Single Track": "Internet Single",
  "Electronic Single Track Video": "Internet Video"
};


const TrendsSection = ({ chartType, setChartType }) => {
  const chartCanvasRef = useRef(null);
  const chartInstance = useRef(null);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [selectedRange, setSelectedRange] = useState({ start: null, end: null });
  const [loading, setLoading] = useState(true);
  const [chartKey, setChartKey] = useState(0); // 🔁 used to force canvas rerender


  const { selectedMonth = null, setSelectedMonth: rawSetSelectedMonth } = useMonth() || {};
  const setSelectedMonth = useCallback((month) => {
    if (typeof rawSetSelectedMonth === "function") {
      rawSetSelectedMonth(month);
    }
  }, [rawSetSelectedMonth]);

  const [projectOptions, setProjectOptions] = useState([]);
  const [chartData, setChartData] = useState({ gross: {}, net: {}, sales: {} });
  const [monthOptions, setMonthOptions] = useState([]);
  const [filterOptionsMap, setFilterOptionsMap] = useState({});
  const [trackOptions, setTrackOptions] = useState([]);
  const [productTypeOptions, setProductTypeOptions] = useState([]);
  const [summaryTotals, setSummaryTotals] = useState({ gross: 0, net: 0, units: 0 }); 
  const [channelTableData, setChannelTableData] = useState([]);
  const [useRangeMode, setUseRangeMode] = useState(true);
  const [popupCoords, setPopupCoords] = useState({ x: 0, y: 0 });
  const [tempRange, setTempRange] = useState(selectedRange);

  useEffect(() => {
    if (showPeriodDropdown) {
      setTempRange(selectedRange);
    }
  }, [showPeriodDropdown, selectedRange]);



  // 🔼 In your component (top-level, before return)
const desktopLabelRef = useRef(null);
const mobileLabelRef = useRef(null);

// ✅ Updated handler
const handleToggleDropdown = () => {
  const isMobile = window.innerWidth < 768;
  const ref = isMobile ? mobileLabelRef : desktopLabelRef;

  if (ref.current) {
    const rect = ref.current.getBoundingClientRect();
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    const scrollY = window.scrollY || document.documentElement.scrollTop;

    const x = isMobile
      ? window.innerWidth / 2
      : rect.left + scrollX + rect.width / 2;

    const y = rect.bottom + scrollY;

    setPopupCoords({ x, y });
    setShowPeriodDropdown(prev => !prev);
  }
};


  const [filters, setFilters] = useState({
      release: "",
      track: "",
      productType: "",
      channel: "",
      provider: "",
      country: ""
    });



  useEffect(() => {
    if (monthOptions.length > 0 && (!selectedMonth || !monthOptions.some(opt => opt.value === selectedMonth))) {
      const latest = monthOptions.at(-1)?.value;
      if (latest) setSelectedMonth(latest);
    }
  }, [monthOptions, selectedMonth, setSelectedMonth]);


  const hasActiveFilters = Object.entries(filters).some(
    ([key, val]) => key !== "Project Name" && val !== ""
  );

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };



  useEffect(() => {
    const fetchProjectName = async () => {
      try {
        const token = localStorage.getItem("woss_token");
        if (!token) return;

        const res = await fetch("http://localhost:4000/api/auth/profile/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();
        if (data.success && data.profile.project_name) {
          const name = data.profile.project_name;
          setFilters((prev) => ({ ...prev, "Project Name": name }));
          setProjectOptions([{ value: name, label: name }]);
        }
      } catch (error) {
        console.error("Error fetching project name:", error);
      }
    };

    fetchProjectName();
  }, []);




const fetchChartData = useCallback(async () => {
  setLoading(true); // Start loader

  try {
    const token = localStorage.getItem("woss_token");
    const params = new URLSearchParams();

    if (filters.release) params.append("release", filters.release);
    if (filters.track) params.append("track", filters.track);
    if (filters.productType) {
      const dbVal = productTypeMap[filters.productType] || filters.productType;
      params.append("productType", dbVal);
    }
    if (filters.channel) params.append("channel", filters.channel);
    if (filters.provider) params.append("provider", filters.provider);
    if (filters.country) params.append("country", filters.country);

    // Date filter
    if (useRangeMode && selectedRange.start && selectedRange.end) {
      params.append("startPeriod", selectedRange.start);
      params.append("endPeriod", selectedRange.end);
    } else if (selectedMonth) {
      params.append("period", selectedMonth);
    }

    const res = await fetch(`http://localhost:4000/api/royalties/monthly-summary?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (!data.success || !Array.isArray(data.data)) {
      setLoading(false);
      return;
    }

    const formattedLabels = data.data.map(d => formatPeriodMonth(d.period_month));
    setChartData({
      gross: {
        labels: formattedLabels,
        datasets: [
          { label: "Gross: Downloads", data: data.data.map(d => d.downloads_earnings), backgroundColor: "#492599" },
          { label: "Gross: Subscription", data: data.data.map(d => d.subscription_earnings), backgroundColor: "#5b30bf" },
          { label: "Gross: Ad Supported", data: data.data.map(d => d.ad_supported_earnings), backgroundColor: "#8B5CF6" }
        ]
      },
      net: {
        labels: formattedLabels,
        datasets: [
          { label: "Net: Downloads", data: data.data.map(d => d.net_downloads), backgroundColor: "#810a0a" },
          { label: "Net: Subscription", data: data.data.map(d => d.net_subscription), backgroundColor: "#a11010" },
          { label: "Net: Ad Supported", data: data.data.map(d => d.net_adsupported), backgroundColor: "#d41e1e" }
        ]
      },
      sales: {
        labels: formattedLabels,
        datasets: [
          { label: "Units: Downloads", data: data.data.map(d => d.downloads_units), backgroundColor: "#33706d" },
          { label: "Units: Subscription", data: data.data.map(d => d.subscription_units), backgroundColor: "#449691" },
          { label: "Units: Ad Supported", data: data.data.map(d => d.ad_supported_units), backgroundColor: "#56BCB6" }
        ]
      }
    });

    const tableData = data.data.map(row => ({
      month: formatPeriodMonth(row.period_month),
      subscription: row.subscription_earnings,
      adSupported: row.ad_supported_earnings,
      downloads: row.downloads_earnings,
      net_subscription: row.net_subscription,
      net_adsupported: row.net_adsupported,
      net_downloads: row.net_downloads,
      subscription_units: row.subscription_units,
      ad_supported_units: row.ad_supported_units,
      downloads_units: row.downloads_units,
      total_units: row.subscription_units + row.ad_supported_units + row.downloads_units
    }));
    setChannelTableData(tableData);

    const tracksRes = await fetch("http://localhost:4000/api/royalties/tracks-summary", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const tracksData = await tracksRes.json();
    if (tracksData.success && Array.isArray(tracksData.tracks)) {
      const trackOpts = [
        { value: "", label: "All Tracks" },
        ...tracksData.tracks.map(tr => ({ value: tr.title, label: tr.title }))
      ];
      setTrackOptions(trackOpts);
    }

    setChartKey(prev => prev + 1); // 🔁 Force canvas re-render
  } catch (error) {
    console.error("Failed to load monthly data:", error);
  } finally {
    setLoading(false); // Done
  }
}, [filters, selectedMonth, selectedRange, useRangeMode]);



useEffect(() => {
  fetchChartData();
}, [fetchChartData]);



useEffect(() => {
  const valid = monthOptions.find(opt => opt.value === selectedMonth);
  if (!valid && monthOptions.length > 0) {
    const latest = monthOptions.at(-1);
    setSelectedMonth(latest.value);
  }
}, [monthOptions, selectedMonth, setSelectedMonth]);



useEffect(() => {
  const fetchSummaryTotals = async () => {
    setLoading(true); // 👉 Start loading

    const token = localStorage.getItem("woss_token");
    const params = new URLSearchParams();

    if (filters.release) params.append("release", filters.release);
    if (filters.track) params.append("track", filters.track);
    if (filters.productType) {
      const dbVal = productTypeMap[filters.productType] || filters.productType;
      params.append("productType", dbVal);
    }
    if (filters.channel) params.append("channel", filters.channel);
    if (filters.provider) params.append("provider", filters.provider);
    if (filters.country) params.append("country", filters.country);

    if (useRangeMode && selectedRange.start && selectedRange.end) {
      params.append("startPeriod", selectedRange.start);
      params.append("endPeriod", selectedRange.end);
    } else if (selectedMonth) {
      params.append("period", selectedMonth);
    }

    try {
      const res = await fetch(`http://localhost:4000/api/royalties/summary-totals?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.totals) {
        setSummaryTotals(data.totals);
      }
    } catch (err) {
      console.error("❌ Failed to fetch summary totals:", err);
    } finally {
      setLoading(false); // ✅ Done loading
    }
  };

  fetchSummaryTotals();
}, [filters, selectedMonth, selectedRange, useRangeMode]);



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
      const options = sorted.map(p => ({
        value: p,
        label: formatPeriodMonth(p)
      }));
      setMonthOptions(options);

      const last = sorted.at(-1);
      const first = sorted[0];

      // ✅ Always force range mode in TrendsSection
      setUseRangeMode(true);
      setSelectedRange({ start: first, end: last });
      setSelectedMonth(null); // Clear single month
    } catch (err) {
      console.error("❌ Error loading periods:", err);
    }
  };

  loadPeriods();
}, [setSelectedMonth]); // ❗ remove selectedMonth dependency to avoid overrides




useEffect(() => {
  const fetchSummaryTotals = async () => {
    const token = localStorage.getItem("woss_token");
    const params = new URLSearchParams();

    if (
      selectedMonth &&
      monthOptions.length > 0 &&
      !monthOptions.some(opt => opt.value === selectedMonth)
    )


    // Filters
    if (filters.release) params.append("release", filters.release);
    if (filters.track) params.append("track", filters.track);
    if (filters.productType) {
      const dbVal = productTypeMap[filters.productType] || filters.productType;
      params.append("productType", dbVal);
    }
    if (filters.channel) params.append("channel", filters.channel);
    if (filters.provider) params.append("provider", filters.provider);
    if (filters.country) params.append("country", filters.country);

    // Date filter — range has priority
    if (selectedRange.start && selectedRange.end) {
      params.append("startPeriod", selectedRange.start);
      params.append("endPeriod", selectedRange.end);
    } else if (selectedMonth) {
      params.append("period", selectedMonth);
    }

    try {
      const res = await fetch(
        `http://localhost:4000/api/royalties/summary-totals?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.success && data.totals) {
        setSummaryTotals(data.totals);
      }
    } catch (err) {
      console.error("❌ Failed to fetch summary totals:", err);
    }
  };

  fetchSummaryTotals();
}, [filters, selectedMonth, selectedRange, monthOptions]);





useEffect(() => {
  const fetchFilters = async () => {
    const token = localStorage.getItem("woss_token");
    const res = await fetch("http://localhost:4000/api/royalties/filters", {
      headers: { Authorization: `Bearer ${token}` }
    });

    const j = await res.json();
    if (!j.success) return;

    const mapOpts = arr => arr.map(s => ({ value: s, label: s }));

    // ✅ Normalize product types
    const ptSet = new Set();
    (j.productTypes || []).forEach(type => {
      if (typeof type === "string") {
        type.split(",").forEach(pt => {
          const clean = pt.trim();
          if (clean) ptSet.add(clean);
        });
      }
    });

    setProductTypeOptions(
      Array.from(ptSet).map(pt => ({ value: pt, label: pt }))
    );

    const hiddenChannels = ["payment top - up", "ad channel"];
    const channelOptions = Array.from(
      new Set(
        (j.channels || [])
          .map(ch => ch.trim())
          .filter(ch => !hiddenChannels.includes(ch.toLowerCase()))
      )
    ).map(ch => ({
      value: ch,
      label: ch.toLowerCase() === "download" ? "Downloads" : ch
    }));

    const countryOptions = Array.from(
      new Set((j.countries || []).map(code => code.trim().toUpperCase()))
    ).map(code => ({
      value: code,
      label: countryMap[code] || code
    }));

    setFilterOptionsMap({
      release: mapOpts(j.releases),
      productType: [],
      channel: channelOptions,
      provider: mapOpts(j.providers),
      country: countryOptions
    });
  };

  fetchFilters();
}, []);


useEffect(() => {
  const canvas = chartCanvasRef.current;
  const data = chartData[chartType];

  // ✅ Check that canvas exists and data is valid
  if (
    !canvas ||
    !data ||
    !data.datasets?.length ||
    data.datasets.every(ds => !ds.data || ds.data.length === 0 || ds.data.every(val => val === 0))
  ) {
    return;
  }

  const ctx = canvas.getContext("2d");

  // 🔁 Clean up old chart
  if (chartInstance.current) {
    chartInstance.current.destroy();
  }

  // 🖌️ Render new chart
  chartInstance.current = new ChartJS(ctx, {
    type: "bar",
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: 2,
      layout: {
        padding: { top: 10, bottom: 10, left: 10, right: 10 }
      },
      scales: {
        x: {
          stacked: chartType !== "channel",
          ticks: {
            color: "#1F2937",
            font: { size: 12, family: "'Inter', sans-serif", weight: "bold" }
          },
          grid: { display: false }
        },
        y: {
          stacked: chartType !== "channel",
          ticks: {
            callback: function (value) {
              if (chartType === "sales") {
                if (value >= 1_000_000) return (value / 1_000_000).toFixed(0) + "M";
                if (value >= 1_000) return (value / 1_000).toFixed(0) + "k";
                return value.toLocaleString("en-US");
              } else {
                if (value >= 1_000_000) return "$" + (value / 1_000_000).toFixed(1) + "M";
                if (value >= 1_000) return "$" + (value / 1_000).toFixed(1) + "k";
                return "$" + value.toLocaleString("en-US", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                });
              }
            },
            font: { size: 12, family: "'Inter', sans-serif" },
            color: "#1F2937"
          },
          grid: {
            drawTicks: false,
            color: "#E5E7EB",
            drawBorder: false
          }
        }
      },
      plugins: {
        legend: {
          position: "top",
          onClick: null,
          labels: {
            font: { size: 13, weight: "bold", family: "'Inter', sans-serif" },
            color: "#111827"
          }
        },
        tooltip: {
          backgroundColor: "#111827",
          titleFont: { size: 12, weight: "bold", family: "'Inter', sans-serif" },
          bodyFont: { size: 12, family: "'Inter', sans-serif" },
          bodyColor: "#D1D5DB",
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label: function (context) {
              const label = context.dataset.label || '';
              const value = context.parsed.y || 0;
              const formatted = chartType === "sales"
                ? value.toLocaleString("en-US", { maximumFractionDigits: 0 })
                : value.toLocaleString("en-US", {
                    style: "decimal",
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  });
              const unitLabel = chartType === "sales" ? "Units" : "USD";
              return `${label}: ${formatted} ${unitLabel}`;
            }
          }
        }
      },
      elements: {
        bar: {
          borderRadius: 0,
          borderSkipped: false,
          barPercentage: 0.5,
          categoryPercentage: 0.6
        }
      }
    }
  });

  // 🧹 Cleanup on unmount
  return () => {
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }
  };
}, [chartData, chartType, chartKey]);


useEffect(() => {
  if (showPeriodDropdown) {
    setTempRange(selectedRange); // sync when opened
  }
}, [showPeriodDropdown, selectedRange]);



 if (loading) {
    return (
      <div className="loader-container">
        <div className="loader" />
        <p className="loader-text">Processing Data...</p>
      </div>
    );
  }

  return  (

    <Row className="w-100 align-items-center mb-4" style={{ maxWidth: "1100px", margin: "0 auto" }}>
     <Col xs="12">
     <div className="responsive-header mb-4">
  {/* ✅ Desktop layout */}
  <div className="d-none d-md-flex align-items-center justify-content-between position-relative mb-4">
    {/* Month Selector (left) */}
    <div className="ml-3" style={{ minWidth: "180px" }}>
      <Select
        options={monthOptions}
        value={monthOptions.find(opt => opt.value === selectedRange.end)}
        onChange={(selected) => {
          if (selected?.value) {
            setUseRangeMode(true);
            setSelectedMonth(null);
            setSelectedRange(prev => ({ ...prev, end: selected.value }));
          }
        }}
        placeholder="Select..."
        isSearchable={false}
        className="dark-select-container"
        classNamePrefix="dark-select"
      />
    </div>

    {/* Title and Range - Desktop */}
    <div className="range-picker-header position-absolute text-center">
      <h2 className="font-weight-bold mb-1">All Periods Overview</h2>
      <div
        ref={desktopLabelRef}
        className="period-range-label d-inline-flex align-items-center justify-content-center"
        onClick={handleToggleDropdown}
        style={{ cursor: "pointer" }}
      >
        <strong className="text-primary">{formatPeriodMonth(selectedRange.start)}</strong>
        <i className="fa fa-arrow-right mx-2 text-primary" />
        <strong className="text-primary">{formatPeriodMonth(selectedRange.end)}</strong>
      </div>
    </div>

    {/* Currency */}
    <div className="desktop-currency" style={{ minWidth: "60px", textAlign: "right", marginRight: "16px" }}>
      <span className="currency-label">
        USD <i className="fa fa-exclamation-circle ml-1" title="Currency: US Dollar" />
      </span>
    </div>
  </div>

  {/* ✅ Mobile layout */}
  <div className="d-block d-md-none responsive-header mb-4">
    <div className="mobile-title-row mb-3">
      <div>
        <h2 className="font-weight-bold mb-1">All Periods Overview</h2>

        {/* Clickable Range - Mobile */}
        <div
          ref={mobileLabelRef}
          className="period-range-label d-inline-flex align-items-center justify-content-center"
          onClick={handleToggleDropdown}
          style={{ cursor: "pointer" }}
        >
          <strong className="text-primary">{formatPeriodMonth(selectedRange.start)}</strong>
          <i className="fa fa-arrow-right mx-2 text-primary" />
          <strong className="text-primary">{formatPeriodMonth(selectedRange.end)}</strong>
        </div>
      </div>

      {/* Currency */}
      <span className="currency-label">
        | USD <i className="fa fa-exclamation-circle" title="Currency: US Dollar" />
      </span>
    </div>

    {/* Month Select */}
    <div className="mobile-select-wrapper mb-2">
      <Select
        options={monthOptions}
        value={monthOptions.find(opt => opt.value === selectedRange.end)}
        onChange={(selected) => {
          if (selected?.value) {
            setUseRangeMode(true);
            setSelectedMonth(null);
            setSelectedRange(prev => ({ ...prev, end: selected.value }));
          }
        }}
        placeholder="Select..."
        isSearchable={false}
        className="dark-select-container"
        classNamePrefix="dark-select"
      />
    </div>

    <hr />
  </div>

  {/* ✅ Dropdown Portal */}
  {showPeriodDropdown && ReactDOM.createPortal(
    <>
      <div className="dropdown-overlay" onClick={() => setShowPeriodDropdown(false)} />

      <div
        className="period-dropdown-popup"
        style={{
          top: `${popupCoords.y}px`,
          left: `${popupCoords.x}px`,
          transform: "translate(-50%, 10px)",
          minWidth: "300px",
          maxWidth: "90vw",
          zIndex: 9999
        }}
      >
        <p className="mb-2 font-weight-bold">View data from the statements</p>

        <div className="d-flex align-items-center justify-content-between mb-3">
          <Select
            options={monthOptions.map(opt => ({
              ...opt,
              isDisabled: tempRange.end && opt.value > tempRange.end
            }))}
            value={monthOptions.find(opt => opt.value === tempRange.start)}
            onChange={(s) => setTempRange(prev => ({ ...prev, start: s.value }))}
            className="custom-month-select text-sm flex-fill"
            classNamePrefix="custom-month"
          />
          <span className="mx-2 font-weight-bold">to</span>
          <Select
            options={monthOptions.map(opt => ({
              ...opt,
              isDisabled: tempRange.start && opt.value < tempRange.start
            }))}
            value={monthOptions.find(opt => opt.value === tempRange.end)}
            onChange={(s) => setTempRange(prev => ({ ...prev, end: s.value }))}
            className="custom-month-select text-sm flex-fill"
            classNamePrefix="custom-month"
          />
        </div>

        <div className="d-flex justify-content-end">
          <button className="btn btn-sm btn-outline-dark mr-2" onClick={() => setShowPeriodDropdown(false)}>
            Cancel
          </button>
          <button
            className="btn btn-sm btn-primary"
            disabled={!tempRange.start || !tempRange.end || tempRange.start > tempRange.end}
            onClick={() => {
              setUseRangeMode(true);
              setSelectedRange(tempRange);
              setShowPeriodDropdown(false);
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </>,
    document.body
  )}
</div>




    {/* ✅ Dynamic Summary Cards */}
     <Row className="w-100 justify-content-center text-center" style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {["gross", "net", "sales"].map((type) => {
          const formatValue = (val, type) => {
            if (typeof val !== "number" || isNaN(val)) {
              return type === "sales" ? "0" : "$0.00";
            }

            if (type === "sales") {
              return val.toLocaleString("en-US");
            }

            return "$" + val.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            });
          };

          const value =
            type === "gross"
              ? summaryTotals.gross
              : type === "net"
              ? summaryTotals.net
              : summaryTotals.units;

          const title =
            type === "gross"
              ? "Gross Revenue"
              : type === "net"
              ? "Net Revenue"
              : "Sales Units";

          return (
            <Col xs="12" md="4" key={type}>
              <Card className="shadow-card text-center">
                <CardBody className="bg-primary text-white rounded-top p-2">
                  <h5 className="text-uppercase mb-0 text-white">{title}</h5>
                </CardBody>
                <CardBody className="rounded-bottom p-3 text-white">
                  <span className="h3 font-weight-bold text-primary">
                    {formatValue(value, type)}
                  </span>
                </CardBody>
              </Card>
            </Col>
          );
        })}
      </Row>


       {/* Filters */}
      <Row className="w-100 justify-content-center text-center mb-4" style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {["Project Name", "track", "productType", "channel", "provider", "country"].map((key) => {

          const isProjectName = key === "Project Name";
          
          const labelMap = {
            release: "All Releases",
            track: "All Tracks",
            productType: "All Product Types",
            channel: "All Channels",
            provider: "All Providers",
            country: "All Countries"
          };

          const options = isProjectName
            ? projectOptions
            : key === "track"
            ? trackOptions
            : key === "productType"
            ? [{ value: "", label: labelMap[key] }, ...productTypeOptions]
            : [{ value: "", label: labelMap[key] }, ...(filterOptionsMap[key] || [])];

          return (
            <Col xs="6" md={2} key={key}>
              <div className="mb-3">
                <div className="filter-label" title={key}>
                  {key === "channel"
                    ? "Distribution Channel"
                    : key === "release"
                    ? "Release"
                    : key === "track"
                    ? "Track"
                    : key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1")}
                </div>

                <Select
                  isSearchable={!isProjectName}
                  isDisabled={isProjectName}
                  isClearable={false}
                  placeholder={`Filter by ${key}`}
                  options={options}
                  value={
                      filters[key]
                        ? key === "country"
                          ? {
                              value: filters[key],
                              label: countryMap[filters[key]] || filters[key]
                            }
                          : { value: filters[key], label: filters[key] }
                        : { value: "", label: labelMap[key] }
                    }
                  onChange={(selected) =>
                    handleFilterChange(key, selected?.value || "")
                  }
                  className="filters-select-container"
                  classNamePrefix="filters-select"
                />
              </div>
            </Col>
          );
        })}

        {/* Clear All Filters Button */}
        {hasActiveFilters && (
          <Col xs="12">
            <div className="d-flex justify-content-end mt-2">
              <button
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    release: "",
                    track: "",
                    productType: "",
                    channel: "",
                    provider: "",
                    country: "",
                  }))
                }
                className="clear-filters-button"
                onMouseEnter={(e) => {
                  const span = e.currentTarget.querySelector("span");
                  e.currentTarget.style.color = "#56bcb6";
                  span.style.textDecoration = "underline";
                }}
                onMouseLeave={(e) => {
                  const span = e.currentTarget.querySelector("span");
                  e.currentTarget.style.color = "#212529";
                  span.style.textDecoration = "none";
                }}
              >
                <span>Clear All Filters</span>
                <i className="fa fa-times-circle" />
              </button>
            </div>
          </Col>
        )}
      </Row>


        {/* Chart Section */}
       <Row className="justify-content-center" style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <Col xs="12">
          {/* Chart Section */}
          <Card>
            <CardBody>
              <div className="mb-3 text-center">
                <div className="btn-group" role="group" aria-label="Chart Type Switch">
                  <button
                    type="button"
                    className={`btn btn-sm ${chartType === "gross" ? "btn-dark" : "btn-outline-secondary"}`}
                    onClick={() => setChartType("gross")}
                  >
                    Gross Revenue
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${chartType === "net" ? "btn-dark" : "btn-outline-secondary"}`}
                    onClick={() => setChartType("net")}
                  >
                    Net Revenue
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${chartType === "sales" ? "btn-dark" : "btn-outline-secondary"}`}
                    onClick={() => setChartType("sales")}
                  >
                    Sales Units
                  </button>
                </div>
              </div>

             <Card className="p-4" style={{ marginBottom: 0, boxShadow: "none", border: "1px solid rgba(89, 89, 89, 0.12)" }}>
                <CardBody className="p-0" style={{ height: "400px" }}>
                  {chartData[chartType]?.datasets?.every(ds => ds.data.every(val => val === 0)) ? (
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

      {/* Distribution Table Section (aligned with chart) */}
        {channelTableData.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-4 font-weight-bold">Distribution Channels</h3>
          <div className="table-responsive">
          <table className="table shadow table-bordered table-hover text-center bg-white no-outer-border">
            <thead>
              <tr>
                <th className="bg-primary text-white">Distribution Channels</th>
                {channelTableData.map((row, i) => (
                  <th key={i} className="text-white bg-dark">{row.month}</th>
                ))}
                <th className="bg-primary text-white">Total</th>
              </tr>
            </thead>
          <tbody>
            {chartType !== "sales" && (
              <>
                <tr>
                  <td>Streams: Ad Supported</td>
                  {channelTableData.map((row, i) => {
                    const val = chartType === "net" ? row.net_adsupported : row.adSupported;
                    return (
                      <td key={`ad-${i}`}>
                        {val > 0 && val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    );
                  })}
                  <td className="font-weight-bold">
                    {
                      (() => {
                        const total = channelTableData.reduce((sum, r) => sum + (chartType === "net" ? r.net_adsupported ?? 0 : r.adSupported ?? 0), 0);
                        return total > 0 ? total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
                      })()
                    }
                  </td>
                </tr>

                <tr>
                  <td>Streams: Subscription</td>
                  {channelTableData.map((row, i) => {
                    const val = chartType === "net" ? row.net_subscription : row.subscription;
                    return (
                      <td key={`sub-${i}`}>
                        {val > 0 && val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    );
                  })}
                  <td className="font-weight-bold">
                    {
                      (() => {
                        const total = channelTableData.reduce((sum, r) => sum + (chartType === "net" ? r.net_subscription ?? 0 : r.subscription ?? 0), 0);
                        return total > 0 ? total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
                      })()
                    }
                  </td>
                </tr>

                <tr>
                  <td>Downloads</td>
                  {channelTableData.map((row, i) => {
                    const val = chartType === "net" ? row.net_downloads : row.downloads;
                    return (
                      <td key={`dl-${i}`}>
                        {val > 0 && val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    );
                  })}
                  <td className="font-weight-bold">
                    {
                      (() => {
                        const total = channelTableData.reduce((sum, r) => sum + (chartType === "net" ? r.net_downloads ?? 0 : r.downloads ?? 0), 0);
                        return total > 0 ? total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
                      })()
                    }
                  </td>
                </tr>
              </>
            )}

            {chartType === "sales" && (
              <>
                <tr>
                  <td>Streams: Ad Supported</td>
                  {channelTableData.map((row, i) => (
                    <td key={`uad-${i}`}>{(row.ad_supported_units ?? 0) > 0 ? row.ad_supported_units.toLocaleString("en-US") : ""}</td>
                  ))}
                  <td className="font-weight-bold">
                    {
                      (() => {
                        const total = channelTableData.reduce((sum, r) => sum + (r.ad_supported_units ?? 0), 0);
                        return total > 0 ? total.toLocaleString("en-US") : "";
                      })()
                    }
                  </td>
                </tr>

                <tr>
                  <td>Streams: Subscription</td>
                  {channelTableData.map((row, i) => (
                    <td key={`usub-${i}`}>{(row.subscription_units ?? 0) > 0 ? row.subscription_units.toLocaleString("en-US") : ""}</td>
                  ))}
                  <td className="font-weight-bold">
                    {
                      (() => {
                        const total = channelTableData.reduce((sum, r) => sum + (r.subscription_units ?? 0), 0);
                        return total > 0 ? total.toLocaleString("en-US") : "";
                      })()
                    }
                  </td>
                </tr>

                <tr>
                  <td>Downloads</td>
                  {channelTableData.map((row, i) => (
                    <td key={`udl-${i}`}>{(row.downloads_units ?? 0) > 0 ? row.downloads_units.toLocaleString("en-US") : ""}</td>
                  ))}
                  <td className="font-weight-bold">
                    {
                      (() => {
                        const total = channelTableData.reduce((sum, r) => sum + (r.downloads_units ?? 0), 0);
                        return total > 0 ? total.toLocaleString("en-US") : "";
                      })()
                    }
                  </td>
                </tr>
              </>
            )}

            <tr>
              <td><strong>Total</strong></td>
              {channelTableData.map((row, i) => {
                let total;
                if (chartType === "sales") {
                  total = row.total_units ?? 0;
                } else {
                  const ad = chartType === "net" ? row.net_adsupported ?? 0 : row.adSupported ?? 0;
                  const sub = chartType === "net" ? row.net_subscription ?? 0 : row.subscription ?? 0;
                  const dl = chartType === "net" ? row.net_downloads ?? 0 : row.downloads ?? 0;
                  total = ad + sub + dl;
                }

                return (
                  <td key={`tot-${i}`}>
                    <strong>
                    {total > 0 ? total.toLocaleString("en-US", {
                      minimumFractionDigits: chartType === "sales" ? 0 : 2,
                      maximumFractionDigits: chartType === "sales" ? 0 : 2
                    }) : ""}
                    </strong>
                  </td>
                );
              })}
              <td className="font-weight-bold"><strong>
                {
                  (() => {
                    const totalSum = channelTableData.reduce((sum, r) => {
                      if (chartType === "sales") return sum + (r.total_units ?? 0);
                      const ad = chartType === "net" ? r.net_adsupported ?? 0 : r.adSupported ?? 0;
                      const sub = chartType === "net" ? r.net_subscription ?? 0 : r.subscription ?? 0;
                      const dl = chartType === "net" ? r.net_downloads ?? 0 : r.downloads ?? 0;
                      return sum + ad + sub + dl;
                    }, 0);
                    return totalSum > 0
                      ? totalSum.toLocaleString("en-US", {
                          minimumFractionDigits: chartType === "sales" ? 0 : 2,
                          maximumFractionDigits: chartType === "sales" ? 0 : 2
                        })
                      : "";
                  })()
                }
                </strong>
              </td>
            </tr>
          </tbody>
          </table>
        </div>
        </div>
       )}
        </Col>
       </Row>
      </Col>
    </Row>
  );
};


export default TrendsSection;
