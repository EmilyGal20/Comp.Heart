import React from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      // Keep diagnostics in development only.
      // eslint-disable-next-line no-console
      console.error("CompHeart UI boundary caught an error", error, info);
    }
  }

  handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      return (
        <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", px: 3 }}>
          <Stack spacing={2.5} sx={{ width: "min(560px, 100%)" }}>
            <Typography variant="h4">Something went wrong in this workspace</Typography>
            <Alert severity="error">
              {this.state.error?.message || "A rendering error interrupted the page."}
            </Alert>
            <Typography variant="body2" color="text.secondary">
              The app stayed mounted, but this section failed safely. You can retry without losing the whole session.
            </Typography>
            <Stack direction="row" spacing={1.2}>
              <Button variant="contained" onClick={this.handleReset}>Try again</Button>
              <Button variant="outlined" onClick={() => window.location.assign("/")}>Back to dashboard</Button>
            </Stack>
          </Stack>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
