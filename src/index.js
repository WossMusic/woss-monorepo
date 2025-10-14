/*!
=========================================================
* Woss Music Template Version 1.0
=========================================================
* Copyright 2024 Woss Music / Warner Music Latina Inc.
* Coded by Jetix Web
=========================================================
*/

import React from "react";
import ReactDOM from "react-dom/client";
// react library for routing
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";

// plugins styles from node_modules
import "react-notification-alert/dist/animate.css";
import "react-perfect-scrollbar/dist/css/styles.css";
import "sweetalert2/dist/sweetalert2.min.css";
import "select2/dist/css/select2.min.css";
import "quill/dist/quill.core.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
// plugins styles downloaded
import "assets/vendor/nucleo/css/nucleo.css";
// core styles
import "assets/scss/argon-dashboard-pro-react.scss?v1.2.1";

import AdminLayout from "layouts/Admin.js";
import RTLLayout from "layouts/RTL.js";
import AuthLayout from "layouts/Auth.js";
import IndexView from "views/Index.js";

// ✅ Import MonthProvider
import { MonthProvider } from "./components/Custom/MonthContext";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <BrowserRouter>
    <Routes>
      {/* ✅ Wrap AdminLayout with MonthProvider */}
      <Route
        path="/app/*"
        element={
          <MonthProvider>
            <AdminLayout />
          </MonthProvider>
        }
      />
      <Route path="/rtl/*" element={<RTLLayout />} />
      <Route path="/auth/*" element={<AuthLayout />} />
      <Route path="/" element={<IndexView />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);
