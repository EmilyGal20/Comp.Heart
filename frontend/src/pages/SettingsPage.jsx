import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import { useNavigate } from "react-router-dom";
import { adminApi, settingsApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import PageState from "../components/PageState";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../store/AuthContext";
import { useThemeMode } from "../store/ThemeModeContext";

function SettingsPage() {
  const navigate = useNavigate();
  const { user, organizations, scopedOrganization, activeOrganizationId, setScopedOrganizationId } = useAuth();
  const { themeMode, setThemeMode } = useThemeMode();
  const [profile, setProfile] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [orgSettings, setOrgSettings] = useState(null);
  const [platformSummary, setPlatformSummary] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState("");
  const [password, setPassword] = useState({ current: "", next: "", confirm: "" });
  const [savingPassword, setSavingPassword] = useState(false);

  const organizationOptions = useMemo(
    () => organizations.map((entry) => entry.organization || entry),
    [organizations]
  );

  const isSuper = user?.role === "SUPER_ADMIN";
  const isAdmin = user?.role === "ADMIN" || isSuper;
  // Super admin: org defaults only when a company is selected in the header (avoids editing the wrong org).
  const orgSettingsOrgId = isSuper ? (activeOrganizationId || null) : user?.organization_id;
  const canLoadOrgSettings = isAdmin && Boolean(isSuper ? activeOrganizationId : user?.organization_id);

  const saveError = (requestError, fallback) => {
    setNotice("");
    setError(requestError?.response?.data?.detail || fallback);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profileResponse, workspaceResponse] = await Promise.all([
        settingsApi.profile(),
        settingsApi.workspace(),
      ]);
      setProfile(profileResponse.data);
      setWorkspace(workspaceResponse.data);
      if (isSuper) {
        try {
          const summaryRes = await adminApi.globalSummary(
            activeOrganizationId ? { organization_id: activeOrganizationId } : {}
          );
          setPlatformSummary(summaryRes.data);
        } catch {
          setPlatformSummary(null);
        }
      } else {
        setPlatformSummary(null);
      }
      if (canLoadOrgSettings) {
        const orgRes = await settingsApi.organization(
          isSuper && activeOrganizationId
            ? { organization_id: activeOrganizationId }
            : {}
        );
        setOrgSettings(orgRes.data);
      } else {
        setOrgSettings(null);
      }
      setError("");
    } catch (requestError) {
      saveError(requestError, "Unable to load settings");
    } finally {
      setLoading(false);
    }
  }, [isSuper, canLoadOrgSettings, activeOrganizationId, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

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

  const savePassword = async () => {
    if (!password.next || password.next.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }
    if (password.next !== password.confirm) {
      setError("New password and confirmation do not match");
      return;
    }
    try {
      setSavingPassword(true);
      setError("");
      await settingsApi.changePassword({
        current_password: password.current,
        new_password: password.next,
      });
      setPassword({ current: "", next: "", confirm: "" });
      setNotice("Password updated");
    } catch (requestError) {
      saveError(requestError, "Unable to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const saveAppearance = async () => {
    if (!workspace) return;
    try {
      setSavingSection("appearance");
      await settingsApi.updateWorkspace({
        default_task_view: workspace.default_task_view,
        density: workspace.density,
        theme_mode: themeMode,
      });
      await setThemeMode(themeMode, false);
      setError("");
      setNotice("Appearance and workspace options updated");
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

  const saveOrgDefaults = async () => {
    if (!orgSettings) return;
    if (!orgSettingsOrgId) return;
    try {
      setSavingSection("org");
      await settingsApi.updateOrganization(
        {
          default_sla_hours: orgSettings.default_sla_hours,
          require_approval_for_critical: orgSettings.require_approval_for_critical,
          recurring_auto_run: orgSettings.recurring_auto_run,
          slack_notifications_enabled: orgSettings.slack_notifications_enabled,
          email_notifications_enabled: orgSettings.email_notifications_enabled,
        },
        isSuper && activeOrganizationId ? { organization_id: activeOrganizationId } : {}
      );
      setError("");
      setNotice("Organization defaults updated");
    } catch (requestError) {
      saveError(requestError, "Unable to save organization settings");
    } finally {
      setSavingSection("");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title={isSuper && !activeOrganizationId ? "Global administrator" : "Personal & workspace settings"}
        description={
          isSuper
            ? "Control platform scope, organization defaults, your profile, and where you land in the product."
            : "A focused, professional space for your profile, workspace, appearance, and notification preferences."
        }
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
        <Stack spacing={3}>
          {isSuper ? (
            <GlassPanel
              title="Administration shortcuts"
              subtitle="Jump to high-leverage areas for this demo"
            >
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
                {[
                  { label: "Control center", path: "/control-center" },
                  { label: "Organizations", path: "/organizations" },
                  { label: "People & roles", path: "/employees" },
                  { label: "Global search", path: "/search" },
                  { label: "Approvals", path: "/approvals" },
                  { label: "Automation", path: "/automation" },
                  { label: "Onboarding", path: "/onboarding" },
                ].map((item) => (
                  <Button key={item.path} size="small" variant="outlined" onClick={() => navigate(item.path)}>
                    {item.label}
                  </Button>
                ))}
              </Stack>
            </GlassPanel>
          ) : null}

          {isSuper && platformSummary ? (
            <GlassPanel title="Platform snapshot" subtitle={platformSummary.scope_label || "Live counts"}>
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1.5} sx={{ mb: 1 }}>
                <Chip label={`${platformSummary.total_users} users`} size="small" color="primary" />
                <Chip label={`${platformSummary.total_tasks} tasks`} size="small" />
                <Chip label={`${platformSummary.open_tasks} open`} size="small" color="info" />
                <Chip label={`${platformSummary.overdue_tasks} overdue`} size="small" color={platformSummary.overdue_tasks ? "error" : "default"} />
                <Chip label={`${platformSummary.unread_notifications} unread`} size="small" />
                <Chip label={`${platformSummary.active_automation_rules} automations`} size="small" variant="outlined" />
              </Stack>
              {platformSummary.focus_items?.length ? (
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase" }}>
                    Focus
                  </Typography>
                  {platformSummary.focus_items.map((row, i) => (
                    <Typography key={i} variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                      {row.title} · {row.priority} · {row.sla_status}
                    </Typography>
                  ))}
                </Box>
              ) : null}
            </GlassPanel>
          ) : null}

          {isAdmin && !orgSettingsOrgId && isSuper ? (
            <Alert severity="info">Select an organization in the top bar to edit that company&apos;s default SLA, approvals, and notification policies.</Alert>
          ) : null}
          {canLoadOrgSettings && orgSettings ? (
            <GlassPanel
              title="Organization defaults"
              subtitle={`${scopedOrganization?.name || user?.organization?.name || "This organization"}`}
            >
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <TextField
                    type="number"
                    fullWidth
                    label="Default SLA (hours)"
                    value={orgSettings.default_sla_hours}
                    onChange={(event) => setOrgSettings((p) => ({ ...p, default_sla_hours: Number(event.target.value) }))}
                    inputProps={{ min: 1, max: 720 }}
                  />
                </Grid>
                <Grid size={12}>
                  <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} alignItems="center">
                    <FormSwitch
                      label="Require approval for critical"
                      value={orgSettings.require_approval_for_critical}
                      onChange={(v) => setOrgSettings((p) => ({ ...p, require_approval_for_critical: v }))}
                    />
                    <FormSwitch
                      label="Recurring auto-run"
                      value={orgSettings.recurring_auto_run}
                      onChange={(v) => setOrgSettings((p) => ({ ...p, recurring_auto_run: v }))}
                    />
                    <FormSwitch
                      label="Slack notifications (shell)"
                      value={orgSettings.slack_notifications_enabled}
                      onChange={(v) => setOrgSettings((p) => ({ ...p, slack_notifications_enabled: v }))}
                    />
                    <FormSwitch
                      label="Email notifications (shell)"
                      value={orgSettings.email_notifications_enabled}
                      onChange={(v) => setOrgSettings((p) => ({ ...p, email_notifications_enabled: v }))}
                    />
                  </Stack>
                </Grid>
              </Grid>
              <Button sx={{ mt: 2 }} variant="contained" onClick={saveOrgDefaults} disabled={savingSection === "org"}>
                {savingSection === "org" ? "Saving…" : "Save organization defaults"}
              </Button>
            </GlassPanel>
          ) : null}

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, lg: 7 }}>
              <Stack spacing={3}>
                <GlassPanel title="Profile" subtitle="Your details in CompHeart">
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
                        label="Title"
                        value={profile.title}
                        onChange={(event) => setProfile((p) => ({ ...p, title: event.target.value }))}
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
                  <Button sx={{ mt: 2.5 }} variant="contained" onClick={saveProfile} disabled={savingSection === "profile" || !profile.full_name?.trim()}>
                    {savingSection === "profile" ? "Saving…" : "Save profile"}
                  </Button>
                </GlassPanel>

                <GlassPanel
                  title="Change password"
                  subtitle="For your own account, enter your current password and a new one (at least 6 characters)"
                >
                  <Grid container spacing={2}>
                    <Grid size={12}>
                      <TextField
                        fullWidth
                        type="password"
                        autoComplete="current-password"
                        label="Current password"
                        value={password.current}
                        onChange={(e) => setPassword((p) => ({ ...p, current: e.target.value }))}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        type="password"
                        autoComplete="new-password"
                        label="New password"
                        value={password.next}
                        onChange={(e) => setPassword((p) => ({ ...p, next: e.target.value }))}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        type="password"
                        autoComplete="new-password"
                        label="Confirm new password"
                        value={password.confirm}
                        onChange={(e) => setPassword((p) => ({ ...p, confirm: e.target.value }))}
                      />
                    </Grid>
                  </Grid>
                  <Button sx={{ mt: 2.5 }} variant="contained" onClick={savePassword} disabled={savingPassword || !password.current || !password.next}>
                    {savingPassword ? "Updating…" : "Update password"}
                  </Button>
                </GlassPanel>

                <GlassPanel title="Notifications" subtitle="How CompHeart reaches you">
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="subtitle2">Email</Typography>
                        <Typography variant="body2" color="text.secondary">Inbox for important org updates</Typography>
                      </Box>
                      <Switch
                        checked={Boolean(profile.notification_email)}
                        onChange={(event) => setProfile((previous) => ({ ...previous, notification_email: event.target.checked }))}
                      />
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="subtitle2">Desktop / in-app</Typography>
                        <Typography variant="body2" color="text.secondary">In-product alerts and badge refreshes</Typography>
                      </Box>
                      <Switch
                        checked={Boolean(profile.notification_desktop)}
                        onChange={(event) => setProfile((previous) => ({ ...previous, notification_desktop: event.target.checked }))}
                      />
                    </Stack>
                  </Stack>
                  <Button sx={{ mt: 2.5 }} variant="contained" onClick={saveNotifications} disabled={savingSection === "notifications"}>
                    {savingSection === "notifications" ? "Saving…" : "Save notifications"}
                  </Button>
                </GlassPanel>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, lg: 5 }}>
              <Stack spacing={3}>
                <GlassPanel title="Workspace" subtitle="Org context, teams, and layout">
                  <Stack spacing={1.5}>
                    <TextField
                      fullWidth
                      label="Current organization"
                      value={scopedOrganization?.name || user.organization?.name || (isSuper && !activeOrganizationId ? "Global" : "—")}
                      disabled
                    />
                    <TextField fullWidth label="Responsibilities" value={profile.responsibilities} multiline minRows={2} onChange={(e) => setProfile((p) => ({ ...p, responsibilities: e.target.value }))} />
                    {profile.team?.name ? <TextField fullWidth label="Team" value={profile.team.name} disabled /> : null}
                    {isSuper ? (
                      <TextField
                        select
                        fullWidth
                        label="Header organization scope"
                        value={activeOrganizationId || ""}
                        onChange={(event) => setScopedOrganizationId(event.target.value ? Number(event.target.value) : null)}
                        helperText="Filters platform data, org defaults, and AI scope"
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

                <GlassPanel title="Task workspace defaults" subtitle="Your preferred task list behavior">
                  <TextField
                    select
                    fullWidth
                    label="Default view"
                    value={workspace?.default_task_view || "list"}
                    onChange={(e) => setWorkspace((p) => ({ ...p, default_task_view: e.target.value }))}
                  >
                    {["list", "board", "calendar", "timeline"].map((v) => (
                      <MenuItem key={v} value={v}>
                        {v[0].toUpperCase() + v.slice(1)}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    fullWidth
                    label="List density"
                    value={workspace?.density || "comfortable"}
                    sx={{ mt: 1.5 }}
                    onChange={(e) => setWorkspace((p) => ({ ...p, density: e.target.value }))}
                  >
                    {["comfortable", "compact"].map((v) => (
                      <MenuItem key={v} value={v}>
                        {v[0].toUpperCase() + v.slice(1)}
                      </MenuItem>
                    ))}
                  </TextField>
                </GlassPanel>

                <GlassPanel title="Appearance" subtitle="Theme and sync to workspace">
                  <TextField
                    select
                    fullWidth
                    label="Theme"
                    value={themeMode}
                    onChange={(event) => setThemeMode(event.target.value, false)}
                  >
                    {["light", "dark", "system"].map((value) => (
                      <MenuItem key={value} value={value}>
                        {value[0].toUpperCase() + value.slice(1)}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button sx={{ mt: 2.5 }} variant="contained" onClick={saveAppearance} disabled={savingSection === "appearance"}>
                    {savingSection === "appearance" ? "Saving…" : "Save appearance & workspace options"}
                  </Button>
                </GlassPanel>
              </Stack>
            </Grid>
          </Grid>
        </Stack>
      ) : null}
    </>
  );
}

function FormSwitch({ label, value, onChange }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <Switch size="small" checked={value} onChange={(_, c) => onChange(c)} />
      <Typography variant="body2">{label}</Typography>
    </Stack>
  );
}

export default SettingsPage;
