import React from "react";
import { Container, Row, Col } from "reactstrap";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

function Contact() {
  return (
    <>
      <Navbar />
      <section id="contact" className="s-contact">
        <Container>
          <Row className="text-center">
            <Col>
              <h3>Keep In Touch</h3>
              <h1>Feel free to contact us for any project or collaboration</h1>
              <p className="contact-email">
                <a href="mailto:global@wossmusic.com">global@wossmusic.com</a>
              </p>
            </Col>
          </Row>
        </Container>
      </section>
      <Footer />
    </>
  );
}

export default Contact;
