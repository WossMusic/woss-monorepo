/*!
=========================================================
* Woss Music Template Version 1.0
=========================================================
* Copyright 2024 Woss Music / Warner Music Latina Inc.
* Coded by Jetix Web
=========================================================
* The above copyright notice and this permission notice shall be included
* in all copies or substantial portions of the Software.
*/
import React, { useState, useEffect, useRef } from "react";
import {
  Chart,
  LineElement,
  LineController,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

import {
  Card,
  CardBody,
  CardHeader,
  Row,
  Col,
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  Container,
} from "reactstrap";

import AnalyticsHeader from "components/Headers/AnalyticsHeader.js";
import { chartStreamingPerformance, chartOptions, parseOptions } from "variables/streamingperformance";

/* ─── Maintenance helpers ─────────────────────────────────────────────── */
import MaintGate from "components/Guards/MaintGate";
import MaintenanceCardNotice from "components/Maintenance/MaintenanceCardNotice";

/** seed from localStorage to avoid first-paint flash */
function isMaintOn(pageKey) {
  try {
    const map = JSON.parse(localStorage.getItem("maintenance_pages") || "{}");
    return !!map[String(pageKey).toLowerCase()];
  } catch {
    return false;
  }
}

/* ✅ Register Filler and other plugins */
Chart.register(LineElement, LineController, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

function Analytics() {
  const chartRef = useRef(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState("month");
  const [chartData, setChartData] = useState(chartStreamingPerformance.data);
  const [hoveredData, setHoveredData] = useState(null);
  const [hoveredLabel, setHoveredLabel] = useState("");

  // maintenance seed for this page key: "analytics"
  const maintSeed = isMaintOn("analytics");

  useEffect(() => {
    if (window.Chart) {
      parseOptions(Chart, chartOptions());
    }
    const lastMonth = chartStreamingPerformance.data.labels.slice(-1)[0];
    setHoveredLabel(lastMonth);
    updateHoveredData(chartStreamingPerformance.data, lastMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateHoveredData = (data, label) => {
    const index = data.labels.indexOf(label);
    if (index !== -1) {
      setHoveredData({
        youtube: data.datasets[0].data[index] || 0,
        spotify: data.datasets[1].data[index] || 0,
        appleMusic: data.datasets[2].data[index] || 0,
        amazonPrime: data.datasets[3].data[index] || 0,
        amazonUnlimited: data.datasets[4].data[index] || 0,
        pandora: data.datasets[5].data[index] || 0,
        deezer: data.datasets[6].data[index] || 0,
      });
    }
  };

  const computeYearlyData = () => {
    const yearlyTotals = {};
    const yearlyLabels = [];
    const yearlyDatasets = chartStreamingPerformance.data.datasets.map((dataset) => ({
      ...dataset,
      data: [],
    }));

    chartStreamingPerformance.data.labels.forEach((monthLabel, index) => {
      const year = monthLabel.split(" '")[1]; // e.g. "Jan '24" -> "24"
      if (!yearlyTotals[year]) {
        yearlyTotals[year] = Array(chartStreamingPerformance.data.datasets.length).fill(0);
        yearlyLabels.push(`20${year}`);
      }
      chartStreamingPerformance.data.datasets.forEach((dataset, datasetIndex) => {
        yearlyTotals[year][datasetIndex] += dataset.data[index] || 0;
      });
    });

    yearlyDatasets.forEach((dataset, datasetIndex) => {
      dataset.data = yearlyLabels.map((year) => yearlyTotals[year.slice(-2)][datasetIndex]);
    });

    return { labels: yearlyLabels, datasets: yearlyDatasets };
  };

  const toggleViewMode = (mode) => {
    setViewMode(mode);

    if (mode === "year") {
      const yearlyData = computeYearlyData();
      setChartData(yearlyData);
      const lastYear = yearlyData.labels.slice(-1)[0];
      setHoveredLabel(lastYear);
      updateHoveredData(yearlyData, lastYear);
    } else {
      const lastMonth = chartStreamingPerformance.data.labels.slice(-1)[0];
      setChartData({ ...chartStreamingPerformance.data });
      setHoveredLabel(lastMonth);
      updateHoveredData(chartStreamingPerformance.data, lastMonth);
    }
  };

  // create/destroy chart only when canvas exists (i.e., not during maintenance)
  useEffect(() => {
    if (chartRef.current) {
      const chartInstance = new Chart(chartRef.current.getContext("2d"), {
        type: "line",
        data: chartData,
        options: {
          ...chartStreamingPerformance.options,
          legend: { display: false },
          tooltips: { enabled: false },
          hover: {
            mode: "index",
            intersect: false,
            onHover: (event, elements) => {
              if (elements.length > 0) {
                const index = elements[0]._index ?? elements[0].index; // Chart.js v2/v3 compat
                const lbl = chartData.labels[index];
                if (lbl) {
                  setHoveredLabel(lbl);
                  updateHoveredData(chartData, lbl);
                }
              }
            },
          },
        },
      });

      return () => {
        chartInstance.destroy();
      };
    }
  }, [chartData]);

  return (
    <>
      <AnalyticsHeader />
      <Container className="mt--6" fluid>
        <Row className="justify-content-center">
          <Col xl="12">
            <Card className="shadow-card">
              <CardHeader className="d-flex justify-content-between">
                <h2 className="text-center text-white mt-2">Overview</h2>
                <Dropdown isOpen={dropdownOpen} toggle={() => setDropdownOpen(!dropdownOpen)}>
                  <DropdownToggle caret color="white">
                    {viewMode === "month" ? "View By Month" : "View By Year"}
                  </DropdownToggle>
                  <DropdownMenu>
                    <DropdownItem onClick={() => toggleViewMode("month")}>View By Month</DropdownItem>
                    <DropdownItem onClick={() => toggleViewMode("year")}>View By Year</DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </CardHeader>

              <CardBody>
                {/* ███ Maintenance wrapper — if ON locally, show immediately; otherwise let MaintGate manage */}
                {maintSeed ? (
                  <MaintenanceCardNotice title="Streaming Performance" />
                ) : (
                  <MaintGate page="analytics" variant="card" title="Streaming Performance">
                    <Row className="justify-content-center">
                      <Col xs="12" className="d-flex flex-column align-items-left">
                        <span className="streaming-label text-muted">
                          {viewMode === "month" ? "Month" : "Year"}
                        </span>
                        <h1 className="hovered-month-title text-uppercase mb-1">{hoveredLabel}</h1>
                      </Col>
                    </Row>

                    <Row className="justify-content-center">
                      <Col xs="12" className="d-flex flex-column align-items-center mt--6 mb-4">
                        <h2 className="text-center mt-2">Streaming Performance</h2>
                        <p className="text-center text-muted">View streaming performance by platform</p>
                      </Col>
                    </Row>

                    <Row className="justify-content-center mb-3">
                      <Col xs="12">
                        <div className="d-flex flex-wrap justify-content-around align-items-center">
                          {[
                            { label: "YouTube", key: "youtube", color: "text-youtube" },
                            { label: "Spotify", key: "spotify", color: "text-spotify" },
                            { label: "Apple Music", key: "appleMusic", color: "text-applemusic" },
                            { label: "Amazon Prime", key: "amazonPrime", color: "text-amazonprime" },
                            { label: "Amazon Unlimited", key: "amazonUnlimited", color: "text-amazonunlimited" },
                            { label: "Pandora", key: "pandora", color: "text-pandora" },
                            { label: "Deezer", key: "deezer", color: "text-deezer" },
                          ].map(({ label, key, color }) => (
                            <div className="text-center" key={key}>
                              <span className="streaming-label">{label}</span>
                              <h1 className={`${color} font-weight-bold`}>
                                {!hoveredData || !hoveredData[key] || hoveredData[key] === 0
                                  ? "-"
                                  : hoveredData[key].toLocaleString("en-EN")}
                              </h1>
                            </div>
                          ))}
                        </div>
                      </Col>
                    </Row>

                    <div className="chart">
                      <canvas ref={chartRef} id="chart-streaming" className="chart-canvas" />
                    </div>
                  </MaintGate>
                )}
                {/* ███ /maintenance wrapper */}
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
}

export default Analytics;
