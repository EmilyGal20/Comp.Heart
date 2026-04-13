import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#74b8ff" },
    secondary: { main: "#9b7cff" },
    background: {
      default: "#070b14",
      paper: "rgba(14, 20, 34, 0.88)",
    },
    success: { main: "#39d98a" },
    warning: { main: "#f5a524" },
    error: { main: "#ff6b7a" },
    info: { main: "#3dc8ff" },
  },
  shape: {
    borderRadius: 18,
  },
  typography: {
    fontFamily: `"Segoe UI Variable", "Segoe UI", "Inter", sans-serif`,
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700, letterSpacing: -0.4 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    subtitle1: { letterSpacing: 0.2 },
    body1: { lineHeight: 1.72 },
    body2: { lineHeight: 1.62 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(148, 163, 184, 0.12)",
          backdropFilter: "blur(18px)",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background: "linear-gradient(180deg, rgba(13,20,35,0.96), rgba(10,15,25,0.9))",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.28)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          textTransform: "none",
          paddingInline: 16,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
        },
      },
    },
  },
});

export default theme;
