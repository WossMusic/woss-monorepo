import React from "react";

const CustomInfoIcon = ({ size = "1.2em", className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="12" fill="#FBB03B" />
    <text
      x="12"
      y="18"
      textAnchor="middle"
      fill="white"
      fontSize="18"
      fontFamily="Arial, sans-serif"
      fontWeight="bold"
    >
      i
    </text>
  </svg>
);

export default CustomInfoIcon;
