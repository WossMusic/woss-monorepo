import React, { useEffect, useState } from "react";
import AccountingHeader from "components/Headers/AccountingHeader.js";
import { Container, Row, Col } from "reactstrap";

/* Sections */
import StatementOverview from "./Accounting/StatementOverview";
import CategoriesSection from "./Accounting/CategoriesSection";
import CountriesSection from "./Accounting/CountriesSection";
import TracksSection from "./Accounting/TracksSection";
import TrendsSection from "./Accounting/TrendsSection";
import SharedSection from "./Accounting/SharedSection";

/* ───────────────── Tabs config (pure state; no URLs) ───────────────── */
const tabLabels = {
  statement: "Statements",
  categories: "Categories",
  countries: "Countries",
  tracks: "Tracks",
  trends: "All Trends & Analyses",
  shared: "All Shared Royalties",
};

function Accounting() {
  // restore last chosen tab from localStorage (fallback to 'statement')
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("accounting_active_tab") || "statement";
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState("gross");

  // keep localStorage in sync when the tab changes (no navigation)
  useEffect(() => {
    localStorage.setItem("accounting_active_tab", activeTab);
  }, [activeTab]);

  const goToTab = (tabKey) => {
    setActiveTab(tabKey);
    setMenuOpen(false);
  };

  return (
    <>
      <AccountingHeader />
      <Container fluid className="pb-0">
        <Row className="mb-4">
          <Col xs="12">
            <nav className="bg-dark w-100 px-3 py-2 nav-rounded-mobile">
              {/* Mobile menu header */}
              <div
                className="d-flex d-md-none justify-content-center align-items-center"
                onClick={() => setMenuOpen(!menuOpen)}
                style={{ cursor: "pointer", color: "white" }}
              >
                <div className="d-flex align-items-center justify-content-center mt-2">
                  <i className="fa fa-bars mr-2" />
                  <span className="font-weight-bold mobile-tab-label">
                    {tabLabels[activeTab]}
                  </span>
                  <i className={`fa fa-chevron-${menuOpen ? "up" : "down"} ml-2`} />
                </div>
              </div>

              {/* Dropdown - mobile only */}
              <div className={`dropdown-mobile ${menuOpen ? "open" : ""} d-md-none`}>
                {Object.entries(tabLabels).map(([key, label]) => (
                  <button
                    key={key}
                    className={`btn btn-block text-left text-white menu-link mb-1 ${
                      activeTab === key ? "active" : ""
                    }`}
                    onClick={() => goToTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Desktop nav - always visible */}
              <div className="d-none d-md-flex flex-wrap justify-content-center align-items-center">
                {Object.entries(tabLabels).map(([key, label]) => (
                  <button
                    key={key}
                    className={`mx-2 text-white menu-link ${
                      activeTab === key ? "active" : ""
                    }`}
                    onClick={() => goToTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </nav>
          </Col>
        </Row>

        {/* ✅ Tab Content */}
        {activeTab === "statement" && <StatementOverview />}
        {activeTab === "categories" && <CategoriesSection />}
        {activeTab === "countries" && <CountriesSection />}
        {activeTab === "tracks" && <TracksSection />}
        {activeTab === "shared" && <SharedSection />}
        {activeTab === "trends" && (
          <TrendsSection
            chartType={selectedChartType}
            setChartType={setSelectedChartType}
          />
        )}
      </Container>
    </>
  );
}

export default Accounting;
