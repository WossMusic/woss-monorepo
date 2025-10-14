// src/components/Navbars/AdminNavbar.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import classnames from "classnames";
import PropTypes from "prop-types";
import useWebsiteConfig from "hooks/useWebsiteConfig";
import {
  Collapse,
  DropdownMenu,
  DropdownItem,
  UncontrolledDropdown,
  DropdownToggle,
  FormGroup,
  Form,
  Input,
  InputGroupAddon,
  InputGroupText,
  InputGroup,
  ListGroupItem,
  ListGroup,
  Media,
  Navbar,
  NavItem,
  NavLink,
  Nav,
  Container,
  Row,
  Col,
} from "reactstrap";

function AdminNavbar({ theme, sidenavOpen, toggleSidenav }) {
  const navigate = useNavigate();
  const config = useWebsiteConfig();

  /* ---------- API base + axios instance ---------- */
  const token = useMemo(() => localStorage.getItem("woss_token"), []);
  const API_BASE = useMemo(() => {
    const env = String(process.env.REACT_APP_API || "").trim().replace(/\/$/, "");
    if (env) return env;
    const fromConfig = String(
      config?.apiBase || config?.backend || config?.api_url || config?.api || ""
    )
      .trim()
      .replace(/\/$/, "");
    if (fromConfig) return fromConfig;
    const { protocol, hostname, port } = window.location;
    if (port === "3000") return `${protocol}//${hostname}:4000`;
    return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  }, [config]);

  const api = useMemo(() => {
    return axios.create({
      baseURL: API_BASE,
      withCredentials: true,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }, [API_BASE, token]);

  /* ---------- profile ---------- */
  const [projectName, setProjectName] = useState("");

  useEffect(() => {
    const fetchProjectName = async () => {
      try {
        const t = localStorage.getItem("woss_token");
        if (!t) return;
        const { data } = await api.get("/api/auth/profile/me");
        if (data.success && data.profile?.project_name) {
          setProjectName(data.profile.project_name);
        }
      } catch (err) {
        if (!(err?.response && (err.response.status === 401 || err.response.status === 403))) {
          console.error("Error fetching project name:", err?.message || err);
        }
      }
    };
    fetchProjectName();
  }, [api]);

  /* ---------- notifications ---------- */
  const [notis, setNotis] = useState([]); // max 5
  const [unreadCount, setUnreadCount] = useState(0);

  const truncate = (s, n = 80) => {
    if (!s) return "";
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  };

  const formatWhen = (iso) => {
    try {
      const d = iso ? new Date(iso) : null;
      if (!d || isNaN(d.getTime())) return "now";
      const diff = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diff < 60) return "now";
      if (diff < 3600) return `${Math.floor(diff / 60)} min`;
      if (diff < 86400) return `${Math.floor(diff / 3600)} hrs`;
      return `${Math.floor(diff / 86400)} d`;
    } catch {
      return "now";
    }
  };

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      let resp;
      try {
        resp = await api.get("/api/notifications/unread", { params: { limit: 5 } });
      } catch (e1) {
        try {
          resp = await api.get("/api/notifications", { params: { limit: 5, unread: 1 } });
        } catch (e2) {
          const s = e2?.response?.status;
          if (s === 401) return;
          if (s === 403) {
            setNotis([]);
            setUnreadCount(0);
            return;
          }
          throw e2;
        }
      }

      const payload = resp?.data || {};
      const items = Array.isArray(payload.notifications)
        ? payload.notifications
        : Array.isArray(payload.data)
        ? payload.data
        : [];

      const normalized = items.slice(0, 5).map((n) => ({
        id: n.id ?? n.notification_id ?? Math.random().toString(36).slice(2),
        title: n.title || n.source || "Woss Music",
        message: n.message || n.body || "",
        created_at: n.created_at || n.when || n.timestamp || null,
      }));

      setNotis(normalized);
      setUnreadCount(
        typeof payload.unread_count === "number"
          ? payload.unread_count
          : (payload.meta && payload.meta.unread) || normalized.length
      );
    } catch (e) {
      if (!(e?.response && (e.response.status === 401 || e.response.status === 403))) {
        console.warn("Notifications fetch failed:", e?.message || e);
      }
      setNotis([]);
      setUnreadCount(0);
    }
  }, [token, api]);

  const markAllRead = useCallback(async () => {
    if (!token) return;
    try {
      try {
        await api.post("/api/notifications/mark-all-read", {});
      } catch {
        await api.post("/api/notifications/markAsReadAll", {});
      }
    } catch (e) {
      if (!(e?.response && (e.response.status === 401 || e.response.status === 403))) {
        console.warn("Mark-all-read failed:", e?.message || e);
      }
    } finally {
      setNotis([]);
      setUnreadCount(0);
    }
  }, [token, api]);

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  const [notifOpen, setNotifOpen] = useState(false);
  const toggleNotif = () => {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) fetchNotifications();
  };

  /* ---------- search open/close (unchanged) ---------- */
  const openSearch = () => {
    document.body.classList.add("g-navbar-search-showing");
    setTimeout(function () {
      document.body.classList.remove("g-navbar-search-showing");
      document.body.classList.add("g-navbar-search-show");
    }, 150);
    setTimeout(function () {
      document.body.classList.add("g-navbar-search-shown");
    }, 300);
  };
  const closeSearch = () => {
    document.body.classList.remove("g-navbar-search-shown");
    setTimeout(function () {
      document.body.classList.remove("g-navbar-search-show");
      document.body.classList.add("g-navbar-search-hiding");
    }, 150);
    setTimeout(function () {
      document.body.classList.remove("g-navbar-search-hiding");
      document.body.classList.add("g-navbar-search-hidden");
    }, 300);
    setTimeout(function () {
      document.body.classList.remove("g-navbar-search-hidden");
    }, 500);
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("woss_user");
    localStorage.removeItem("woss_token");
    localStorage.removeItem("currentReleaseId");
    localStorage.removeItem("newReleaseView");
    navigate("/auth/login");
  };

  const [internalSidenavOpen, setInternalSidenavOpen] = useState(window.innerWidth >= 1200);
  useEffect(() => {
    if (window.innerWidth < 1200) {
      document.body.classList.remove("g-sidenav-pinned");
      setInternalSidenavOpen(false);
    } else {
      document.body.classList.add("g-sidenav-pinned");
      setInternalSidenavOpen(true);
    }
  }, []);

  return (
    <>
      <Navbar
        className={classnames(
          "navbar-top navbar-expand border-bottom",
          { "navbar-dark bg-primary": theme === "dark" },
          { "navbar-dark bg-primary": theme === "light" }
        )}
      >
        <Container fluid>
          <Collapse navbar isOpen={true}>
            <Form
              className={classnames(
                "navbar-search form-inline mr-sm-3",
                { "navbar-search-light": theme === "light" },
                { "navbar-search-light": theme === "dark" }
              )}
            >
              <FormGroup className="mb-0">
                <InputGroup className="input-group-alternative input-group-merge">
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText>
                      <i className="fas fa-search" />
                    </InputGroupText>
                  </InputGroupAddon>
                  <Input placeholder="Search" type="text" />
                </InputGroup>
              </FormGroup>
              <button aria-label="Close" className="close" type="button" onClick={closeSearch}>
                <span aria-hidden={true}>×</span>
              </button>
            </Form>

            <Nav className="align-items-center ml-md-auto" navbar>
              <NavItem className="d-xl-none">
                <div
                  className={classnames(
                    "pr-3 sidenav-toggler",
                    { active: internalSidenavOpen },
                    { "sidenav-toggler-dark": theme === "dark" }
                  )}
                  onClick={() => {
                    if (document.body.classList.contains("g-sidenav-pinned")) {
                      document.body.classList.remove("g-sidenav-pinned");
                      setInternalSidenavOpen(false);
                    } else {
                      document.body.classList.add("g-sidenav-pinned");
                      setInternalSidenavOpen(true);
                    }
                  }}
                >
                  <div className="sidenav-toggler-inner">
                    <i className="sidenav-toggler-line" />
                    <i className="sidenav-toggler-line" />
                    <i className="sidenav-toggler-line" />
                  </div>
                </div>
              </NavItem>

              <NavItem className="d-sm-none">
                <NavLink onClick={openSearch}>
                  <i className="ni ni-zoom-split-in" />
                </NavLink>
              </NavItem>

          {/* -------- Notifications dropdown -------- */}
<UncontrolledDropdown nav isOpen={notifOpen} toggle={toggleNotif}>
  <DropdownToggle
    className="nav-link position-relative"
    color=""
    tag="a"
    // keep the bell from moving when the badge shows
    style={{ display: "inline-flex", alignItems: "center" }}
  >
    <i className="ni ni-bell-55" />
    {unreadCount > 0 && (
      <span
        className="badge badge-warning"
        // absolutely position over the bell without shifting it
        style={{
          position: "absolute",
          top: 0,
          right: 5,
          transform: "translate(35%, -35%)",
          minWidth: 20,
          height: 20,
          padding: "0 5px",
          borderRadius: 10,
          fontSize: 10,
          lineHeight: "12px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {unreadCount > 99 ? "99+" : unreadCount}
      </span>
    )}
  </DropdownToggle>

  <DropdownMenu className="dropdown-menu-xl py-0 overflow-hidden" right>
    <div className="px-3 py-3">
      <h6 className="text-sm text-muted m-0">
        You have <strong className="text-primary">{unreadCount || 0}</strong> notifications.
      </h6>
    </div>

    <ListGroup flush>
      {notis.length === 0 ? (
        <ListGroupItem className="list-group-item-action">
          <div className="text-center text-muted small py-2">No new notifications</div>
        </ListGroupItem>
      ) : (
        notis.slice(0, 5).map((n) => (
          <ListGroupItem
            key={n.id}
            className="list-group-item-action"
            tag="div"
            style={{ cursor: "default" }}
          >
            <Row className="align-items-center">
              <Col className="col-auto">
                <span
                  className="avatar rounded-circle bg-primary d-inline-flex align-items-center justify-content-center"
                  style={{ width: 40, height: 40 }}
                >
                  <i className="ni ni-email-83 text-white" />
                </span>
              </Col>
              <div className="col ml--2">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h4 className="mb-0 text-sm">
                      {n.title || projectName || "Woss Music"}
                    </h4>
                  </div>
                  <div className="text-right text-muted">
                    <small>{formatWhen(n.created_at)}</small>
                  </div>
                </div>
                <p className="text-sm mb-0">{truncate(n.message)}</p>
              </div>
            </Row>
          </ListGroupItem>
        ))
      )}
    </ListGroup>

    <DropdownItem
      className="text-center text-primary font-weight-bold py-3"
      onClick={(e) => {
        e.preventDefault();
        markAllRead();
      }}
    >
      Mark As Read
    </DropdownItem>
  </DropdownMenu>
</UncontrolledDropdown>


              {/* -------- Shortcuts (unchanged) -------- */}
              <UncontrolledDropdown nav>
                <DropdownToggle className="nav-link" color="" tag="a">
                  <i className="ni ni-ungroup" />
                </DropdownToggle>
                <DropdownMenu className="dropdown-menu-lg dropdown-menu-dark bg-white shadow-card" right>
                  <Row className="shortcuts px-4">
                    <Col
                      className="shortcut-item"
                      href="#pablo"
                      onClick={(e) => e.preventDefault()}
                      xs="4"
                      tag="a"
                    >
                      <span className="shortcut-media avatar rounded-circle bg-primary">
                        <i className="fa fa-cog" />
                      </span>
                      <small className="text-dark">Settings</small>
                    </Col>
                    <Col
                      className="shortcut-item"
                      onClick={() => navigate("/app/portal/banking")}
                      xs="4"
                      tag="a"
                    >
                      <span className="shortcut-media avatar rounded-circle bg-primary">
                        <i className="ni ni-credit-card" />
                      </span>
                      <small className="text-dark">Banking</small>
                    </Col>
                    <Col
                      className="shortcut-item"
                      href="#pablo"
                      onClick={(e) => e.preventDefault()}
                      xs="4"
                      tag="a"
                    >
                      <span className="shortcut-media avatar rounded-circle bg-primary">
                        <i className="ni ni-books" />
                      </span>
                      <small className="text-dark">Feedback</small>
                    </Col>
                  </Row>
                </DropdownMenu>
              </UncontrolledDropdown>
            </Nav>

            {/* -------- User dropdown (unchanged) -------- */}
            <Nav className="align-items-center ml-auto ml-md-0" navbar>
              <UncontrolledDropdown nav>
                <DropdownToggle className="nav-link pr-0" color="" tag="a">
                  <Media className="align-items-center">
                    <span className="avatar avatar-sm rounded-circle">
                      <img alt="..." src={require("assets/img/theme/team-4.jpg")} />
                    </span>
                    <Media className="ml-2 d-none d-lg-block">
                      <span className="mb-0 text-sm font-weight-bold">
                        {projectName || "Loading..."} <i className="fa fa-angle-down ml-1" />
                      </span>
                    </Media>
                  </Media>
                </DropdownToggle>
                <DropdownMenu right>
                  <DropdownItem className="noti-title" header tag="div">
                    <h6 className="text-overflow m-0">Options</h6>
                  </DropdownItem>
                  <DropdownItem onClick={() => navigate("/app/portal/profile")}>
                    <i className="ni ni-single-02" />
                    <span>Profile</span>
                  </DropdownItem>
                  <DropdownItem href="#pablo" onClick={(e) => e.preventDefault()}>
                    <i className="ni ni-support-16" />
                    <span>Support</span>
                  </DropdownItem>
                  <DropdownItem divider />
                  <DropdownItem
                    href="#pablo"
                    onClick={(e) => {
                      e.preventDefault();
                      handleLogout();
                    }}
                  >
                    <i className="ni ni-user-run" />
                    <span>Logout</span>
                  </DropdownItem>
                </DropdownMenu>
              </UncontrolledDropdown>
            </Nav>
          </Collapse>
        </Container>
      </Navbar>
    </>
  );
}

AdminNavbar.defaultProps = {
  toggleSidenav: () => {},
  sidenavOpen: false,
  theme: "dark",
};
AdminNavbar.propTypes = {
  toggleSidenav: PropTypes.func,
  sidenavOpen: PropTypes.bool,
  theme: PropTypes.oneOf(["dark", "light"]),
};

export default AdminNavbar;
