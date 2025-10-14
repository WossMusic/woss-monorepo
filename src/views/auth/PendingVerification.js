import React, { useEffect, useState } from "react";
import { Button, Container } from "reactstrap";
import { useNavigate } from "react-router-dom";
import useWebsiteConfig from "hooks/useWebsiteConfig";
import AuthHeader from "components/Headers/AuthHeader";

export default function PendingVerification() {
  const navigate = useNavigate();
  const config = useWebsiteConfig();
  const [projectName, setProjectName] = useState("");

  // read pending info saved by login/register flows
  useEffect(() => {
    const name = sessionStorage.getItem("pending_project_name") || "";
    const email = sessionStorage.getItem("pending_email") || "";
    if (!name || !email) {
      navigate("/auth/login", { replace: true });
      return;
    }
    setProjectName(name);
  }, [navigate]);

  // if somehow there is a token already, go to catalog
  useEffect(() => {
    const token = localStorage.getItem("woss_token");
    if (token) navigate("/app/portal/catalog", { replace: true });
  }, [navigate]);

  // poll backend every 5s; on Active → go to login for a clean sign-in
  useEffect(() => {
    if (!config) return;
    const email = sessionStorage.getItem("pending_email") || "";
    if (!email) return;

    let stop = false;

    const check = async () => {
      try {
        const res = await fetch(`${config.domain}/api/auth/account-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (!stop && res.ok && data?.account_status === "Active") {
          // clear pending flags and send the user to login to get a token
          sessionStorage.removeItem("pending_project_name");
          sessionStorage.removeItem("pending_email");
          navigate("/auth/login", { replace: true, state: { activated: true } });
        }
      } catch (_) {
        /* ignore transient errors */
      }
    };

    // run immediately, then poll
    check();
    const id = setInterval(check, 5000);
    return () => { stop = true; clearInterval(id); };
  }, [config, navigate]);

  if (!config || !projectName) return null;

  const handleBack = () => {
    sessionStorage.removeItem("pending_project_name");
    sessionStorage.removeItem("pending_email");
    navigate("/auth/login");
  };

  return (
    <>
      <AuthHeader />
      <div className="white-body pv-shell">
        <Container className="pv-wrap">
          <section className="pv-card" role="dialog" aria-modal="true" aria-labelledby="pv-title">
            {/* Decorative glow / icon kept if you like your current CSS */}
            <div className="pv-card-glow" aria-hidden="true" />
            <div className="pv-icon" aria-hidden="true">
              <span className="pv-ring" />
              <span className="pv-dot" />
            </div>

            <h2 id="pv-title" className="pv-title">Pending Verification</h2>
            <p className="pv-subtitle mt-4">
              <strong className="text-bold">{projectName}</strong> is being verified by <strong className="text-bold">Woss Music</strong>.
              We’ll notify you by email when it’s active.
            </p>
            <div className="pv-actions mt-4 mb-4">
              <Button className="pv-btn pv-btn-primary" onClick={handleBack}>
                Back to Sign In
              </Button>
            </div>

            {/* Optional helper text */}
            <div style={{marginTop:10, color:"#94a3b8", fontSize:12}}>
              We’re checking your status automatically every few seconds.
            </div>
          </section>
        </Container>
      </div>
    </>
  );
}
