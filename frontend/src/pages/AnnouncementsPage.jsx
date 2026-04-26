import { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { announcementsApi, organizationsApi } from "../api/endpoints";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import { borderSubtle, brandSurfacePinned, surfaceSubtle } from "../styles/muiSurfaces";
import { useAuth } from "../store/AuthContext";
import { useRealtime } from "../store/RealtimeContext";

const emptyAnnouncement = { title: "", content: "", severity: "medium", is_pinned: false, expires_at: "", target_role: "", target_team_id: "", organization_id: "" };

function AnnouncementsPage({ importantOnly = false }) {
  const { user, activeOrganizationId, organizations } = useAuth();
  const { versions } = useRealtime();
  const [items, setItems] = useState([]);
  const [teams, setTeams] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyAnnouncement);
  const [error, setError] = useState("");
  const orgId = activeOrganizationId || user.organization_id;
  const orgOptions = organizations.map((entry) => entry.organization || entry);
  const selectedOrgId = user.role === "SUPER_ADMIN" ? Number(form.organization_id || activeOrganizationId || "") || null : orgId;

  const load = async () => {
    try {
      const [announcementResponse, teamsResponse] = await Promise.all([
        announcementsApi.list({ important_only: importantOnly, ...(user.role === "SUPER_ADMIN" && !activeOrganizationId ? {} : { organization_id: orgId }) }),
        selectedOrgId ? organizationsApi.teams(selectedOrgId) : Promise.resolve({ data: [] }),
      ]);
      setItems(announcementResponse.data);
      setTeams(teamsResponse.data);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load announcements");
    }
  };

  useEffect(() => {
    load();
  }, [importantOnly, activeOrganizationId, selectedOrgId, versions.notifications, versions.activity]);

  const save = async () => {
    if (!selectedOrgId) {
      setError("Choose an organization before publishing an announcement.");
      return;
    }
    await announcementsApi.create({
      ...form,
      organization_id: selectedOrgId,
      expires_at: form.expires_at || null,
      target_team_id: form.target_team_id || null,
      target_role: form.target_role || null,
    });
    setForm(emptyAnnouncement);
    setOpen(false);
    await load();
  };

  return (
    <>
      <PageHeader
        eyebrow={importantOnly ? "Important Messages" : "Announcements"}
        title={importantOnly ? "Important admin messages" : "Organization announcements"}
        description={importantOnly ? "A clean place for critical notices, policy updates, and high-priority operating messages." : "Publish operational updates, pinned notices, and role-targeted company communications."}
        actions={["SUPER_ADMIN", "ADMIN"].includes(user.role) ? [<Button key="new" variant="contained" onClick={() => setOpen(true)}>New announcement</Button>] : []}
      />
      {error ? <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert> : null}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <GlassPanel title={importantOnly ? "Pinned and urgent notices" : "Announcement stream"} subtitle="Read, triage, and track communications in one clear place">
            <Stack spacing={1.5}>
              {items.map((item) => (
                <Box key={item.id} sx={{ p: 1.8, borderRadius: 3.5, bgcolor: (theme) => (item.is_pinned ? brandSurfacePinned(theme) : surfaceSubtle(theme)), border: (theme) => `1px solid ${borderSubtle(theme)}` }}>
                  <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                    <Box>
                      <Typography variant="subtitle1">{item.title}</Typography>
                      <Typography variant="body2" color="text.primary" sx={{ mt: 0.8, whiteSpace: "pre-wrap" }}>{item.content}</Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {item.is_pinned ? <Chip size="small" color="secondary" label="Pinned" /> : null}
                      <Chip size="small" label={item.severity} color={item.severity === "critical" ? "error" : item.severity === "high" ? "warning" : "default"} />
                      {!item.is_read ? <Button size="small" onClick={() => announcementsApi.markRead(item.id).then(load)}>Mark read</Button> : <Chip size="small" variant="outlined" label="Read" />}
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </GlassPanel>
        </Grid>
      </Grid>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create announcement</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {user.role === "SUPER_ADMIN" ? (
              <TextField select label="Organization" value={form.organization_id || activeOrganizationId || ""} onChange={(event) => setForm((previous) => ({ ...previous, organization_id: event.target.value, target_team_id: "" }))}>
                {orgOptions.map((organization) => <MenuItem key={organization.id} value={organization.id}>{organization.name}</MenuItem>)}
              </TextField>
            ) : null}
            <TextField label="Title" value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} />
            <TextField label="Content" multiline minRows={5} value={form.content} onChange={(event) => setForm((previous) => ({ ...previous, content: event.target.value }))} />
            <TextField select label="Severity" value={form.severity} onChange={(event) => setForm((previous) => ({ ...previous, severity: event.target.value }))}>{["low", "medium", "high", "critical"].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
            <TextField select label="Target role" value={form.target_role} onChange={(event) => setForm((previous) => ({ ...previous, target_role: event.target.value }))}><MenuItem value="">Everyone</MenuItem>{["USER", "MANAGER", "ADMIN"].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
            <TextField select label="Target team" value={form.target_team_id} onChange={(event) => setForm((previous) => ({ ...previous, target_team_id: event.target.value }))}><MenuItem value="">All teams</MenuItem>{teams.map((team) => <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>)}</TextField>
            <TextField type="datetime-local" label="Expires at" InputLabelProps={{ shrink: true }} value={form.expires_at} onChange={(event) => setForm((previous) => ({ ...previous, expires_at: event.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" onClick={save} disabled={!selectedOrgId}>Publish</Button></DialogActions>
      </Dialog>
    </>
  );
}

export default AnnouncementsPage;
