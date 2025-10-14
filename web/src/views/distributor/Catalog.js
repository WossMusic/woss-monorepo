// src/views/distributor/Catalog.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "assets/css/argon-dashboard-pro-react.css";
import CatalogHeader from "components/Headers/CatalogHeader.js";
import { chartOptions, parseOptions } from "variables/charts.js";

import {
  Chart,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Legend,
  Tooltip,
} from "chart.js";

import {
  Badge,
  Card,
  CardHeader,
  Table,
  Container,
  Row,
  Col,
  Media,
} from "reactstrap";

import MaintGate from "components/Guards/MaintGate";
import MaintenanceCardNotice from "components/Maintenance/MaintenanceCardNotice";

Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Legend, Tooltip);

/** Read local map immediately to avoid a first-paint flash */
function isMyProjectMaintOn() {
  try {
    const map = JSON.parse(localStorage.getItem("maintenance_pages") || "{}");
    return !!map["my-project"];
  } catch {
    return false;
  }
}

function Catalog() {
  React.useEffect(() => {
    if (window.Chart) {
      parseOptions(Chart, chartOptions());
    }
  }, []);

  const [releases, setReleases] = useState([]);
  const navigate = useNavigate();

  // 👉 Go to the canonical editor using the best identifier available
  const handleRowClick = (release) => {
    localStorage.setItem("currentReleaseId", String(release.id));
    const key = release.public_id || release.slug || release.id;
    navigate(`/app/portal/catalog/core-info/${key}`);
  };

  const handleRowKeyDown = (e, release) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleRowClick(release);
    }
  };

  useEffect(() => {
    const fetchReleases = async () => {
      const token = localStorage.getItem("woss_token");
      const res = await fetch("http://localhost:4000/api/user/releases/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setReleases(data.releases || []);
    };
    fetchReleases();
  }, []);

  const renderStatusBadge = (statusRaw) => {
    const key = String(statusRaw || "Draft").trim().toLowerCase();
    const map = {
      "draft":             { dot: "bg-gray",    label: "Draft" },
      "in review":         { dot: "bg-warning", label: "In Review" },
      "update in review":  { dot: "bg-warning", label: "Update In Review" },
      "approved":          { dot: "bg-success", label: "Approved" },
      "distributed":       { dot: "bg-success", label: "Distributed" },
    };
    const { dot, label } = map[key] || { dot: "bg-secondary", label: statusRaw || "Unknown" };
    return (
      <Badge className="badge-dot mr-4">
        <i className={dot} />
        <span className="status text-sm font-weight-bold">{label}</span>
      </Badge>
    );
  };

  // seed to prevent flash, then let MaintGate keep it in sync with server/local changes
  const maintSeed = isMyProjectMaintOn();

  return (
    <>
      <CatalogHeader />
      <Container className="mt--6" fluid>
        <Row>
          <Col xs="12">
            <Card className="shadow-card">
              <CardHeader className="border-0">
                <Row>
                  <Col xs="6">
                    <h3 className="mb-0 text-white">
                      <i className="fa fa-music" /> Products
                    </h3>
                  </Col>
                </Row>
              </CardHeader>

              {maintSeed ? (
                // Immediate local render (no flash)
                <MaintenanceCardNotice title="Products" />
              ) : (
                // Live guard: replaces children with the same notice when maintenance is ON
                <MaintGate page="my-project" variant="card" title="Products">
                  <Table className="align-items-center table-flush" responsive>
                    <thead className="thead">
                      <tr>
                        <th scope="col">Artwork</th>
                        <th className="sort" data-sort="rname" scope="col">Product Title</th>
                        <th className="sort" data-sort="rgpidcode" scope="col">UPC/EAN</th>
                        <th className="sort" data-sort="rdate" scope="col">Release Date</th>
                        <th className="sort" data-sort="rtype" scope="col">Type</th>
                        <th className="sort" data-sort="rstatus" scope="col">Status</th>
                      </tr>
                    </thead>

                    <tbody className="list">
                      {releases.map((release) => (
                        <tr
                          key={release.id}
                          onClick={() => handleRowClick(release)}
                          onKeyDown={(e) => handleRowKeyDown(e, release)}
                          role="button"
                          tabIndex={0}
                          style={{ cursor: "pointer" }}
                        >
                          <td style={{ width: "80px" }}>
                            <img
                              src={
                                release.artwork_url
                                  ? `http://localhost:4000${release.artwork_url}`
                                  : `http://localhost:4000/uploads/artworks/default.png`
                              }
                              alt={release.display_title || "Artwork"}
                              style={{
                                width: "80px",
                                height: "80px",
                                borderRadius: "8px",
                                objectFit: "cover",
                              }}
                            />
                          </td>

                          <td>
                            <span className="name mb-0 text-sm font-weight-bold">
                              {release.display_title || "—"}
                            </span>
                          </td>

                          <td className="budget text-sm font-weight-bold">
                            {release.gpid_code || "Creating..."}
                          </td>

                          <td className="rdate text-sm font-weight-bold">
                            {release.product_release_date
                              ? new Date(release.product_release_date).toLocaleDateString()
                              : "—"}
                          </td>

                          <td className="rtype text-sm font-weight-bold">
                            {release.release_type || "—"}
                          </td>

                          <td>{renderStatusBadge(release.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </MaintGate>
              )}
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
}

export default Catalog;
