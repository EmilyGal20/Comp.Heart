import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Grid,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { organizationsApi, usersApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../store/AuthContext";
import { useRealtime } from "../store/RealtimeContext";

const initialForm = {
  full_name: "",
  email: "",
  role: "USER",
  title: "",
  responsibilities: "",
  team_id: "",
  is_active: true,
};

function EmployeesPage() {
  const { user, activeOrganizationId } = useAuth();
  const { versions } = useRealtime();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [filters, setFilters] = useState({ role: "", search: "", team_id: "" });
  const [error, setError] = useState("");

  const currentOrgId = activeOrganizationId || user.organization_id;
  const roleOptions = useMemo(() => {
    if (user.role === "SUPER_ADMIN") return ["USER", "MANAGER", "ADMIN", "SUPER_ADMIN"];
    if (user.role === "ADMIN") return ["USER", "MANAGER", "ADMIN"];
    if (user.role === "MANAGER") return ["USER"];
    return ["USER"];
  }, [user.role]);

  const load = async () => {
    if (user.role === "SUPER_ADMIN" && !activeOrganizationId) {
      setUsers([]);
      setTeams([]);
      return;
    }
    const [usersResponse, teamsResponse] = await Promise.all([
      usersApi.list({
        organization_id: currentOrgId,
        role: filters.role || undefined,
        team_id: filters.team_id || undefined,
      }),
      organizationsApi.teams(currentOrgId),
    ]);
    const filteredUsers = usersResponse.data.filter((entry) => {
      if (!filters.search) return true;
      const haystack = `${entry.full_name} ${entry.email} ${entry.title}`.toLowerCase();
      return haystack.includes(filters.search.toLowerCase());
    });
    setUsers(filteredUsers);
    setTeams(teamsResponse.data);
  };

  useEffect(() => {
    load();
  }, [activeOrganizationId, currentOrgId, filters.role, filters.search, filters.team_id, versions.users]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(initialForm);
    setDialogOpen(true);
  };

  const openEdit = (entry) => {
    setEditingUser(entry);
    setForm({
      full_name: entry.full_name,
      email: entry.email,
      role: entry.role,
      title: entry.title,
      responsibilities: entry.responsibilities,
      team_id: entry.team?.id || "",
      is_active: entry.is_active,
    });
    setDialogOpen(true);
  };

  const submit = async () => {
    try {
      setError("");
      const payload = {
        ...form,
        team_id: form.team_id || null,
        organization_id: currentOrgId,
      };
      if (editingUser) {
        await usersApi.update(editingUser.id, payload);
      } else {
        await usersApi.create(payload);
      }
      setDialogOpen(false);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to save user");
    }
  };

  const toggleStatus = async (entry) => {
    await usersApi.updateStatus(entry.id, { is_active: !entry.is_active });
    await load();
  };

  const canManage = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(user.role);

  return (
    <>
      <PageHeader
        eyebrow={user.role === "SUPER_ADMIN" ? "Global People Directory" : "Organization People"}
        title={user.role === "USER" ? "Profile directory" : "People, roles, and organization ownership"}
        description="Browse, create, edit, and activate users within your allowed scope with cleaner filters, profile detail, and organization context."
        actions={canManage ? [<Button key="create" variant="contained" onClick={openCreate}>Add user</Button>] : []}
      />
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      <Grid container spacing={2.5}>
        {user.role === "SUPER_ADMIN" && !activeOrganizationId ? (
          <Grid item xs={12}>
            <GlassPanel title="Choose an organization" subtitle="User management remains organization-scoped even for super admins">
              <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.68)" }}>
                Select an organization from the header switcher to create users, adjust roles, and manage team placement.
              </Typography>
            </GlassPanel>
          </Grid>
        ) : (
          <>
            <Grid item xs={12}>
              <GlassPanel
                title="People directory"
                subtitle={`${users.length} people in your current scope`}
                action={
                  <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
                    <TextField size="small" label="Search" value={filters.search} onChange={(event) => setFilters((previous) => ({ ...previous, search: event.target.value }))} />
                    <TextField select size="small" label="Role" value={filters.role} onChange={(event) => setFilters((previous) => ({ ...previous, role: event.target.value }))} sx={{ minWidth: 140 }}>
                      <MenuItem value="">All</MenuItem>
                      {roleOptions.map((role) => <MenuItem key={role} value={role}>{role}</MenuItem>)}
                    </TextField>
                    <TextField select size="small" label="Team" value={filters.team_id} onChange={(event) => setFilters((previous) => ({ ...previous, team_id: event.target.value }))} sx={{ minWidth: 140 }}>
                      <MenuItem value="">All</MenuItem>
                      {teams.map((team) => <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>)}
                    </TextField>
                  </Stack>
                }
              >
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Team</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Org</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((entry) => (
                      <TableRow key={entry.id} hover onClick={() => setSelected(entry)} sx={{ cursor: "pointer" }}>
                        <TableCell>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar sx={{ bgcolor: "secondary.main" }}>
                              {entry.full_name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                            </Avatar>
                            <div>
                              <Typography variant="subtitle2">{entry.full_name}</Typography>
                              <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.62)" }}>{entry.email}</Typography>
                            </div>
                          </Stack>
                        </TableCell>
                        <TableCell><Chip size="small" label={entry.role} color={entry.role === "ADMIN" || entry.role === "SUPER_ADMIN" ? "secondary" : "primary"} /></TableCell>
                        <TableCell>{entry.team?.name || "Unassigned"}</TableCell>
                        <TableCell><Chip size="small" label={entry.is_active ? "Active" : "Inactive"} color={entry.is_active ? "success" : "default"} /></TableCell>
                        <TableCell>{entry.organization?.name}</TableCell>
                        <TableCell align="right">
                          {canManage ? <Button size="small" onClick={(event) => { event.stopPropagation(); openEdit(entry); }}>Edit</Button> : null}
                          {canManage ? <Button size="small" color={entry.is_active ? "warning" : "success"} onClick={(event) => { event.stopPropagation(); toggleStatus(entry); }}>{entry.is_active ? "Deactivate" : "Activate"}</Button> : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </GlassPanel>
            </Grid>
          </>
        )}
      </Grid>
      <Drawer anchor="right" open={Boolean(selected)} onClose={() => setSelected(null)}>
        <Stack sx={{ width: { xs: 340, md: 460 }, p: 3 }} spacing={2}>
          {selected ? (
            <>
              <Typography variant="h5">{selected.full_name}</Typography>
              <Typography variant="subtitle1">{selected.title}</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={selected.role} color="secondary" />
                <Chip size="small" label={selected.is_active ? "Active" : "Inactive"} color={selected.is_active ? "success" : "default"} />
              </Stack>
              <Typography variant="body2">Email: {selected.email}</Typography>
              <Typography variant="body2">Team: {selected.team?.name || "No team assigned"}</Typography>
              <Typography variant="body2">Organization: {selected.organization?.name}</Typography>
              <Typography variant="body1" sx={{ color: "rgba(226, 232, 240, 0.7)" }}>{selected.responsibilities}</Typography>
            </>
          ) : null}
        </Stack>
      </Drawer>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingUser ? "Edit user" : "Create user"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Full name" value={form.full_name} onChange={(event) => setForm((previous) => ({ ...previous, full_name: event.target.value }))} />
            <TextField label="Email" value={form.email} onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))} />
            <TextField label="Title" value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} />
            <TextField select label="Role" value={form.role} onChange={(event) => setForm((previous) => ({ ...previous, role: event.target.value }))}>
              {roleOptions.map((role) => <MenuItem key={role} value={role}>{role}</MenuItem>)}
            </TextField>
            <TextField select label="Team" value={form.team_id} onChange={(event) => setForm((previous) => ({ ...previous, team_id: event.target.value }))}>
              <MenuItem value="">No team</MenuItem>
              {teams.map((team) => <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>)}
            </TextField>
            <TextField label="Responsibilities" value={form.responsibilities} onChange={(event) => setForm((previous) => ({ ...previous, responsibilities: event.target.value }))} multiline minRows={3} />
            <TextField select label="Status" value={String(form.is_active)} onChange={(event) => setForm((previous) => ({ ...previous, is_active: event.target.value === "true" }))}>
              <MenuItem value="true">Active</MenuItem>
              <MenuItem value="false">Inactive</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={submit} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default EmployeesPage;
