/*!
=========================================================
* Woss Music Template Version 1.0
=========================================================
* Copyright 2024 Woss Music / Warner Music Latina Inc.
* Coded by Jetix Web
=========================================================
* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/
import React from "react";
import { useNavigate } from "react-router-dom";

// reactstrap components
import { Container, Row, Button, Col } from "reactstrap";

function MusicVideosHeader({ hideActions = false }) {
  const navigate = useNavigate();

  const handleAddMusicVideoClick = () => {
    navigate("/app/portal/new-music-video");
  };

  return (
    <>
      <div className="header pb-6">
        <Container fluid>
          <div className="header-body">
            <Row className="align-items-center py-4">
              <Col lg="6" xs="8">
                <h6 className="h1 d-inline-block mb-0 mr-2">
                  <i className="fa fa-video" /> Music Videos
                </h6>
              </Col>

              {!hideActions && (
                <Col className="mt-2 mt-md-0 text-md-right" lg="6" xs="4">
                  <Button
                    className="btn-icon"
                    color="primary"
                    type="button"
                    onClick={handleAddMusicVideoClick}
                  >
                    <span className="btn-inner--text">
                      <i className="fa fa-plus" /> Add
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

export default MusicVideosHeader;
