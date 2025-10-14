import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardBody, Button } from "reactstrap";
import useWebsiteConfig from "hooks/useWebsiteConfig";

function EmailSentSuccess() {
  const config = useWebsiteConfig();
  const navigate = useNavigate();

  if (!config) return <p>Loading...</p>;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        background: "linear-gradient(180deg, #000 50%, #56BCB6 50%)",
        padding: "1rem"
      }}
    >
      <img
        src={require("../../assets/images/logowhite.webp")}
        alt={`${config.name} Logo`}
        style={{ maxWidth: "300px", marginBottom: "40px" }}
      />

      <Card
        className="border-0 shadow"
        style={{
          width: "100%",
          maxWidth: "420px",
          borderRadius: "8px",
          textAlign: "center"
        }}
      >
        <CardBody className="px-4 py-5">
          <div style={{ fontSize: "4rem", color: "#56BCB6", marginBottom: "1rem" }}>
            <i className="fas fa-check-circle"></i>
          </div>
          <h2 className="text-dark">Email Sent!</h2>
          <p className="text-muted mb--2 h4 font-weight-500">
            We have sent a password reset link to your email. Please check your inbox to proceed.
          </p>
          <hr className="mb-4" />

          <Button color="darker" block onClick={() => navigate("/auth/login")}>Back to Login</Button>
        </CardBody>
      </Card>
    </div>
  );
}

export default EmailSentSuccess;
