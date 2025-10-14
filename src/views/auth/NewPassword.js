import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Card,
  CardBody,
  FormGroup,
  Form,
  Input,
} from "reactstrap";
import useWebsiteConfig from "hooks/useWebsiteConfig";

function NewPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showError, setShowError] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const navigate = useNavigate();
  const { token } = useParams();
  const config = useWebsiteConfig();

  if (!config) return <p>Loading...</p>;

  const triggerErrorPopup = () => {
    setFadeOut(false);
    setShowError(true);
    setTimeout(() => setFadeOut(true), 1500);
    setTimeout(() => setShowError(false), 3000);
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      triggerErrorPopup();
      return;
    }
    try {
      const res = await fetch(`${config.domain}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        navigate("/auth/login");
      } else {
        triggerErrorPopup();
      }
    } catch (err) {
      console.error("Password reset error:", err);
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
            zIndex: 9999,
            fontSize: "0.9rem",
            fontWeight: "bold",
            opacity: fadeOut ? 0 : 1,
            transition: "opacity 1.5s ease-in-out",
          }}
        >
          Unable to change password
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
            alt={`Woss Logo`}
            style={{ maxWidth: "300px", marginBottom: "50px", width: "100%" }}
          />
        </div>

        <Card className="border-0 shadow" style={{ width: "100%", maxWidth: "400px", borderRadius: "6px" }}>
          <CardBody className="px-4 py-5">
            <h3 className="mt--4 text-center">Change Password</h3>
            <hr className="mt-4 mb-4" />

            <Form onSubmit={handlePasswordReset}>
            <FormGroup >
                <label style={{ fontSize: "0.9rem", fontWeight: "600", marginBottom: "6px", float: "left" }}>
                  New Password
                </label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  style={{
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    padding: "10px",
                    fontSize: "0.95rem",
                  }}
                />
              </FormGroup>

              <FormGroup className="mb-4">
                <label style={{ fontSize: "0.9rem", fontWeight: "600", marginBottom: "6px", float: "left" }}>
                  Confirm New Password
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                Change
              </Button>
           
            </Form>

          </CardBody>
        </Card>
      </div>
    </>
  );
}

export default NewPassword;
