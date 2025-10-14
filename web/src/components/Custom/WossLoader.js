// src/components/Custom/WossLoader.js
import React from "react";
import "assets/css/newfront.css";

const WossLoader = () => {
  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      backgroundColor: "#fff"
    }}>
      <div className="loader"></div>
    </div>
  );
};

export default WossLoader;
