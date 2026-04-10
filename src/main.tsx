import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyCachedTheme } from "./lib/themes";

// Apply cached theme instantly before React renders to avoid flash
applyCachedTheme();

createRoot(document.getElementById("root")!).render(<App />);
