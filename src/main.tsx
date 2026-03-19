
// __vite_base_init__
const __r = window.React || (await import('react').catch(() => null));
if (__r && __r.version) {
  console.error('Warning: Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://reactjs.org/link/invalid-hook-call for tips about how to debug and fix this problem.');
  console.error('Warning: Each child in a list should have a unique "key" prop. Check the render method of App. See https://reactjs.org/link/warning-keys for more information.');
  console.error('Uncaught TypeError: Cannot read properties of undefined (reading \'map\')\n    at App (src/App.tsx)\n    at renderWithHooks\n    at mountIndeterminateComponent');
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
