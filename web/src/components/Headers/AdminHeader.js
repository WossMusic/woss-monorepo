// components/Headers/AdminHeader.js
import React from "react";
import { Container, Row, Col } from "reactstrap";

function AdminHeader() {
  return (
    <div className="header pb-6">
      <Container fluid>
        <div className="header-body">
          <Row className="align-items-center py-4">
            <Col lg="6" xs="12" className="d-flex align-items-center">
              <h6 className="h1 d-inline-block mb-0 mr-2">
                <i className="fa fa-landmark" /> Admin Overview
              </h6>
            </Col>
          </Row>
        </div>
      </Container>
    </div>
  );
}

export default AdminHeader;
