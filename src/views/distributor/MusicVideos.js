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
import MusicVideosHeader from "components/Headers/MusicVideosHeader.js";

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

function MusicVideos() {
  // This page is the “Music Videos” section (routes key: "music-videos")
  const maintSeed = isMaintOn("music-videos");

  return (
    <>
    <MusicVideosHeader hideActions={maintSeed} />
      <Container className="mt--6" fluid>
        <Row>
          <Col xs="12">
            <Card className="shadow-card">
              <CardHeader className="border-0">
                <Row>
                  <Col xs="10">
                    <h3 className="mb-0 text-white">
                      <i className="fa fa-film" /> Music Video Distribution
                    </h3>
                  </Col>
                </Row>
              </CardHeader>

              {/* ███ Maintenance wrapper (no extra CardBody to preserve spacing) */}
              {maintSeed ? (
                <MaintenanceCardNotice title="Music Videos" />
              ) : (
                <MaintGate page="music-videos" variant="card" title="Music Videos">
                  <Table className="align-items-center table-flush" responsive>
                    <thead className="thead">
                      <tr>
                        <th className="sort" data-sort="videotitle" scope="col">
                          Video Title
                        </th>
                        <th className="sort" data-sort="videocode" scope="col">
                          ISRC
                        </th>
                        <th className="sort" data-sort="releasedate" scope="col">
                          Release Date
                        </th>
                        <th className="sort" data-sort="type" scope="col">
                          Type
                        </th>
                        <th className="sort" data-sort="status" scope="col">
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
                              <i className="fa fa-video-camera" />
                            </div>
                            <Media>
                              <span className="name mb-0 text-sm">
                                Domingo De Terror
                              </span>
                            </Media>
                          </Media>
                        </th>
                        <td className="budget text-sm font-weight-bold">1925456154154</td>
                        <td className="rdate text-sm font-weight-bold">19 Sept 2024</td>
                        <td className="rtype text-sm font-weight-bold">YouTube Claim</td>
                        <td>
                          <Badge className="badge-dot mr-4" color="">
                            <i className="bg-success" />
                            <span className="status text-sm font-weight-bold">Approved</span>
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

export default MusicVideos;
