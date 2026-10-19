import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MidnightApp } from "./ledger/MidnightApp";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MidnightApp />
  </StrictMode>,
);
