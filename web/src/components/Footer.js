import React from "react";
import { Container, Row, Col } from "reactstrap";

function Footer() {
  return (
    <footer className="bg-dark text-white text-center py-3">
      <Container>
        <Row>
          <Col>
            <p>© {new Date().getFullYear()} Woss Music, All Rights Reserved.</p>
            <p>
              <a href="https://www.instagram.com/wossmusic" target="_blank" rel="noopener noreferrer">
                <i className="fab fa-instagram mx-2"></i>
              </a>
              <a href="https://www.facebook.com/wossmusicofficial" target="_blank" rel="noopener noreferrer">
                <i className="fab fa-facebook-f mx-2"></i>
              </a>
              <a href="/" target="_blank" rel="noopener noreferrer">
                <i className="fab fa-youtube mx-2"></i>
              </a>
            </p>
          </Col>
        </Row>
      </Container>
    </footer>
  );
}

export default Footer;
