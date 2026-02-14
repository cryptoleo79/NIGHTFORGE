// Lightweight Explorer - NO WASM, NO wallet, NO polkadot/api
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ExplorerLite } from "./pages/explorer-lite";
import "./index.css";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<ExplorerLite />} />
      <Route path="/block/:height" element={<ExplorerLite />} />
      <Route path="/tx/:hash" element={<ExplorerLite />} />
    </Routes>
  </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
