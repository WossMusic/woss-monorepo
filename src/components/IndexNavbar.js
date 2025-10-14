import React, { useState, useEffect } from "react";
import {Link } from "react-router-dom";
import "../assets/css/newfront.css";
import useWebsiteConfig from "hooks/useWebsiteConfig";

function IndexNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const config = useWebsiteConfig();

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      if (window.scrollY > lastScrollY && window.scrollY > 50) {
        setIsScrollingDown(true);
      } else {
        setIsScrollingDown(false);
      }
      lastScrollY = window.scrollY;
    };

    if (!config) return;

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [config]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className={`s-header ${isScrollingDown ? "hidden" : ""}`}>
      <div className="header-logo">
        <Link to="/">
          <img src="/assets/images/logo.png" alt="Woss Music" />
        </Link>
      </div>

      <div className="header-actions">
        <Link to="/auth/login" className="header-user-icon">
          <i className="fa fa-user-circle fa-lg" aria-hidden="true"></i>
          <span>Portal</span>
        </Link>

        <button className="header-menu-toggle" onClick={toggleMenu}>
          <i className="fa fa-bars fa-2x"></i>
        </button>
      </div>

      <nav className={`header-nav ${isMenuOpen ? "open" : ""}`}>
        <button className="header-nav__close" onClick={toggleMenu}>✕</button>
        <h3 className="header-nav-title text-primary">NAVIGATE TO</h3>

        <ul className="header-nav__list">
          <li><Link to="/#home" onClick={toggleMenu}>Home</Link></li>
          <li><Link to="/#services" onClick={toggleMenu}>Who We Are</Link></li>
          <li><Link to="/#works" onClick={toggleMenu}>Artists</Link></li>
          <li><Link to="/contact" onClick={toggleMenu}>Contact</Link></li>
        </ul>

        <ul className="header-nav__social">
          <li className="menubtn">
            <Link to="/auth/login" onClick={toggleMenu}>
              <i className="fa fa-user-circle"></i> Portal For Artists
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}

export default IndexNavbar;
