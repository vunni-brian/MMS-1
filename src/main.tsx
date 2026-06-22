/**
 * Application entry point.
 * Mounts the React <App /> component to the #root DOM element.
 * Throws explicitly if the root element is missing from index.html.
 */
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@/lib/i18n";

const rootElement = document.getElementById("root");

if (!rootElement) {
 throw new Error(
 '[MMS] Root element #root not found. Check that index.html contains <div id="root"></div>.',
 );
}

createRoot(rootElement).render(<App />);
