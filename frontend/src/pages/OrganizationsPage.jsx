import { useEffect, useState } from "react";
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { organizationsApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import { useRealtime } from "../store/RealtimeContext";

const emptyForm = {
  name: "",
  slug: "",
  company_type: "",
  industry: "",
  description: "",
};

function OrganizationsPage() {
  const { versions } = useRealtime();
  const [organizations, setOrganizations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const response = await organizationsApi.list();
    setOrganizations(response.data);
  };

  useEffect(() => {
    load();
  }, [versions.organizations, versions.activity]);

  const openCreate = () => {
    setSelected(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (entry) => {
    setSelected(entry.organization);
    setForm({
      name: entry.organization.name,
      slug: entry.organization.slug,
      company_type: entry.organization.company_type,
      industry: entry.organization.industry,
      description: entry.organization.description || "",
    });
    setOpen(true);
  };

  const save = async () => {
    try {
      setError("");
      if (selected) {
        await organizationsApi.update(selected.id, form);
      } else {
        await organizationsApi.create({ ...form, is_active: true });
      }
      setOpen(false);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to save organization");
    }
  };

  const toggleStatus = async (entry) => {
    await organizationsApi.updateStatus(entry.organization.id, { is_active: !entry.organization.is_active });
    await load();
  };

  const totals = organizations.reduce((accumulator, entry) => ({
    users: accumulator.users + entry.user_count,
    tasks: accumulator.tasks + entry.task_count,
    overdue: accumulator.overdue + entry.overdue_tasks,
  }), { users: 0, tasks: 0, overdue: 0 });

  return (
    <>
      <PageHeader
        eyebrow="Organizations"
        title="Platform organization management"
        description="Create, rename, activate, and inspect organizations with premium global visibility into company health and activity."
        actions={[<Button key="create" variant="contained" onClick={openCreate}>Create organization</Button>]}
      />
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={4}><MetricCard label="Organizations" value={organizations.length} helper="Tenant workspaces" accent="rgba(155,124,255,0.25)" /></Grid>
        <Grid item xs={12} md={4}><MetricCard label="Users" value={totals.users} helper="People across all orgs" accent="rgba(61,200,255,0.25)" /></Grid>
        <Grid item xs={12} md={4}><MetricCard label="Overdue tasks" value={totals.overdue} helper="Cross-org risk pressure" accent="rgba(255,107,122,0.23)" /></Grid>
        {organizations.map((entry) => (
          <Grid item xs={12} lg={6} key={entry.organization.id}>
            <GlassPanel
              title={entry.organization.name}
              subtitle={`${entry.organization.company_type} • ${entry.organization.industry}`}
              action={<Chip label={entry.organization.is_active ? "Active" : "Inactive"} color={entry.organization.is_active ? "success" : "default"} />}
            >
              <Stack spacing={1.2}>
                <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.66)" }}>{entry.organization.description}</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={`Slug ${entry.organization.slug}`} variant="outlined" />
                  <Chip size="small" label={`${entry.user_count} users`} />
                  <Chip size="small" label={`${entry.team_count} teams`} />
                  <Chip size="small" label={`${entry.task_count} tasks`} />
                  <Chip size="small" label={`${entry.overdue_tasks} overdue`} color={entry.overdue_tasks ? "error" : "default"} />
                </Stack>
                <Typography variant="caption" sx={{ color: "rgba(226,232,240,0.5)" }}>
                  Latest activity: {entry.latest_activity}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" onClick={() => openEdit(entry)}>Edit</Button>
                  <Button variant="text" color={entry.organization.is_active ? "warning" : "success"} onClick={() => toggleStatus(entry)}>
                    {entry.organization.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </Stack>
              </Stack>
            </GlassPanel>
          </Grid>
        ))}
      </Grid>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{selected ? "Edit organization" : "Create organization"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} />
            <TextField label="Slug" value={form.slug} onChange={(event) => setForm((previous) => ({ ...previous, slug: event.target.value }))} />
            <TextField label="Company type" value={form.company_type} onChange={(event) => setForm((previous) => ({ ...previous, company_type: event.target.value }))} />
            <TextField label="Industry" value={form.industry} onChange={(event) => setForm((previous) => ({ ...previous, industry: event.target.value }))} />
            <TextField label="Description" multiline minRows={4} value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default OrganizationsPage;
