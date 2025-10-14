import React from "react";
import { useLocation, Route, Routes, Navigate } from "react-router-dom";

// core components
import AuthFooter from "components/Footers/AuthFooter.js";
import "assets/css/newfront.css";

// routes
import routes from "routes.js";

function Auth() {
  const location = useLocation();
  const mainContentRef = React.useRef(null);

  React.useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.scrollingElement.scrollTop = 0;
    mainContentRef.current.scrollTop = 0;

    document.body.classList.add("bg-darker");

    return () => {
      document.body.classList.remove("bg-darker");
    };
  }, []);

  React.useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.scrollingElement.scrollTop = 0;
    mainContentRef.current.scrollTop = 0;
  }, [location]);

  const getRoutes = (routes) =>
    routes.map((prop, key) => {
      if (prop.collapse) return getRoutes(prop.views);
      if (prop.layout === "/auth") {
        return <Route path={prop.path} element={prop.component} key={key} exact />;
      }
      return null;
    });

  const isLoginPage = location.pathname === "/auth/login";

  return (
    <>
      <div className="main-content" ref={mainContentRef}>
        <Routes>
          {getRoutes(routes)}
          <Route path="*" element={<Navigate to="/auth/login" replace />} />
        </Routes>
      </div>
      {!isLoginPage && <AuthFooter />}
    </>
  );
}

export default Auth;
