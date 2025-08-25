import React from "react";
import ReactDOM from "react-dom/client";
import Page from "./app/page.jsx"; // adjust if root.tsx is main app instead

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>
);
