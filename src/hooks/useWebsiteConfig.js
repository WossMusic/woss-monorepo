// src/hooks/useWebsiteConfig.js
import { useState, useEffect } from "react";

const useWebsiteConfig = () => {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch("http://localhost:4000/api/website/config");
        const data = await res.json();
        if (data.success) {
          setConfig(data.config);
        }
      } catch (err) {
        console.error("Error loading website config:", err);
      }
    };

    fetchConfig();
  }, []);

  return config;
};

export default useWebsiteConfig;
