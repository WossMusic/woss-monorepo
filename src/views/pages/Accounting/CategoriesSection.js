import React, { useEffect, useRef, useState } from "react";
import { Col, Row, Table } from "reactstrap";
import { useMonth } from "../../../components/Custom/MonthContext";
import Select from "react-select";
import {
  Chart,
  ArcElement,
  Tooltip,
  Legend,
  Title,
  PieController
} from "chart.js";

Chart.register(ArcElement, Tooltip, Legend, Title, PieController);

const normalizeCategory = (category) => {
  return category?.trim() || "Unknown";
};

const CategoriesSection = () => {
  const [data, setData] = useState([]);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const { selectedMonth, setSelectedMonth } = useMonth();
  const [monthOptions, setMonthOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [, setCategoryData] = useState([]);

  useEffect(() => {
    if (!selectedMonth) return;
    const token = localStorage.getItem("woss_token");
    setLoading(true);

    fetch(
      `http://localhost:4000/api/royalties/categories?period=${selectedMonth}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.categories)) {
          setCategoryData(json.categories);
        } else {
          setCategoryData([]);
        }
      })
      .catch((err) => {
        console.error("Error loading categories:", err);
        setCategoryData([]);
      })
      .finally(() => {
        setLoading(false);
      });
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
        const opts = sorted.map((p) => ({
          value: p,
          label: new Date(
            Date.UTC(+p.split("-")[0], +p.split("-")[1] - 1)
          ).toLocaleString("en-US", {
            month: "long",
            year: "numeric",
            timeZone: "UTC"
          })
        }));
        setMonthOptions(opts);

        const latest = opts.at(-1);
        if (!selectedMonth || !opts.find((o) => o.value === selectedMonth)) {
          latest && setSelectedMonth(latest.value);
        }
      } catch (err) {
        console.error("Error loading periods:", err);
      }
    };

    loadPeriods();
  }, [selectedMonth, setSelectedMonth]);

  useEffect(() => {
    const token = localStorage.getItem("woss_token");
    if (!token || !selectedMonth) return;

    fetch(
      `http://localhost:4000/api/royalties/categories?period=${selectedMonth}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          const grouped = {};
          for (const item of json.categories) {
            const category = normalizeCategory(item.category);
            if (!grouped[category]) {
              grouped[category] = {
                ...item,
                category,
                earnings: 0,
                domesticPercentage: 0,
                totalPercentage: 0,
                count: 0
              };
            }
            grouped[category].earnings += item.earnings;
            grouped[category].domesticPercentage += item.domesticPercentage;
            grouped[category].totalPercentage += item.totalPercentage;
            grouped[category].count += 1;
          }

          const final = Object.values(grouped).map((g) => ({
            ...g,
            domesticPercentage: g.domesticPercentage / g.count,
            totalPercentage: 0
          }));

          const total = final.reduce((sum, cat) => sum + cat.earnings, 0);
          const withPercentages = final.map((cat) => ({
            ...cat,
            totalPercentage: (cat.earnings / total) * 100
          }));

          setData(withPercentages);
        }
      })
      .catch((err) => console.error("Failed to load categories:", err));
  }, [selectedMonth]);

  useEffect(() => {
    const token = localStorage.getItem("woss_token");
    if (!token) {
      console.warn("No token found in localStorage");
      return;
    }

    fetch(
      `http://localhost:4000/api/royalties/categories?period=${selectedMonth}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (json.success) {
          const grouped = {};
          for (const item of json.categories) {
            const category = normalizeCategory(item.category);
            if (!grouped[category]) {
              grouped[category] = {
                ...item,
                category,
                earnings: 0,
                domesticPercentage: 0,
                totalPercentage: 0,
                count: 0
              };
            }
            grouped[category].earnings += item.earnings;
            grouped[category].domesticPercentage += item.domesticPercentage;
            grouped[category].totalPercentage += item.totalPercentage;
            grouped[category].count += 1;
          }

          const final = Object.values(grouped).map((g) => ({
            ...g,
            domesticPercentage: g.domesticPercentage / g.count,
            totalPercentage: 0 // Will be updated below
          }));

          const total = final.reduce((sum, cat) => sum + cat.earnings, 0);
          const withPercentages = final.map((cat) => ({
            ...cat,
            totalPercentage: (cat.earnings / total) * 100
          }));

          setData(withPercentages);
        }
      })
      .catch((err) => console.error("Failed to load categories:", err));
  }, [selectedMonth]);

  const formatCurrency = (num) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(num || 0));
  };

  useEffect(() => {
    if (chartRef.current) {
      if (chartInstance.current) chartInstance.current.destroy();

      const ctx = chartRef.current.getContext("2d");

      const earningsArray = data.map((d) => parseFloat(d.earnings));
      const hasPositiveValue = earningsArray.some((val) => val > 0);

      const chartData = hasPositiveValue ? earningsArray : [1];
      const labels = hasPositiveValue ? data.map((d) => d.category) : ["No Data"];

      chartInstance.current = new Chart(ctx, {
        type: "pie",
        data: {
          labels,
          datasets: [
            {
              data: chartData,
              backgroundColor: ["#5b30bf", "#8B5CF6", "#ffc107", "#dc3545", "#20c997"],
              borderWidth: 2,
              borderColor: "#fff",
              hoverOffset: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: "top",
              labels: {
                color: "#333",
                font: { family: "'Segoe UI', sans-serif", size: 14 }
              }
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const label = context.label || "";
                  const value = context.raw || 0;
                  return `${label}: ${formatCurrency(value)}`;
                }
              },
              bodyFont: { family: "'Segoe UI', sans-serif" },
              titleFont: { family: "'Segoe UI', sans-serif" }
            }
          },
          animation: { animateRotate: true }
        }
      });
    }
  }, [data]);

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
          {/* Header & Selector */}
          <Row
            className="w-100 align-items-center"
            style={{ maxWidth: "1100px", margin: "0 auto" }}
          >
            <Col xs="12">
              <div className="responsive-header mb-4">
                {/* Desktop layout */}
                <div className="d-none d-md-flex align-items-center justify-content-between position-relative">
                  <div style={{ minWidth: "180px", marginLeft: "16px" }}>
                    {/* Always render Select, even if options are empty */}
                    <Select
                      options={monthOptions}
                      value={monthOptions.find((o) => o.value === selectedMonth) || null}
                      onChange={(s) => setSelectedMonth(s?.value || "")}
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
                    <h2 className="text-center mt-1 font-weight-bold">
                      Categories Overview
                    </h2>
                  </div>
                  <div
                    className="desktop-currency"
                    style={{ minWidth: "60px", textAlign: "right", marginRight: "16px" }}
                  >
                    <span className="currency-label">
                      USD{" "}
                      <i
                        className="fa fa-exclamation-circle ml-1"
                        title="Currency: US Dollar"
                      />
                    </span>
                  </div>
                </div>

                {/* Mobile layout */}
                <div className="d-block d-md-none">
                  <div className="mobile-title-row mb-4">
                    <h2 className="font-weight-bold mb-1">Categories Overview</h2>
                    <span className="currency-label">
                      | USD{" "}
                      <i
                        className="fa fa-exclamation-circle"
                        title="Currency: US Dollar"
                      />
                    </span>
                  </div>
                  <div className="mobile-select-wrapper mt-2">
                    {/* Always render on mobile as well */}
                    <Select
                      options={monthOptions}
                      value={monthOptions.find((o) => o.value === selectedMonth) || null}
                      onChange={(s) => setSelectedMonth(s?.value || "")}
                      isSearchable={false}
                      placeholder="Select..."
                      className="dark-select-container"
                      classNamePrefix="dark-select"
                    />
                  </div>
                  <hr />
                </div>
              </div>
            </Col>
          </Row>

          {/* Chart Section */}
          <Row
            className="w-100 justify-content-center mb-4"
            style={{ maxWidth: "1070px", margin: "0 auto" }}
          >
            <Col xs="12">
              <div className="shadow-card p-4 d-flex align-items-center justify-content-between flex-wrap">
                <div
                  className="chart-wrapper"
                  style={{ flex: "1 1 400px", height: "350px" }}
                >
                  <canvas ref={chartRef} className="chart-canvas w-100 h-100" />
                </div>
                <div className="d-flex flex-column flex-grow-1 align-items-center justify-content-center mt-3 mt-md-0 text-center">
                  {data.map((d, i) => (
                    <div key={i} className="d-flex align-items-center my-1">
                      <span
                        className="rounded-circle mr-2"
                        style={{
                          display: "inline-block",
                          width: "10px",
                          height: "10px",
                          backgroundColor: ["#5b30bf", "#8B5CF6", "#ffc107", "#dc3545", "#20c997"][i % 5]
                        }}
                      ></span>
                      <strong className="text-dark mr-2">{d.category}</strong>
                      <span className="text-muted">
                        {d.totalPercentage.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Col>
          </Row>

          {/* Table Section */}
          <Row
            className="w-100 justify-content-center mt-4"
            style={{ maxWidth: "1065px", margin: "0 auto" }}
          >
            <Col xs="12">
              <h4 className="text-center mb-3 font-weight-bold">
                Total Earnings and Regions for All Categories
              </h4>
              <div className="table-responsive">
                <Table
                  bordered
                  responsive
                  className="text-center shadow mb-4"
                  style={{ borderCollapse: "collapse" }}
                >
                  <thead className="text-dark font-weight-bold text-center">
                    <tr>
                      <th rowSpan="2" className="bg-dark text-white align-middle text-center">
                        Category
                      </th>
                      <th colSpan="2" className="bg-primary text-white align-middle text-center">
                        Domestic
                      </th>
                      <th colSpan="2" className="bg-primary text-white align-middle text-center">
                        International
                      </th>
                      <th colSpan="2" className="bg-primary text-white align-middle text-center">
                        Total
                      </th>
                    </tr>
                    <tr>
                      <th className="bg-dark text-white text-center">Earnings</th>
                      <th className="bg-dark text-white text-center">%</th>
                      <th className="bg-dark text-white text-center">Earnings</th>
                      <th className="bg-dark text-white text-center">%</th>
                      <th className="bg-dark text-white text-center">Earnings</th>
                      <th className="bg-dark text-white text-center">%</th>
                    </tr>
                  </thead>

                  <tbody className="text-center">
                    {data.map((cat, idx) => {
                      const {
                        category,
                        domesticEarnings,
                        internationalEarnings,
                        earnings
                      } = cat;

                      const domesticPercent =
                        earnings > 0 ? (domesticEarnings / earnings) * 100 : 0;
                      const internationalPercent =
                        earnings > 0 ? (internationalEarnings / earnings) * 100 : 0;

                      return (
                        <tr key={idx}>
                          <td className="text-center">{category}</td>
                          <td className="text-center">
                            {formatCurrency(domesticEarnings)}
                          </td>
                          <td className="text-center">
                            {domesticPercent.toFixed(2)}%
                          </td>
                          <td className="text-center">
                            {formatCurrency(internationalEarnings)}
                          </td>
                          <td className="text-center">
                            {internationalPercent.toFixed(2)}%
                          </td>
                          <td className="text-center">{formatCurrency(earnings)}</td>
                          <td className="text-center">100.00%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
};

export default CategoriesSection;
