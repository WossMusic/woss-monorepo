import React from "react";
import { useLocation, NavLink as NavLinkRRD, Link } from "react-router-dom";
import classnames from "classnames";
import { PropTypes } from "prop-types";
import PerfectScrollbar from "react-perfect-scrollbar";
import { Collapse, NavbarBrand, Navbar, NavItem, NavLink, Nav } from "reactstrap";
import useWebsiteConfig from "hooks/useWebsiteConfig";

/* ───────────────── helpers ───────────────── */

function readMaint() {
  try {
    return JSON.parse(localStorage.getItem("maintenance_pages") || "{}");
  } catch {
    return {};
  }
}

const renderIco = (iconClass) => {
  if (!iconClass) return null;
  const isFA = /\bfa\b/.test(iconClass);
  const cls = isFA ? `${iconClass} fa-fw` : iconClass;
  return (
    <span className="d-inline-block mr-2" style={{ width: 22, minWidth: 22, textAlign: "center" }}>
      <i className={cls} />
    </span>
  );
};

const MaintBadge = ({ on }) =>
  on ? (
    <span
      className="badge-sidebar badge-dark ml-auto d-inline-flex align-items-center justify-content-center"
      style={{ width: 22, minWidth: 22, height: 22 }}
      title="Under maintenance"
    >
      <i className="fa fa-refresh text-white" />
    </span>
  ) : null;

const norm = (s) => String(s || "").trim().toLowerCase();
const isAdminName = (n) => /(^|\s)admin(\s|$)/i.test(String(n || ""));

/* ─────────────── skeletons while loading ─────────────── */

const SkeletonLine = ({ w = "80%" }) => (
  <div
    className="skeleton shimmer"
    style={{
      height: 16,
      width: w,
      borderRadius: 4,
      background:
        "linear-gradient(90deg, rgba(255,255,255,.18) 25%, rgba(255,255,255,.32) 37%, rgba(255,255,255,.18) 63%)",
      backgroundSize: "400% 100%",
      animation: "sidebarShimmer 1.2s ease-in-out infinite",
    }}
  />
);

// local CSS keyframes (scoped via JS injection once)
(function injectShimmer() {
  if (document.getElementById("sidebar-shimmer-style")) return;
  const el = document.createElement("style");
  el.id = "sidebar-shimmer-style";
  el.textContent = `
    @keyframes sidebarShimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
  document.head.appendChild(el);
})();

function LoadingMenu({ count = 6 }) {
  return (
    <Nav navbar aria-label="Sidebar loading">
      {Array.from({ length: count }).map((_, i) => (
        <NavItem key={i} className="mb-2">
          <div className="d-flex align-items-center px-3 py-2" style={{ opacity: 0.9 }}>
            <span
              className="d-inline-block mr-2"
              style={{
                width: 22,
                minWidth: 22,
                height: 16,
                borderRadius: 3,
                backgroundColor: "rgba(255,255,255,.18)",
              }}
            />
            <div className="flex-grow-1">
              <SkeletonLine w={i % 3 === 0 ? "65%" : i % 3 === 1 ? "82%" : "74%"} />
            </div>
          </div>
        </NavItem>
      ))}
    </Nav>
  );
}

/* ───────────────── component ───────────────── */

function Sidebar({ toggleSidenav, sidenavOpen, routes, logo, rtlActive, rbac }) {
  const location = useLocation();

  // RBAC from parent (safe fallback)
  const safe = rbac && typeof rbac === "object" ? rbac : { loaded: true, allowed: "__ALL__", role: "" };
  const { loaded: rbacLoaded = true, allowed, role } = safe;

  const config = useWebsiteConfig();

  // build API bases (force backend, never frontend port)
  const apiBases = React.useMemo(() => {
    const out = [];
    const cfg = String(config?.domain || "").replace(/\/$/, "");
    if (cfg) out.push(cfg);
    out.push("http://localhost:4000");
    return out;
  }, [config]);

  // collect requiresPerm keys from route tree
  const requiresPermKeys = React.useMemo(() => {
    const set = new Set();
    const walk = (list) => {
      (list || []).forEach((r) => {
        if (r?.collapse && Array.isArray(r.views)) {
          walk(r.views);
        } else if (r?.requiresPerm) {
          set.add(String(r.requiresPerm));
        }
      });
    };
    walk(routes || []);
    return Array.from(set);
  }, [routes]);

  const [permLoaded, setPermLoaded] = React.useState(false);
  const [permMap, setPermMap] = React.useState({}); // { "split.view": true/false, ... }

  const [maintMap, setMaintMap] = React.useState(readMaint());
  React.useEffect(() => {
    const onStorage = (e) => e.key === "maintenance_pages" && setMaintMap(readMaint());
    window.addEventListener("storage", onStorage);
    const id = setInterval(() => setMaintMap(readMaint()), 1000);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(id);
    };
  }, []);

  const maintKeyForRoute = React.useCallback((r) => {
    const name = String(r?.name || "").toLowerCase();
    const path = String(r?.path || "");

    if (name.includes("my project") || /^\/portal\/catalog$/.test(path)) return "my-project";
    if (name.includes("accounting") || /^\/portal\/accounting(\/|$)/.test(path)) return "accounting";
    if (name.includes("splits") || /^\/portal\/splits(\/|$)/.test(path)) return "splits";

    if (name.includes("publishing")) return "publishing";
    if (name.includes("music videos")) return "music-videos";
    if (name.includes("analytics")) return "analytics";
    if (name.includes("transactions")) return "transactions";
    if (name.includes("whitelist")) return "whitelist";
    if (name.includes("promotion")) return "promotion";
    if (name.includes("marketing")) return "marketing";
    if (name.includes("public relations") || path === "/maps") return "public-relations";

    return "";
  }, []);

  // memoized signatures to avoid re-fetch churn
  const apiBasesSignature = React.useMemo(() => apiBases.join("|"), [apiBases]);
  const requiresPermSignature = React.useMemo(
    () => requiresPermKeys.slice().sort().join("|"),
    [requiresPermKeys]
  );
  const permSigRef = React.useRef(null);

  React.useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();

    async function loadPerms() {
      const sig = `${apiBasesSignature}::${requiresPermSignature}`;

      if (permSigRef.current === sig) {
        if (!permLoaded && Object.keys(permMap).length) setPermLoaded(true);
        return;
      }
      permSigRef.current = sig;

      if (!requiresPermKeys.length) {
        if (!cancelled) {
          setPermMap({});
          setPermLoaded(true);
        }
        return;
      }

      const token = localStorage.getItem("woss_token") || "";
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const allKeys = Array.from(
        new Set(requiresPermKeys.flatMap((k) => [k, k.replace(/^split\./i, "splits.")]))
      );

      for (const base of apiBases) {
        try {
          const url = `${base}/api/permissions/me?keys=${encodeURIComponent(allKeys.join(","))}`;
          const r = await fetch(url, { credentials: "include", headers, signal: ctrl.signal });

          if (!r.ok) {
            if (r.status === 401 || r.status === 403) {
              if (!cancelled) {
                const deniedMap = {};
                requiresPermKeys.forEach((k) => (deniedMap[k] = false));
                setPermMap(deniedMap);
                setPermLoaded(true);
              }
              return;
            }
            continue;
          }

          const j = await r.json();
          const p = j?.permissions || {};
          const map = {};
          requiresPermKeys.forEach((k) => {
            const legacy = k.replace(/^split\./i, "splits.");
            map[k] = !!(p[k] || p[legacy]);
          });

          if (!cancelled) {
            setPermMap(map);
            setPermLoaded(true);
          }
          return;
        } catch (e) {
          // try next base
          continue;
        }
      }

      if (!cancelled) {
        const deniedMap = {};
        requiresPermKeys.forEach((k) => (deniedMap[k] = false));
        setPermMap(deniedMap);
        setPermLoaded(true);
      }
    }

    loadPerms();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [apiBases, requiresPermKeys, apiBasesSignature, requiresPermSignature, permLoaded, permMap]);

  const activeRoute = (routeName) => (location.pathname.indexOf(routeName) > -1 ? "active" : "");

  const canSeeRoute = React.useCallback(
    (r) => {
      if (r.layout !== "/app" || r.hidden) return false;

      const mustBeAdmin = !!r.requiresAdmin || isAdminName(r.name);
      const isAdmin = ["admin", "super admin"].includes(norm(role));
      if (mustBeAdmin && !isAdmin) return false;

      if (r.requiresPerm) {
        if (isAdmin) return true;
        if (!permLoaded) return false; // <- while loading, hide perm-gated items (menu skeleton covers UI)
        if (!permMap[r.requiresPerm]) return false;
      }

      if (!r.name) return true;
      if (allowed === "__ALL__") return true;
      return allowed?.has && allowed.has(r.name);
    },
    [allowed, role, permLoaded, permMap]
  );

  const filterTree = React.useCallback(
    (list) =>
      (list || []).reduce((acc, r) => {
        if (r?.collapse && Array.isArray(r.views)) {
          const child = filterTree(r.views);
          if (child.length) acc.push({ ...r, views: child });
        } else if (canSeeRoute(r)) {
          acc.push(r);
        }
        return acc;
      }, []),
    [canSeeRoute]
  );

  const menuRoutes = React.useMemo(() => filterTree(routes), [routes, filterTree]);

  const [state, setState] = React.useState({});
  React.useEffect(() => {
    setState(getCollapseStates(menuRoutes));
    // eslint-disable-next-line
  }, [JSON.stringify(menuRoutes)]);

  const getCollapseStates = (list) => {
    let initialState = {};
    (list || []).forEach((prop) => {
      if (prop.collapse) {
        initialState = {
          [prop.state]: getCollapseInitialState(prop.views),
          ...getCollapseStates(prop.views),
          ...initialState,
        };
      }
    });
    return initialState;
  };

  const getCollapseInitialState = (list) => {
    for (let i = 0; i < (list || []).length; i++) {
      if (list[i].collapse && getCollapseInitialState(list[i].views)) return true;
      else if (location.pathname.indexOf(list[i].path) !== -1) return true;
    }
    return false;
  };

  const closeSidenav = () => {
    if (window.innerWidth < 1200) toggleSidenav();
  };

  // loading state mirrors other pages: require both rbac + perm maps ready
  const isLoadingMenu = !rbacLoaded || !permLoaded;

  const createLinks = (list) =>
    (list || []).map((prop, key) => {
      if (prop.redirect) return null;

      if (prop.collapse) {
        const st = {};
        st[prop["state"]] = !state[prop.state];
        return (
          <NavItem key={key}>
            <NavLink
              href="#pablo"
              data-toggle="collapse"
              aria-expanded={state[prop.state]}
              className={classnames({ active: getCollapseInitialState(prop.views) })}
              onClick={(e) => {
                e.preventDefault();
                setState(st);
              }}
            >
              {prop.icon ? (
                <>
                  {renderIco(prop.icon)}
                  <span className="nav-link-text d-flex align-items-center w-100">
                    <span className="flex-grow-1">{prop.name}</span>
                    <MaintBadge on={!!maintMap[maintKeyForRoute(prop)]} />
                  </span>
                </>
              ) : prop.miniName ? (
                <>
                  <span className="sidenav-mini-icon"> {prop.miniName} </span>
                  <span className="sidenav-normal"> {prop.name} </span>
                </>
              ) : null}
            </NavLink>
            <Collapse isOpen={state[prop.state]}>
              <Nav className="nav-sm flex-column">{createLinks(prop.views)}</Nav>
            </Collapse>
          </NavItem>
        );
      }

      return (
        <NavItem className={activeRoute(prop.layout + prop.path)} key={key}>
          <NavLink to={prop.layout + prop.path} onClick={closeSidenav} tag={NavLinkRRD}>
            {prop.icon !== undefined ? (
              <>
                {renderIco(prop.icon)}
                <span className="nav-link-text d-flex align-items-center w-100">
                  <span className="flex-grow-1">{prop.name}</span>
                  <MaintBadge on={!!maintMap[maintKeyForRoute(prop)]} />
                </span>
              </>
            ) : prop.miniName !== undefined ? (
              <>
                <span className="sidenav-mini-icon"> {prop.miniName} </span>
                <span className="sidenav-normal"> {prop.name} </span>
              </>
            ) : (
              prop.name
            )}
          </NavLink>
        </NavItem>
      );
    });

  // logo link props
  let navbarBrandProps;
  if (logo && logo.innerLink) {
    navbarBrandProps = { to: logo.innerLink, tag: Link };
  } else if (logo && logo.outterLink) {
    navbarBrandProps = { href: logo.outterLink, target: "_blank" };
  }

  const scrollBarInner = (
    <div className="scrollbar-inner">
      <div className="sidenav-header d-flex align-items-center">
        {logo ? (
          <NavbarBrand {...navbarBrandProps}>
            <img alt={logo.imgAlt} className="navbar-brand-img" src={logo.imgSrc} />
          </NavbarBrand>
        ) : null}

        <div className="ml-auto">
          <div
            className={classnames("sidenav-toggler", { active: sidenavOpen })}
            onClick={toggleSidenav}
            role="button"
            aria-label="Toggle sidebar"
            tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggleSidenav()}
          >
            <div className="sidenav-toggler-inner mr-4">
              <i className="sidenav-toggler-line" />
              <i className="sidenav-toggler-line" />
              <i className="sidenav-toggler-line" />
            </div>
          </div>
        </div>
      </div>

      <div className="navbar-inner">
        <Collapse navbar isOpen={true}>
          <hr className="my-0 mt--2 mb-3" />
          {isLoadingMenu ? <LoadingMenu /> : <Nav navbar>{createLinks(menuRoutes)}</Nav>}

          {allowed === "__ALL__" && !isLoadingMenu && (
            <>
              <hr className="my-3" />
              <Nav className="mb-md-3" navbar>
                {[
                  {
                    key: "tiktok-for-artists",
                    icon: "ni ni-palette",
                    label: "TikTok For Artists",
                    href:
                      "https://demos.creative-tim.com/argon-dashboard-pro-react/#/documentation/colors?ref=adpr-sidebar",
                  },
                  {
                    key: "music-tab-tiktok",
                    icon: "ni ni-ui-04",
                    label: "Music Tab - TikTok",
                    href:
                      "https://demos.creative-tim.com/argon-dashboard-pro-react/#/documentation/alert?ref=adpr-sidebar",
                  },
                  {
                    key: "marketing-playbook",
                    icon: "ni ni-spaceship",
                    label: "Marketing Playbook",
                    href:
                      "https://demos.creative-tim.com/argon-dashboard-pro-react/#/documentation/overview?ref=adpr-sidebar",
                  },
                ].map(({ key, icon, label, href }) => {
                  const isMaint = !!maintMap[String(key).toLowerCase()];
                  return (
                    <NavItem key={key}>
                      <NavLink
                        {...(isMaint
                          ? { href: "#", onClick: (e) => e.preventDefault() }
                          : { href, target: "_blank", rel: "noopener" })}
                      >
                        {renderIco(icon)}
                        <span className="nav-link-text d-flex align-items-center w-100">
                          <span className="flex-grow-1">{label}</span>
                          <MaintBadge on={isMaint} />
                        </span>
                      </NavLink>
                    </NavItem>
                  );
                })}
              </Nav>
            </>
          )}
        </Collapse>
      </div>
    </div>
  );

  return (
    <Navbar
      className={
        "sidenav navbar-vertical navbar-expand-xs navbar-light bg-primary " +
        (rtlActive ? "" : "fixed-left")
      }
    >
      {navigator.platform.indexOf("Win") > -1 ? (
        <PerfectScrollbar>{scrollBarInner}</PerfectScrollbar>
      ) : (
        scrollBarInner
      )}
    </Navbar>
  );
}

Sidebar.defaultProps = {
  routes: [{}],
  toggleSidenav: () => {},
  sidenavOpen: false,
  rtlActive: false,
  rbac: null,
};

Sidebar.propTypes = {
  toggleSidenav: PropTypes.func,
  sidenavOpen: PropTypes.bool,
  routes: PropTypes.arrayOf(PropTypes.object),
  logo: PropTypes.shape({
    innerLink: PropTypes.string,
    outterLink: PropTypes.string,
    imgSrc: PropTypes.string.isRequired,
    imgAlt: PropTypes.string.isRequired,
  }),
  rtlActive: PropTypes.bool,
  rbac: PropTypes.shape({
    loaded: PropTypes.bool,
    allowed: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    role: PropTypes.string,
  }),
};

export default Sidebar;
