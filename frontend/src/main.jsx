import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { Toaster } from "@/components/shared/Toaster";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
    <Toaster />
    <ConfirmDialog />
  </StrictMode>,
);
