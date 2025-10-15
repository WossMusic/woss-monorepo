// web/src/layouts/Auth.js
import React from "react";
import { useLocation, Route, Routes, Navigate } from "react-router-dom";

// core components
import AuthFooter from "components/Footers/AuthFooter.js";
import "assets/css/newfront.css";

// routes
import routes from "routes.js";

function Auth() {
  const location = useLocation();
  const { pathname } = location;
  const mainContentRef = React.useRef(null);

  React.useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.scrollingElement.scrollTop = 0;
    if (mainContentRef.current) mainContentRef.current.scrollTop = 0;

    document.body.classList.add("bg-darker");
    return () => {
      document.body.classList.remove("bg-darker");
    };
  }, []);

  React.useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.scrollingElement.scrollTop = 0;
    if (mainContentRef.current) mainContentRef.current.scrollTop = 0;
  }, [location]);

  const getRoutes = (routesArr) =>
    routesArr.map((prop, key) => {
      if (prop.collapse) return getRoutes(prop.views);
      if (prop.layout === "/auth") {
        return <Route path={prop.path} element={prop.component} key={key} exact />;
      }
      return null;
    });

  // Hide footer on specific auth pages
  const hideFooter =
    pathname === "/auth/login" ||
    pathname === "/auth/forgot-password" ||
    pathname.startsWith("/auth/new-password");

  return (
    <>
      <div className="main-content" ref={mainContentRef}>
        <Routes>
          {getRoutes(routes)}
          <Route path="*" element={<Navigate to="/auth/login" replace />} />
        </Routes>
      </div>
      {!hideFooter && <AuthFooter />}
    </>
  );
}

export default Auth;
