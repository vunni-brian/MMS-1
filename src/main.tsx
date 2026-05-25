import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error(
    '[MMS] Root element #root not found. Check that index.html contains <div id="root"></div>.',
  );
}

createRoot(rootElement).render(<App />);
