import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import { settingsApi } from "../api/endpoints";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import PageState from "../components/PageState";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../store/AuthContext";
import { useThemeMode } from "../store/ThemeModeContext";

function SettingsPage() {
  const { user, organizations, scopedOrganization, activeOrganizationId, setScopedOrganizationId } = useAuth();
  const { themeMode, setThemeMode } = useThemeMode();
  const [profile, setProfile] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState("");

  const organizationOptions = useMemo(
    () => organizations.map((entry) => entry.organization || entry),
    [organizations]
  );

  const saveError = (requestError, fallback) => {
    setNotice("");
    setError(requestError.response?.data?.detail || fallback);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [profileResponse, workspaceResponse] = await Promise.all([
        settingsApi.profile(),
        settingsApi.workspace(),
      ]);
      setProfile(profileResponse.data);
      setWorkspace(workspaceResponse.data);
      setError("");
    } catch (requestError) {
      saveError(requestError, "Unable to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveProfile = async () => {
    if (!profile) return;
    try {
      setSavingSection("profile");
      await settingsApi.updateProfile({
        full_name: profile.full_name,
        title: profile.title,
        responsibilities: profile.responsibilities,
        notification_email: profile.notification_email,
        notification_desktop: profile.notification_desktop,
      });
      setError("");
      setNotice("Profile updated");
    } catch (requestError) {
      saveError(requestError, "Unable to save profile");
    } finally {
      setSavingSection("");
    }
  };

  const saveAppearance = async () => {
    if (!workspace) return;
    try {
      setSavingSection("appearance");
      await settingsApi.updateWorkspace({
        ...workspace,
        theme_mode: themeMode,
      });
      await setThemeMode(themeMode, false);
      setError("");
      setNotice("Appearance updated");
    } catch (requestError) {
      saveError(requestError, "Unable to save appearance");
    } finally {
      setSavingSection("");
    }
  };

  const saveNotifications = async () => {
    if (!profile) return;
    try {
      setSavingSection("notifications");
      await settingsApi.updateProfile({
        full_name: profile.full_name,
        title: profile.title,
        responsibilities: profile.responsibilities,
        notification_email: profile.notification_email,
        notification_desktop: profile.notification_desktop,
      });
      setError("");
      setNotice("Notification preferences updated");
    } catch (requestError) {
      saveError(requestError, "Unable to save notification settings");
    } finally {
      setSavingSection("");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Personal settings"
        description="A focused, professional settings space for profile details, workspace context, appearance, and notification preferences."
      />
      <PageState
        loading={loading}
        error={error}
        empty={!loading && !error && !(profile && workspace)}
        title="Settings are not available right now"
        description="Retry to load your profile and workspace preferences."
        onRetry={load}
      />
      {notice ? <Alert severity="success" sx={{ mb: 2.5 }} onClose={() => setNotice("")}>{notice}</Alert> : null}
      {profile && workspace ? (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, lg: 7 }}>
            <Stack spacing={3}>
              <GlassPanel title="Profile" subtitle="Personal details used throughout the workspace">
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Full name"
                      value={profile.full_name}
                      onChange={(event) => setProfile((previous) => ({ ...previous, full_name: event.target.value }))}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField fullWidth label="Email" value={profile.email} disabled />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Password"
                      type="password"
                      value="................"
                      disabled
                      helperText="Password changes are managed separately in this release."
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Role"
                      value={String(profile.role || user.role || "").replaceAll("_", " ")}
                      disabled
                    />
                  </Grid>
                </Grid>
                <Button sx={{ mt: 2.5 }} variant="contained" onClick={saveProfile} disabled={savingSection === "profile" || !profile.full_name.trim()}>
                  {savingSection === "profile" ? "Saving..." : "Save profile"}
                </Button>
              </GlassPanel>

              <GlassPanel title="Notifications" subtitle="Choose how CompHeart keeps you informed">
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="subtitle2">Email notifications</Typography>
                      <Typography variant="body2" color="text.secondary">Receive updates in your inbox when something important changes.</Typography>
                    </Box>
                    <Switch checked={profile.notification_email} onChange={(event) => setProfile((previous) => ({ ...previous, notification_email: event.target.checked }))} />
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="subtitle2">Desktop notifications</Typography>
                      <Typography variant="body2" color="text.secondary">See in-app alerts while working in the platform.</Typography>
                    </Box>
                    <Switch checked={profile.notification_desktop} onChange={(event) => setProfile((previous) => ({ ...previous, notification_desktop: event.target.checked }))} />
                  </Stack>
                </Stack>
                <Button sx={{ mt: 2.5 }} variant="contained" onClick={saveNotifications} disabled={savingSection === "notifications"}>
                  {savingSection === "notifications" ? "Saving..." : "Save notifications"}
                </Button>
              </GlassPanel>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, lg: 5 }}>
            <Stack spacing={3}>
              <GlassPanel title="Workspace" subtitle="Current organization context and personal scope">
                <Stack spacing={1.5}>
                  <TextField
                    fullWidth
                    label="Current organization"
                    value={scopedOrganization?.name || user.organization?.name || "Global"}
                    disabled
                  />
                  <TextField
                    fullWidth
                    label="Current role"
                    value={String(user.role || "").replaceAll("_", " ")}
                    disabled
                  />
                  {profile.team?.name ? <TextField fullWidth label="Team" value={profile.team.name} disabled /> : null}
                  {user.role === "SUPER_ADMIN" ? (
                    <TextField
                      select
                      fullWidth
                      label="Organization scope"
                      value={activeOrganizationId || ""}
                      onChange={(event) => setScopedOrganizationId(event.target.value ? Number(event.target.value) : null)}
                      helperText="Use this to switch your current company context."
                    >
                      <MenuItem value="">All organizations</MenuItem>
                      {organizationOptions.map((organization) => (
                        <MenuItem key={organization.id} value={organization.id}>
                          {organization.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  ) : null}
                </Stack>
              </GlassPanel>

              <GlassPanel title="Appearance" subtitle="Theme settings for a comfortable workspace">
                <Stack spacing={2}>
                  <TextField
                    select
                    fullWidth
                    label="Theme mode"
                    value={themeMode}
                    onChange={(event) => setThemeMode(event.target.value, false)}
                  >
                    {["light", "dark", "system"].map((value) => (
                      <MenuItem key={value} value={value}>
                        {value[0].toUpperCase() + value.slice(1)}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Typography variant="body2" color="text.secondary">
                    Your theme preference is applied immediately and persisted to your workspace settings.
                  </Typography>
                </Stack>
                <Button sx={{ mt: 2.5 }} variant="contained" onClick={saveAppearance} disabled={savingSection === "appearance"}>
                  {savingSection === "appearance" ? "Saving..." : "Save appearance"}
                </Button>
              </GlassPanel>
            </Stack>
          </Grid>
        </Grid>
      ) : null}
    </>
  );
}

export default SettingsPage;
