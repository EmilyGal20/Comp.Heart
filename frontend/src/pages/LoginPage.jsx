import { useMemo, useState } from "react";
import { Box, Button, Card, CardContent, Chip, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { Navigate } from "react-router-dom";
import { useAuth } from "../store/AuthContext";

function LoginPage() {
  const { isAuthenticated, login, organizations } = useAuth();
  const [form, setForm] = useState({ email: "", password: "demo123", organization_slug: "" });
  const [error, setError] = useState("");
  const orgOptions = useMemo(
    () => organizations.map((entry) => entry.organization || entry),
    [organizations]
  );

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setError("");
      await login(form);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to sign in");
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        px: 2,
        background:
          "radial-gradient(circle at top left, rgba(116,184,255,0.18), transparent 25%), radial-gradient(circle at bottom right, rgba(155,124,255,0.2), transparent 28%), linear-gradient(180deg, #060913 0%, #03050c 100%)",
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 1080, overflow: "hidden" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.08fr 0.92fr" } }}>
          <Box sx={{ p: { xs: 3, md: 5 }, borderRight: { md: "1px solid rgba(148,163,184,0.08)" } }}>
            <Chip label="COMPHEART OS" color="secondary" sx={{ mb: 2 }} />
            <Typography variant="h3" sx={{ maxWidth: 520, mb: 2 }}>
              Internal operations, upgraded for multi-organization control.
            </Typography>
            <Typography variant="body1" sx={{ color: "rgba(226,232,240,0.72)", maxWidth: 560, mb: 4 }}>
              Sign into your organization workspace or enter global mode as a super admin. CompHeart now scopes knowledge, tasks, AI, and management visibility by company context.
            </Typography>
            <Stack spacing={1.25}>
              {[
                "Global control center for super admins",
                "Organization-scoped admin workspaces",
                "Manager team visibility and reassignment",
                "Personalized task, AI, and notification flows for users",
              ].map((item) => (
                <Typography key={item} variant="body2" sx={{ color: "rgba(226,232,240,0.68)" }}>
                  {item}
                </Typography>
              ))}
            </Stack>
          </Box>
          <CardContent sx={{ p: { xs: 3, md: 5 } }}>
            <Stack component="form" spacing={2.2} onSubmit={handleSubmit}>
              <Typography variant="h5">Sign in</Typography>
              <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.64)" }}>
                Choose an organization context. Super admins can later switch into global or company-scoped modes.
              </Typography>
              <TextField
                select
                label="Organization"
                value={form.organization_slug}
                onChange={(event) => setForm((previous) => ({ ...previous, organization_slug: event.target.value }))}
              >
                <MenuItem value="">Auto / super admin</MenuItem>
                {orgOptions.map((organization) => (
                  <MenuItem key={organization.id} value={organization.slug}>
                    {organization.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Email"
                value={form.email}
                onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
              />
              <TextField
                label="Password"
                type="password"
                value={form.password}
                onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))}
              />
              {error ? <Typography color="error">{error}</Typography> : null}
              <Button type="submit" variant="contained" size="large">
                Enter workspace
              </Button>
              <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.58)" }}>
                Demo passwords use <strong>demo123</strong>.
              </Typography>
            </Stack>
          </CardContent>
        </Box>
      </Card>
    </Box>
  );
}

export default LoginPage;
