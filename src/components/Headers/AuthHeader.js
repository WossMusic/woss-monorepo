import React from "react";
import { Container, Row, Col } from "reactstrap";

function AuthHeader() {
  return (
    <div className="auth-header">
  <Container fluid>
    <Row className="align-items-center">
      <Col xs="auto">
        <img
          src={require("assets/images/LogoIconWhite.webp")}
          alt="Logo"
          style={{ height: "25px" }}
        />
        <span class="navbar-brand-content">
        <span>Portal</span>
        </span>
      </Col>
    </Row>
  </Container>
</div>
  );
}

export default AuthHeader;
