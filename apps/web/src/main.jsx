import React from "react";          // ✅ Add this explicitly
import { createRoot } from "react-dom/client";
import App from "./app/page.jsx";   // your dashboard component

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<App />);
