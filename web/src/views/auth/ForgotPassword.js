import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  CardBody,
  FormGroup,
  Form,
  Input,
} from "reactstrap";
import useWebsiteConfig from "hooks/useWebsiteConfig";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [showError, setShowError] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const navigate = useNavigate();
  const config = useWebsiteConfig();

  if (!config) return <p>Loading...</p>;

  const triggerErrorPopup = () => {
    setFadeOut(false);
    setShowError(true);
    setTimeout(() => setFadeOut(true), 1500);
    setTimeout(() => setShowError(false), 3000);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${config.domain}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        navigate("/auth/email-sent");
      } else {
        triggerErrorPopup();
      }
    } catch (err) {
      console.error("Forgot Password error:", err);
      triggerErrorPopup();
    }
  };

  return (
    <>
      {showError && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#f5365c",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            zIndex: 9999,
            fontSize: "0.9rem",
            fontWeight: "bold",
            opacity: fadeOut ? 0 : 1,
            transition: "opacity 1.5s ease-in-out",
          }}
        >
          Unable to reset password
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
        <div className="text-center mb-4">
          <img
            src={require("../../assets/images/logowhite.webp")}
            alt={`${config.name} Logo`}
            style={{ maxWidth: "300px", marginBottom: "50px", width: "100%" }}
          />
        </div>

        <Card className="border-0 shadow" style={{ width: "100%", maxWidth: "400px", borderRadius: "6px" }}>
          <CardBody className="px-4 py-5 text-center">
            <h3 className="mt--4">Forgot Your Password?</h3>
            <hr className="mt-4 mb-2" />
            <label className="h5 font-weight-500">
              Enter your email address and we will send you instructions to reset your password.
            </label>
            <hr className="mt-0 mb-2" />

            <Form onSubmit={handleForgotPassword}>
              <FormGroup className="mb-4">
                <label style={{ fontSize: "0.9rem", fontWeight: "600", marginBottom: "6px", float: "left" }}>
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

              <Button color="darker" block type="submit">
                Next
              </Button>
            </Form>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

export default ForgotPassword;
