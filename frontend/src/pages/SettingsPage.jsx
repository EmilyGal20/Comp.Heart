import { useEffect, useState } from "react";
import { Alert, Button, Chip, Grid, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import { integrationsApi, settingsApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../store/AuthContext";

function SettingsPage() {
  const { user, scopedOrganization } = useAuth();
  const [profile, setProfile] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [integrations, setIntegrations] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    try {
      const [profileResponse, workspaceResponse, integrationsResponse] = await Promise.all([
        settingsApi.profile(),
        settingsApi.workspace(),
        integrationsApi.summary(),
      ]);
      setProfile(profileResponse.data);
      setWorkspace(workspaceResponse.data);
      setIntegrations(integrationsResponse.data);
      if (user.role !== "USER") {
        const organizationResponse = await settingsApi.organization();
        setOrganization(organizationResponse.data);
      }
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load settings");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveProfile = async () => {
    await settingsApi.updateProfile({
      full_name: profile.full_name,
      title: profile.title,
      responsibilities: profile.responsibilities,
      notification_email: profile.notification_email,
      notification_desktop: profile.notification_desktop,
    });
    setNotice("Profile settings saved");
  };

  const saveWorkspace = async () => {
    await settingsApi.updateWorkspace(workspace);
    setNotice("Workspace settings saved");
  };

  const saveOrganization = async () => {
    await settingsApi.updateOrganization(organization);
    setNotice("Organization settings saved");
  };

  const updateIntegration = async (provider) => {
    const mapping = {
      github: integrationsApi.updateGithub,
      slack: integrationsApi.updateSlack,
      email: integrationsApi.updateEmail,
    };
    await mapping[provider](integrations[provider]);
    setNotice(`${provider[0].toUpperCase()}${provider.slice(1)} integration updated`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Workspace, profile, and integration controls"
        description="A calmer operational settings area for profile preferences, workspace density, organization defaults, and GitHub, Slack, and email connectivity."
      />
      {error ? <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert> : null}
      {notice ? <Alert severity="success" sx={{ mb: 2.5 }} onClose={() => setNotice("")}>{notice}</Alert> : null}
      {profile && workspace && integrations ? (
        <Grid container spacing={3}>
          <Grid item xs={12} xl={7}>
            <Stack spacing={3}>
              <GlassPanel title="My profile" subtitle="Personal context, role visibility, and notification preferences">
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth label="Full name" value={profile.full_name} onChange={(event) => setProfile((previous) => ({ ...previous, full_name: event.target.value }))} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth label="Email" value={profile.email} disabled />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth label="Title" value={profile.title} onChange={(event) => setProfile((previous) => ({ ...previous, title: event.target.value }))} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth label="Role" value={profile.role.replace("_", " ")} disabled />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth multiline minRows={4} label="Responsibilities" value={profile.responsibilities} onChange={(event) => setProfile((previous) => ({ ...previous, responsibilities: event.target.value }))} />
                  </Grid>
                </Grid>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 2.5 }}>
                  <Stack direction="row" alignItems="center" spacing={1}><Switch checked={profile.notification_email} onChange={(event) => setProfile((previous) => ({ ...previous, notification_email: event.target.checked }))} /><Typography>Email notifications</Typography></Stack>
                  <Stack direction="row" alignItems="center" spacing={1}><Switch checked={profile.notification_desktop} onChange={(event) => setProfile((previous) => ({ ...previous, notification_desktop: event.target.checked }))} /><Typography>Desktop notifications</Typography></Stack>
                  <Chip label={profile.organization?.name || scopedOrganization?.name || "Organization"} />
                  <Chip label={profile.team?.name || "No team"} variant="outlined" />
                </Stack>
                <Button sx={{ mt: 2.5 }} variant="contained" onClick={saveProfile}>Save profile</Button>
              </GlassPanel>

              <GlassPanel title="Workspace defaults" subtitle="Choose a calmer layout and the task surface that opens first">
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField select fullWidth label="Default task view" value={workspace.default_task_view} onChange={(event) => setWorkspace((previous) => ({ ...previous, default_task_view: event.target.value }))}>
                      {["list", "board", "calendar", "timeline"].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField select fullWidth label="Density" value={workspace.density} onChange={(event) => setWorkspace((previous) => ({ ...previous, density: event.target.value }))}>
                      {["comfortable", "compact"].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField select fullWidth label="Theme mode" value={workspace.theme_mode} onChange={(event) => setWorkspace((previous) => ({ ...previous, theme_mode: event.target.value }))}>
                      {["dark"].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                    </TextField>
                  </Grid>
                </Grid>
                <Button sx={{ mt: 2.5 }} variant="contained" onClick={saveWorkspace}>Save workspace</Button>
              </GlassPanel>

              {organization ? (
                <GlassPanel title="Organization operations" subtitle="Defaults for approvals, recurring execution, notifications, and baseline SLA posture">
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <TextField type="number" fullWidth label="Default SLA hours" value={organization.default_sla_hours} onChange={(event) => setOrganization((previous) => ({ ...previous, default_sla_hours: Number(event.target.value) }))} />
                    </Grid>
                    <Grid item xs={12} md={8}>
                      <Stack spacing={1.25} sx={{ pt: 1 }}>
                        <Stack direction="row" justifyContent="space-between"><Typography>Require approval for critical work</Typography><Switch checked={organization.require_approval_for_critical} onChange={(event) => setOrganization((previous) => ({ ...previous, require_approval_for_critical: event.target.checked }))} /></Stack>
                        <Stack direction="row" justifyContent="space-between"><Typography>Auto-run recurring work scheduler</Typography><Switch checked={organization.recurring_auto_run} onChange={(event) => setOrganization((previous) => ({ ...previous, recurring_auto_run: event.target.checked }))} /></Stack>
                        <Stack direction="row" justifyContent="space-between"><Typography>Slack notification routing</Typography><Switch checked={organization.slack_notifications_enabled} onChange={(event) => setOrganization((previous) => ({ ...previous, slack_notifications_enabled: event.target.checked }))} /></Stack>
                        <Stack direction="row" justifyContent="space-between"><Typography>Email notification routing</Typography><Switch checked={organization.email_notifications_enabled} onChange={(event) => setOrganization((previous) => ({ ...previous, email_notifications_enabled: event.target.checked }))} /></Stack>
                      </Stack>
                    </Grid>
                  </Grid>
                  <Button sx={{ mt: 2.5 }} variant="contained" onClick={saveOrganization}>Save organization settings</Button>
                </GlassPanel>
              ) : null}
            </Stack>
          </Grid>
          <Grid item xs={12} xl={5}>
            <Stack spacing={3}>
              {["github", "slack", "email"].map((provider) => (
                <GlassPanel
                  key={provider}
                  title={`${provider[0].toUpperCase()}${provider.slice(1)} integration`}
                  subtitle={
                    provider === "github"
                      ? "Repository connection metadata, deployment references, and external task links."
                      : provider === "slack"
                        ? "Channel routing, broadcast preferences, and alert fan-out."
                        : "Internal delivery mode, sender identity, and compose behavior."
                  }
                >
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography>Enabled</Typography>
                      <Switch checked={integrations[provider].is_enabled} onChange={(event) => setIntegrations((previous) => ({ ...previous, [provider]: { ...previous[provider], is_enabled: event.target.checked } }))} />
                    </Stack>
                    <TextField
                      fullWidth
                      multiline
                      minRows={provider === "email" ? 3 : 4}
                      label={provider === "github" ? "Configuration (repo, owner, webhook shell)" : provider === "slack" ? "Configuration (workspace, channel map, routing)" : "Configuration (sender, reply-to, mode)"}
                      value={JSON.stringify(integrations[provider].config || {}, null, 2)}
                      onChange={(event) => {
                        try {
                          const parsed = JSON.parse(event.target.value);
                          setIntegrations((previous) => ({ ...previous, [provider]: { ...previous[provider], config: parsed } }));
                        } catch {
                          setIntegrations((previous) => ({ ...previous, [provider]: { ...previous[provider], config_text: event.target.value } }));
                        }
                      }}
                    />
                    <Button variant="outlined" onClick={() => updateIntegration(provider)}>Save {provider}</Button>
                  </Stack>
                </GlassPanel>
              ))}
              <GlassPanel title="Runtime context" subtitle="Stable environment alignment for this workspace">
                <Stack spacing={1.2}>
                  <Typography variant="body2">Frontend: http://localhost:8069</Typography>
                  <Typography variant="body2">Backend: http://localhost:7155</Typography>
                  <Typography variant="body2">Organization context: {scopedOrganization?.name || user.organization?.name || "Global"}</Typography>
                  <Typography variant="body2">Current role: {user.role}</Typography>
                </Stack>
              </GlassPanel>
            </Stack>
          </Grid>
        </Grid>
      ) : null}
    </>
  );
}

export default SettingsPage;
