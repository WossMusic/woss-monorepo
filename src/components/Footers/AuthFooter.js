import React from "react";
import { Container, Row, Col } from "reactstrap";

function AuthFooter() {
  return (
    <footer className="auth-footer text-white text-center">
  <Container>
    <Row className="justify-content-center align-items-center">
      <Col xs="12" md="6">
      <img
          src={require("assets/images/LogoIconWhite.webp")}
          alt="Logo"
          style={{ height: "25px" }}
        />
        <img
          src={require("assets/images/slash-icon.webp")}
          alt="Logo"
          style={{ height: "30px", margin:"5px",}}
        />
        <img
          src={require("assets/images/wmg.webp")}
          alt="Logo"
          style={{ height: "30px", margin:"5px",}}
        />
        <br />
       <span>© {new Date().getFullYear()} Woss Music, All rights reserved.</span>
      </Col>
    </Row>
  </Container>
</footer>

  );
}

export default AuthFooter;
