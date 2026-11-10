import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/tailwind.css";
import "./styles/index.css";

// After a new deploy, a still-open old bundle's dynamic import of a removed
// hashed chunk 404s (served index.html → MIME error). Reload to fetch the
// fresh index.html + matching assets.
window.addEventListener("vite:preloadError", () => window.location.reload());

const container = document.getElementById("root");
const root = createRoot(container);

root.render(<App />);
