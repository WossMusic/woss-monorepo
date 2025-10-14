// components/Shared/LoadingOverlay.js
import React from "react";

const LoadingOverlay = ({ message = "Loading..." }) => (
  <div className="loader-overlay">
    <div className="loader" />
    <p style={{ marginTop: "1rem", fontWeight: "bold", color: "#56bcb6" }}>
      {message}
    </p>
  </div>
);

export default LoadingOverlay;
