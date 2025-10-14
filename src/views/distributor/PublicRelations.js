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
import React from "react";
import "assets/css/argon-dashboard-pro-react.css";

// reactstrap components
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

// core components
import PublicRelationsHeader from "components/Headers/PublicRelationsHeader.js";

/* ─── Maintenance helpers ─────────────────────────────────────────────── */
import MaintGate from "components/Guards/MaintGate";
import MaintenanceCardNotice from "components/Maintenance/MaintenanceCardNotice";

/** Read local maintenance map immediately to avoid first-paint flash */
function isMaintOn(pageKey) {
  try {
    const map = JSON.parse(localStorage.getItem("maintenance_pages") || "{}");
    return !!map[String(pageKey).toLowerCase()];
  } catch {
    return false;
  }
}

function PublicRelations() {
  const maintSeed = isMaintOn("public-relations");

  return (
    <>
      <PublicRelationsHeader />
      <Container className="mt--6" fluid>
        <Row>
          <Col xs="12">
            <Card className="shadow-card">
              <CardHeader className="border-0">
                <Row>
                  <Col xs="10">
                    <h3 className="mb-0 text-white">
                      <i className="fa fa-list-alt" /> Public Relations
                    </h3>
                  </Col>
                </Row>
              </CardHeader>

              {/* ███ Maintenance wrapper (no extra CardBody to preserve spacing) */}
              {maintSeed ? (
                <MaintenanceCardNotice title="Public Relations" />
              ) : (
                <MaintGate page="public-relations" variant="card" title="Public Relations">
                  <Table className="align-items-center table-flush" responsive>
                    <thead className="thead">
                      <tr>
                        <th className="sort" data-sort="publicrelationstitle" scope="col">
                          Video Title
                        </th>
                        <th className="sort" data-sort="publicrelationsdate" scope="col">
                          Date
                        </th>
                        <th className="sort" data-sort="publicrelationsplatform" scope="col">
                          Platform
                        </th>
                        <th className="sort" data-sort="publicrelationsurl" scope="col">
                          URL (Link)
                        </th>
                        <th className="sort" data-sort="publicrelationstatus" scope="col">
                          Status
                        </th>
                        <th scope="col" />
                      </tr>
                    </thead>
                    <tbody className="list">
                      <tr>
                        <th scope="row">
                          <Media className="align-items-center">
                            <div className="avatar rounded-circle mr-3">
                              <i className="fa fa-music" />
                            </div>
                            <Media>
                              <span className="name mb-0 text-sm">
                                ATB - Ecstasy (Morten Granau Remix)
                              </span>
                            </Media>
                          </Media>
                        </th>
                        <td className="budget text-sm font-weight-bold">Sept 19, 2024</td>
                        <td className="rdate text-sm font-weight-bold">YouTube</td>
                        <td className="rdate text-sm font-weight-bold">
                          <a
                            href="https://www.youtube.com/watch?v=nHqe5D4MsCU"
                            target="_blank"
                            rel="noreferrer"
                          >
                            https://www.youtube.com/watch?v=nHqe5D4MsCU
                          </a>
                        </td>
                        <td>
                          <Badge className="badge-dot" color="black">
                            <i className="bg-success" />
                            <span className="status text-sm font-weight-bold">Completed</span>
                          </Badge>
                        </td>
                      </tr>

                      {/* Additional rows can be included here */}
                    </tbody>
                  </Table>
                </MaintGate>
              )}
              {/* ███ /maintenance wrapper */}
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
}

export default PublicRelations;
