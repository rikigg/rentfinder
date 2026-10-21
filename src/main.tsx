import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initTheme } from "./theme";
import { initTelegramViewport } from "./telegramViewport";
import "./styles.css";

initTelegramViewport();
initTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
