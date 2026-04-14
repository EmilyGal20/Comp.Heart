import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CssBaseline, ThemeProvider } from "@mui/material";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./store/AuthContext";
import { RealtimeProvider } from "./store/RealtimeContext";
import { buildTheme } from "./styles/theme";
import { ThemeModeProvider, useThemeMode } 
from "./store/ThemeModeContext";import "./styles/global.css";


function AppWithTheme() {
  const { resolvedMode } = useThemeMode();
  const theme = buildTheme(resolvedMode);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ThemeProvider>
  );
}

// ReactDOM.createRoot(document.getElementById("root")).render(
//   <React.StrictMode>
//     <BrowserRouter>
//       <AuthProvider>
//         <RealtimeProvider>
//           <ThemeProvider theme={theme}>
//             <CssBaseline />
//             <ErrorBoundary>
//               <App />
//             </ErrorBoundary>
//           </ThemeProvider>
//         </RealtimeProvider>
//       </AuthProvider>
//     </BrowserRouter>
//   </React.StrictMode>
// );

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RealtimeProvider>
          <ThemeModeProvider>
            <AppWithTheme />
          </ThemeModeProvider>
        </RealtimeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);