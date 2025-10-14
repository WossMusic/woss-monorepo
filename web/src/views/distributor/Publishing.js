// src/views/distributor/Publishing.js
import React from "react";
import "assets/css/argon-dashboard-pro-react.css";
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

import PublishingHeader from "components/Headers/PublishingHeader.js";
import MaintGate from "components/Guards/MaintGate";
import MaintenanceCardNotice from "components/Maintenance/MaintenanceCardNotice";

/* Read role quickly from JWT (no network) */
function readRoleFromToken() {
  try {
    const t = localStorage.getItem("woss_token") || "";
    const payload = JSON.parse(atob(t.split(".")[1] || ""));
    return String(payload?.role || "").toLowerCase();
  } catch {
    return "";
  }
}

/* Read maintenance immediately to avoid first-paint flash on the card,
   but never show the seed to Admin/Super Admin */
function isPublishingMaintOn() {
  try {
    const role = readRoleFromToken();
    if (role === "admin" || role === "super admin") return false; // admin bypass for the seed
    const map = JSON.parse(localStorage.getItem("maintenance_pages") || "{}");
    return !!map["publishing"];
  } catch {
    return false;
  }
}

function Publishing() {
  const maintSeed = isPublishingMaintOn();

  return (
    <>
      <PublishingHeader />
      <Container className="mt--6" fluid>
        <Row>
          <Col xs="12">
            <Card className="shadow-card">
              <CardHeader className="border-0">
                <Row>
                  <Col xs="10">
                    <h3 className="mb-0 text-white">
                      <i className="fa fa-list-alt" /> Composition Manager
                    </h3>
                  </Col>
                </Row>
              </CardHeader>

              {/* Gate the card body — when publishing is in maintenance, show the shared notice.
                  We seed from localStorage to avoid a flash for non-admins,
                  then let MaintGate keep it in sync for everyone. */}
              {maintSeed ? (
                <MaintenanceCardNotice title="Composition Manager" />
              ) : (
                <MaintGate page="publishing" variant="card" title="Composition Manager">
                  <Table className="align-items-center table-flush" responsive>
                    <thead className="thead">
                      <tr>
                        <th className="sort" data-sort="worktitle" scope="col">
                          Song Title
                        </th>
                        <th className="sort" data-sort="workdateadded" scope="col">
                          Date Added
                        </th>
                        <th className="sort" data-sort="workpro" scope="col">
                          PRO
                        </th>
                        <th className="sort" data-sort="workid" scope="col">
                          Work ID
                        </th>
                        <th className="sort" data-sort="publishingstatus" scope="col">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="list">
                      <tr>
                        <th scope="row">
                          <Media className="align-items-center">
                            <div className="avatar rounded-circle mr-3">
                              <i className="ni ni-sound-wave" />
                            </div>
                            <Media>
                              <span className="name mb-0 text-sm">-</span>
                            </Media>
                          </Media>
                        </th>
                        <td className="budget text-sm font-weight-bold">19 Sept 2024</td>
                        <td className="rdate text-sm font-weight-bold">ASCAP</td>
                        <td className="rdate text-sm font-weight-bold">92645478</td>
                        <td>
                          <Badge className="badge-dot mr-4">
                            <i className="bg-success" />
                            <span className="status text-sm font-weight-bold">Accepted</span>
                          </Badge>
                        </td>
                      </tr>
                    </tbody>
                  </Table>
                </MaintGate>
              )}
              {/* /gate */}
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
}

export default Publishing;
