import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/urbanist/wght.css";
import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-600.css";
import { App } from "./app/App";
import "./styles/tokens.css";
import "./styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
