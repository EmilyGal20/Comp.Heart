import { alpha, createTheme } from "@mui/material/styles";

function buildPalette(mode) {
  if (mode === "light") {
    return {
      mode,
      primary: { main: "#2563eb" },
      secondary: { main: "#6d4aff" },
      success: { main: "#168f5c" },
      warning: { main: "#d47c12" },
      error: { main: "#d14343" },
      info: { main: "#0284c7" },
      background: {
        default: "#edf2f8",
        paper: "rgba(255,255,255,0.92)",
      },
      divider: "rgba(15, 23, 42, 0.08)",
      text: {
        primary: "#0f172a",
        secondary: "rgba(15, 23, 42, 0.72)",
      },
    };
  }

  return {
    mode,
    primary: { main: "#74b8ff" },
    secondary: { main: "#9b7cff" },
    success: { main: "#39d98a" },
    warning: { main: "#f5a524" },
    error: { main: "#ff6b7a" },
    info: { main: "#3dc8ff" },
    background: {
      default: "#070b14",
      paper: "rgba(14, 20, 34, 0.88)",
    },
    divider: "rgba(148, 163, 184, 0.12)",
    text: {
      primary: "#eef3ff",
      secondary: "rgba(226, 232, 240, 0.72)",
    },
  };
}

export function buildTheme(mode = "dark") {
  const palette = buildPalette(mode);
  const isLight = mode === "light";

  return createTheme({
    palette,
    shape: {
  borderRadius: 8,
},
    spacing: 8,
    typography: {
      fontFamily: `"Segoe UI Variable", "Segoe UI", "Inter", sans-serif`,
      h3: { fontWeight: 700, letterSpacing: -0.8 },
      h4: { fontWeight: 700, letterSpacing: -0.5 },
      h5: { fontWeight: 700, letterSpacing: -0.3 },
      h6: { fontWeight: 700, letterSpacing: -0.2 },
      subtitle1: { letterSpacing: 0.1 },
      body1: { lineHeight: 1.66 },
      body2: { lineHeight: 1.58 },
      overline: { fontWeight: 700, letterSpacing: 2.2 },
      button: { fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            transition: "background-color 180ms ease, color 180ms ease",
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            border: `1px solid ${palette.divider}`,
            backdropFilter: "blur(18px)",
          },
        },
      },
      MuiCard: {
  styleOverrides: {
    root: {
      borderRadius: 10,
            background: isLight
              ? "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.94))"
              : "linear-gradient(180deg, rgba(13,20,35,0.96), rgba(10,15,25,0.9))",
            boxShadow: isLight
              ? "0 18px 48px rgba(15, 23, 42, 0.08)"
              : "0 20px 60px rgba(0, 0, 0, 0.28)",
          },
        },
      },
      MuiButton: {
  styleOverrides: {
    root: {
      borderRadius: 8,
            textTransform: "none",
            paddingInline: 16,
            minHeight: 40,
          },
          outlined: {
            borderColor: palette.divider,
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          variant: "outlined",
        },
      },
      MuiOutlinedInput: {
  styleOverrides: {
    root: {
      borderRadius: 8,
            backgroundColor: isLight ? alpha("#ffffff", 0.7) : alpha("#0f172a", 0.24),
          },
        },
      },
      MuiChip: {
  styleOverrides: {
    root: {
      borderRadius: 8,
            height: 28,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            background: isLight ? "rgba(248,250,252,0.94)" : "rgba(6, 10, 18, 0.92)",
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 14,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${palette.divider}`,
          },
          head: {
            color: palette.text.secondary,
            fontWeight: 700,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
          },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          root: {
            padding: 10,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 8,
          },
        },
      },
    },
  });
}

export default buildTheme;
