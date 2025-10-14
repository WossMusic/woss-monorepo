import React from "react";
import { Container, Row, Col } from "reactstrap";
import { Link } from "react-router-dom";

function IndexHeader() {
  
  return (

    
    <section id="home" className="s-home page-hero target-section">

    
      <Container className="text-center">
        <Row className="mt-6">
          <Col>
          <div class="home-content__main">
          <img src="/assets/images/logobig.svg" alt="Woss Music" className="hero-logo"/>
            <div className="home-content__button">
              <Link to="/artists" className="smoothscroll btn btn-primary btn-large">
                OUR ARTISTS
              </Link>
              <Link to="/contact" className="smoothscroll btn btn-dark btn-large">
                LET'S TALK
              </Link>
            </div>
            </div>   
          </Col>
        </Row>
        <ul className="home-social">
              <li>
                <a href="https://www.instagram.com/wossmusic" target="_blank" rel="noreferrer"><i className="fab fa-instagram"></i><span>Instagram</span></a>
                </li>
              <li>
              <a href="https://www.facebook.com/wossmusic" target="_blank" rel="noreferrer"><i class="fab fa-facebook-f" aria-hidden="true"></i><span>Facebook</span></a>
              </li>
              <li>
                <a href="https://youtube.com/@wossmusic" target="_blank" rel="noreferrer"><i className="fab fa-youtube" target="_blank"></i><span>Youtube</span></a>
                </li>
          </ul>
      </Container>
    </section>
  );
}

export default IndexHeader;
