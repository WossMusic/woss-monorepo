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
import { useNavigate } from "react-router-dom";
import { Button, Container, Row, Col } from "reactstrap";

/* --- maintenance helpers --- */
function readMaint() {
  try {
    return JSON.parse(localStorage.getItem("maintenance_pages") || "{}");
  } catch {
    return {};
  }
}
const isMaintOn = (key) => !!readMaint()[String(key).toLowerCase()];

function PublishingHeader() {
  const navigate = useNavigate();

  const handleNewWorkClick = () => {
    navigate("/app/portal/new-work");
  };

  // watch maintenance flag for this page
  const [maintOn, setMaintOn] = React.useState(() => isMaintOn("publishing"));
  React.useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "maintenance_pages") setMaintOn(isMaintOn("publishing"));
    };
    window.addEventListener("storage", onStorage);
    // small polling fallback for same-tab mutations
    const id = setInterval(() => setMaintOn(isMaintOn("publishing")), 1000);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(id);
    };
  }, []);

  return (
    <>
      <div className="header pb-6">
        <Container fluid>
          <div className="header-body">
            <Row className="align-items-center py-4">
              <Col lg="6" xs="6">
                <h6 className="h1 d-inline-block mb-0 mr-2">
                  <i className="ni ni-sound-wave"></i> Publishing
                </h6>
              </Col>

              {/* Hide the action column entirely when maintenance is active */}
              {!maintOn && (
                <Col className="mt-2 mt-md-0 text-md-right" lg="6" xs="6">
                  <Button
                    className="btn-icon"
                    color="primary"
                    type="button"
                    onClick={handleNewWorkClick}
                  >
                    <span className="btn-inner--text">
                      <i className="fa fa-plus"></i> Add Work
                    </span>
                  </Button>
                </Col>
              )}
            </Row>
          </div>
        </Container>
      </div>
    </>
  );
}

export default PublishingHeader;
