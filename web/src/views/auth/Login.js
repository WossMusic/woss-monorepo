// web/src/views/auth/Login.js
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Button,
  Card,
  CardBody,
  FormGroup,
  Form,
  Input,
  Label,
  Modal,
  ModalHeader,
  ModalBody,
} from "reactstrap";
import useWebsiteConfig from "hooks/useWebsiteConfig";

const trim = (s) => String(s || "").trim();
const strip = (s) => trim(s).replace(/\/+$/, "");

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember30, setRemember30] = useState(true);

  // error popup
  const [showError, setShowError] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  // OTP modal state
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [coolLogin, setCoolLogin] = useState(0);
  const [phoneHint, setPhoneHint] = useState("");

  const otpRefs = useRef([]);
  const navigate = useNavigate();
  const config = useWebsiteConfig();

  // ---- Resolve API base (env first, then hook) ----
  const envBase = trim(process.env.REACT_APP_API_BASE || "");
  const hookBase = trim(config?.domain || "");
  const API_BASE = strip(envBase || hookBase);
  const apiMissing = !API_BASE;

  const getHomePath = (role) => {
    const r = String(role || "").trim().toLowerCase();
    return r === "royalty share" ? "/app/portal/splits" : "/app/portal/catalog";
  };

  // countdown for resend
  useEffect(() => {
    if (!coolLogin) return;
    const t = setTimeout(() => setCoolLogin((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [coolLogin]);

  // autofocus first OTP box when modal opens
  useEffect(() => {
    if (!otpOpen) return;
    const t = setTimeout(() => otpRefs.current?.[0]?.focus(), 80);
    return () => clearTimeout(t);
  }, [otpOpen]);

  const triggerErrorPopup = () => {
    setFadeOut(false);
    setShowError(true);
    setTimeout(() => setFadeOut(true), 1500);
    setTimeout(() => setShowError(false), 3000);
  };

  // request login OTP and open modal
  const openOtp = async () => {
    if (apiMissing) return triggerErrorPopup();
    try {
      setOtpSending(true);
      const res = await fetch(`${API_BASE}/api/auth/login/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setPhoneHint(data.phone_hint || "");
        setOtpDigits(["", "", "", "", "", ""]);
        setOtpOpen(true);
        setCoolLogin(30);
      } else {
        triggerErrorPopup();
      }
    } catch (e) {
      console.error("request-otp error:", e);
      triggerErrorPopup();
    } finally {
      setOtpSending(false);
    }
  };

  // verify login OTP
  const verifyOtp = async () => {
    if (apiMissing) return triggerErrorPopup();
    const code = otpDigits.join("");
    if (code.length !== 6) return;
    try {
      setOtpVerifying(true);
      const res = await fetch(`${API_BASE}/api/auth/login/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, remember: remember30 }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success && data?.token) {
        if (data.mfa_trust_token) {
          localStorage.setItem("woss_mfa_trust", data.mfa_trust_token);
        }
        localStorage.setItem("woss_token", data.token);
        localStorage.setItem("woss_user", JSON.stringify(data.user));
        setOtpOpen(false);
        navigate(getHomePath(data?.user?.role), { replace: true });
      } else {
        triggerErrorPopup();
      }
    } catch (e) {
      console.error("verify-otp error:", e);
      triggerErrorPopup();
    } finally {
      setOtpVerifying(false);
    }
  };

  // login submit
  const handleLogin = async (e) => {
    e.preventDefault();
    setShowError(false);

    if (apiMissing) {
      console.error("API base is missing. Set REACT_APP_API_BASE or ensure config.domain is returned.");
      return triggerErrorPopup();
    }

    try {
      const trust = localStorage.getItem("woss_mfa_trust") || "";
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, mfa_trust_token: trust }),
      });

      if (res.status === 403) {
        let data = {};
        try { data = await res.json(); } catch (_) {}

        // Pending account route still supported
        if (data?.pending && data?.account_status === "Pending Verification") {
          sessionStorage.setItem("pending_email", email);
          if (data.project_name)
            sessionStorage.setItem("pending_project_name", data.project_name);
          navigate("/auth/pending", { replace: true });
          return;
        }

        // MFA required -> open OTP modal and send code
        if (data?.mfa_required) {
          setPhoneHint(data.phone_hint || "");
          await openOtp();
          return;
        }
      }

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.token) {
          localStorage.setItem("woss_token", data.token);
          localStorage.setItem("woss_user", JSON.stringify(data.user));
          navigate(getHomePath(data?.user?.role), { replace: true });
          return;
        }
      }

      triggerErrorPopup();
    } catch (err) {
      console.error("Login error:", err);
      triggerErrorPopup();
    }
  };

  // OTP helpers
  const setDigit = (i, v) => {
    const d = String(v).replace(/\D/g, "").slice(-1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[i] = d;
      return next;
    });
    if (d && i < 5) otpRefs.current?.[i + 1]?.focus();
  };

  const onOtpKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      setOtpDigits((prev) => {
        const next = [...prev];
        if (next[i]) {
          next[i] = "";
        } else if (i > 0) {
          next[i - 1] = "";
          otpRefs.current?.[i - 1]?.focus();
        }
        return next;
      });
      return;
    }
    if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      otpRefs.current?.[i - 1]?.focus();
    }
    if (e.key === "ArrowRight" && i < 5) {
      e.preventDefault();
      otpRefs.current?.[i + 1]?.focus();
    }
  };

  const onOtpPaste = (e) => {
    const txt = (e.clipboardData || window.clipboardData).getData("text") || "";
    const digits = txt.replace(/\D/g, "").slice(0, 6).split("");
    if (!digits.length) return;
    e.preventDefault();
    const next = Array(6).fill("");
    for (let k = 0; k < digits.length; k++) next[k] = digits[k];
    setOtpDigits(next);
    otpRefs.current?.[Math.min(digits.length, 6) - 1]?.focus();
  };

  // ---- Loader while config is fetching ----
  if (!config) {
    return (
    <div class="fw-loading-root">
  <div class="fw-loader-container">
    <div class="fw-loader-plate">
      <div class="fw-loader"></div>
    </div>
    <p class="fw-loader-text">Loading...</p>
  </div>
</div>

    );
  }
  return (
    <>
      {showError && (
        <div className={`danger-popup ${fadeOut ? "fade-out" : ""}`}>
          Unable to sign in
        </div>
      )}

      <div
        style={{
          minHeight: "100vh",
          position: "relative",
          background: "linear-gradient(180deg, #000 50%, #56BCB6 50%)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
        }}
      >
        {/* Logo */}
        <div className="text-center mb-4">
          <img
            src={require("../../assets/images/logowhite.webp")}
            alt={`${config?.name || "Woss"} Logo`}
            style={{ maxWidth: "300px", marginBottom: "50px", width: "100%" }}
          />
        </div>

        {/* Login Card */}
        <Card
          className="border-0 shadow"
          style={{ width: "100%", maxWidth: "400px", borderRadius: "6px" }}
        >
          <CardBody className="px-4 py-5 text-center">
            <h4 className="mt--4">Sign In to {config?.name || "Woss Music"}</h4>
            <hr className="mt-4" />
            <Form onSubmit={handleLogin}>
              <FormGroup>
                <label
                  style={{
                    fontSize: "0.9rem",
                    marginBottom: "6px",
                    float: "left",
                  }}
                >
                  Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    padding: "10px",
                    fontSize: "0.95rem",
                  }}
                />
              </FormGroup>

              <FormGroup className="mt-3">
                <label
                  style={{
                    fontSize: "0.9rem",
                    marginBottom: "6px",
                    float: "left",
                  }}
                >
                  Password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    padding: "10px",
                    fontSize: "0.95rem",
                  }}
                />
              </FormGroup>

              {/* Remember MFA for 30 days */}
              <FormGroup check className="mt-2 mb-4 text-left">
                <label className="form-check-label text-muted" style={{ fontSize: "0.95rem" }}>
                  <input
                    type="checkbox"
                    className="form-check-input mr-2"
                    checked={remember30}
                    onChange={(e) => setRemember30(e.target.checked)}
                  />
                  Remember for 30 days
                </label>
              </FormGroup>

              <Button color="darker" block type="submit" disabled={otpSending}>
                {otpSending ? "Sending code..." : "Sign In"}
              </Button>

              <div className="mt-4">
                <Link
                  to="/auth/forgot-password"
                  style={{
                    fontSize: "0.85rem",
                    color: "#6c757d",
                    textDecoration: "none",
                  }}
                  onMouseOver={(e) =>
                    (e.target.style.textDecoration = "underline")
                  }
                  onMouseOut={(e) =>
                    (e.target.style.textDecoration = "none")
                  }
                >
                  Click here if you forgot password
                </Link>
              </div>
            </Form>
          </CardBody>
        </Card>
      </div>

      {/* OTP Modal for LOGIN */}
      <Modal
        isOpen={otpOpen}
        toggle={() => setOtpOpen(false)}
        centered
        className="reset-mfa-modal"
      >
        <ModalHeader className="modal-header-primary">
          Verify your phone
        </ModalHeader>

        <ModalBody>
          <FormGroup className="text-center">
            <Label className="d-block mb-2">
              <span className="h5 d-block text-muted">
                Click <strong>"Send Code"</strong> to receive it on your phone.
                <br />
                We&apos;ll send the code to: {phoneHint || "your phone"}
              </span>
            </Label>

            {/* Send Code above the inputs */}
            <div className="code-input-wrap text-center">
              <button
                type="button"
                className="btn btn-sm btn-outline-primary inline-send-btn"
                onClick={openOtp}
                disabled={otpSending || coolLogin > 0}
              >
                {otpSending
                  ? "Sending..."
                  : coolLogin > 0
                  ? `Resend ${coolLogin}s`
                  : "Send Code"}
              </button>

              <hr className="mt-2 mb-2" />
              <span className="d-block font-weight-bold">
                Enter the 6-digit code
              </span>
              <hr className="mt-2 mb-3" />

              <div className="otp-inputs mt-2" onPaste={onOtpPaste}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <input
                    key={i}
                    ref={(el) => (otpRefs.current[i] = el)}
                    className="otp-box"
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={1}
                    value={otpDigits[i]}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => onOtpKeyDown(i, e)}
                    aria-label={`Login OTP digit ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </FormGroup>

          <div className="d-flex justify-content-center gap-2 mt-3">
            <Button color="dark" onClick={() => setOtpOpen(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              onClick={verifyOtp}
              disabled={otpVerifying || otpDigits.join("").length !== 6}
            >
              {otpVerifying ? "Verifying..." : "Verify"}
            </Button>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
}

export default Login;
