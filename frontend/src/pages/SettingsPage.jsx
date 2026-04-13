import { Grid, Stack, Switch, Typography } from "@mui/material";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../store/AuthContext";

function SettingsPage() {
  const { user, scopedOrganization } = useAuth();

  return (
    <>
      <PageHeader
        eyebrow="System Configuration"
        title="Settings and profile context"
        description="A clearer view of role permissions, organization profile details, and operating preferences."
      />
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6}>
          <GlassPanel title="Platform settings" subtitle="Current product capabilities">
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between"><Typography>Premium dark theme</Typography><Switch checked /></Stack>
              <Stack direction="row" justifyContent="space-between"><Typography>Automation engine enabled</Typography><Switch checked /></Stack>
              <Stack direction="row" justifyContent="space-between"><Typography>Org-aware AI assistant</Typography><Switch checked /></Stack>
            </Stack>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} md={6}>
          <GlassPanel title="Your access profile" subtitle="Permissions and org context">
            <Stack spacing={1.2}>
              <Typography variant="body2">Name: {user.full_name}</Typography>
              <Typography variant="body2">Role: {user.role}</Typography>
              <Typography variant="body2">Title: {user.title}</Typography>
              <Typography variant="body2">Organization: {scopedOrganization?.name || user.organization?.name}</Typography>
              <Typography variant="body2">Team: {user.team?.name || "No team assigned"}</Typography>
              <Typography variant="body2">Responsibilities: {user.responsibilities}</Typography>
            </Stack>
          </GlassPanel>
        </Grid>
        <Grid item xs={12}>
          <GlassPanel title="Environment info" subtitle="Runtime ports and architecture">
            <Stack spacing={1.2}>
              <Typography variant="body2">Frontend: http://localhost:8069</Typography>
              <Typography variant="body2">Backend: http://localhost:7155</Typography>
              <Typography variant="body2">Database: SQLite with multi-organization seed data</Typography>
              <Typography variant="body2">Native helper: ctypes-backed C task risk scoring with Python fallback</Typography>
            </Stack>
          </GlassPanel>
        </Grid>
      </Grid>
    </>
  );
}

export default SettingsPage;
