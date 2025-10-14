import React, { useEffect, useState } from "react";
import { Container, Row, Col, Button } from "reactstrap";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { API_BASE } from "../lib/apiBase";

function Index() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/health`, { credentials: "include" });
        const data = await res.json();
        if (mounted) setHealth(data);
      } catch (e) {
        console.error("Health check failed:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <Navbar />

      {/* Hero Section */}
      <section className="s-home page-hero">
        <div className="home-content">
          <Container className="text-center">
            <img
              src="/assets/images/logobig.svg"
              alt="Woss Music"
              style={{ width: "100%", height: "400px" }}
              loading="lazy"
            />

            {/* API health indicator */}
            {health && (
              <div className="mt-3" style={{ fontSize: 12, opacity: 0.75 }}>
                API OK • node {health.node ?? "?"} • up {Math.floor(health.uptime ?? 0)}s
              </div>
            )}

            <div className="home-content__button mt-4">
              <Button color="primary" tag={Link} to="/artists">
                Our Artists
              </Button>
              <Button color="secondary" className="ml-2" tag={Link} to="/contact">
                Let's Talk
              </Button>
            </div>
          </Container>
        </div>
      </section>

      {/* About Section */}
      <section id="services" className="s-services">
        <Container>
          <Row>
            <Col className="text-center">
              <h3>Who we are</h3>
              <h1>
                Woss Music is a record label based in the United States, operating globally and
                enjoying extensive reach in various music genres.
              </h1>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Artists Section */}
      <section id="works" className="s-works">
        <Container>
          <Row className="text-center">
            <Col>
              <h3>We have worked with</h3>
              <h1>Music Creators</h1>
            </Col>
          </Row>
          <Row>
            {[
              { name: "Yaisel LM", img: "1.webp", link: "https://www.instagram.com/yaisellm" },
              { name: "RDJavi", img: "2.webp", link: "#" },
              { name: "Las Gemelas Del Free", img: "3.webp", link: "#" },
              { name: "El Canelilla", img: "4.webp", link: "#" },
              { name: "Mil Grego", img: "5.webp", link: "#" },
              { name: "ELALE Produce", img: "6.webp", link: "#" },
            ].map((artist, index) => (
              <Col md="4" key={index} className="text-center mb-4">
                <img
                  src={`/assets/images/portfolio/${artist.img}`}
                  alt={artist.name}
                  className="img-fluid"
                  loading="lazy"
                />
                <h3>{artist.name}</h3>
                <Button color="info" href={artist.link} target="_blank" rel="noreferrer">
                  Visit Profile
                </Button>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      <Footer />
    </>
  );
}

export default Index;
