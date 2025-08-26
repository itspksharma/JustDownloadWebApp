// by Pawan Kumar Sharma
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// ✅ Import PWA register helper
import { registerSW } from "virtual:pwa-register";

const updateSW = registerSW({
  onNeedRefresh() {
    // auto update or custom popup
    if (confirm("New version available. Reload?")) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log("App ready to work offline");
  },
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
