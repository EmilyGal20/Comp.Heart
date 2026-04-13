import { useEffect, useState } from "react";
import { Avatar, Button, Drawer, Grid, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { organizationsApi, usersApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../store/AuthContext";

const initialForm = {
  full_name: "",
  email: "",
  role: "USER",
  title: "",
  responsibilities: "",
  team_id: "",
};

function EmployeesPage() {
  const { user, activeOrganizationId } = useAuth();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(initialForm);

  const load = () => {
    const orgId = activeOrganizationId || user.organization_id;
    Promise.all([usersApi.list({ organization_id: orgId }), organizationsApi.teams(orgId)]).then(([usersResponse, teamsResponse]) => {
      setUsers(usersResponse.data);
      setTeams(teamsResponse.data);
    });
  };

  useEffect(() => {
    if (user.role === "SUPER_ADMIN" && !activeOrganizationId) {
      setUsers([]);
      setTeams([]);
      return;
    }
    if (activeOrganizationId || user.organization_id) {
      load();
    }
  }, [activeOrganizationId, user.organization_id]);

  const handleCreate = async (event) => {
    event.preventDefault();
    await usersApi.create({ ...form, team_id: form.team_id || null, organization_id: activeOrganizationId || user.organization_id });
    setForm(initialForm);
    load();
  };

  return (
    <>
      <PageHeader
        eyebrow={user.role === "MANAGER" ? "Team Directory" : "Org People Hub"}
        title={user.role === "MANAGER" ? "Team members and workload partners" : "User management and responsibilities"}
        description="Manage role assignments, teams, and ownership visibility within your allowed organization scope."
      />
      <Grid container spacing={2.5}>
        {user.role === "SUPER_ADMIN" && !activeOrganizationId ? (
          <Grid item xs={12}>
            <GlassPanel title="Select an organization" subtitle="User management is organization-scoped">
              <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.68)" }}>
                Choose an organization from the header switcher to manage users, roles, and teams.
              </Typography>
            </GlassPanel>
          </Grid>
        ) : null}
        <Grid item xs={12} lg={7}>
          <Grid container spacing={2.5}>
            {users.map((entry) => (
              <Grid item xs={12} md={6} key={entry.id}>
                <GlassPanel minHeight={220}>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar sx={{ width: 56, height: 56, bgcolor: "secondary.main" }}>
                        {entry.full_name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                      </Avatar>
                      <div>
                        <Typography variant="h6">{entry.full_name}</Typography>
                        <Typography variant="body2" sx={{ color: "rgba(226, 232, 240, 0.62)" }}>{entry.title}</Typography>
                      </div>
                    </Stack>
                    <Typography variant="body2">{entry.team?.name} team</Typography>
                    <Typography variant="body2">Role: {entry.role}</Typography>
                    <Typography variant="body2" sx={{ color: "rgba(226, 232, 240, 0.68)" }}>{entry.responsibilities}</Typography>
                    <Typography variant="body2" color="primary.main" sx={{ cursor: "pointer" }} onClick={() => setSelected(entry)}>
                      Open employee profile
                    </Typography>
                  </Stack>
                </GlassPanel>
              </Grid>
            ))}
          </Grid>
        </Grid>
        {(user.role === "SUPER_ADMIN" || user.role === "ADMIN") ? (
          <Grid item xs={12} lg={5}>
            <GlassPanel title="Add user" subtitle="Organization-scoped role assignment">
              <Stack component="form" spacing={2} onSubmit={handleCreate}>
                <TextField label="Full name" value={form.full_name} onChange={(event) => setForm((previous) => ({ ...previous, full_name: event.target.value }))} />
                <TextField label="Email" value={form.email} onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))} />
                <TextField label="Title" value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} />
                <TextField select label="Role" value={form.role} onChange={(event) => setForm((previous) => ({ ...previous, role: event.target.value }))}>
                  <MenuItem value="USER">USER</MenuItem>
                  <MenuItem value="MANAGER">MANAGER</MenuItem>
                  <MenuItem value="ADMIN">ADMIN</MenuItem>
                  {user.role === "SUPER_ADMIN" ? <MenuItem value="SUPER_ADMIN">SUPER_ADMIN</MenuItem> : null}
                </TextField>
                <TextField select label="Team" value={form.team_id} onChange={(event) => setForm((previous) => ({ ...previous, team_id: event.target.value }))}>
                  <MenuItem value="">No team</MenuItem>
                  {teams.map((team) => <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>)}
                </TextField>
                <TextField label="Responsibilities" value={form.responsibilities} onChange={(event) => setForm((previous) => ({ ...previous, responsibilities: event.target.value }))} multiline minRows={3} />
                <Button type="submit" variant="contained">Create user</Button>
              </Stack>
            </GlassPanel>
          </Grid>
        ) : null}
      </Grid>
      <Drawer anchor="right" open={Boolean(selected)} onClose={() => setSelected(null)}>
        <Stack sx={{ width: { xs: 340, md: 460 }, p: 3 }} spacing={2}>
          {selected ? (
            <>
              <Typography variant="h5">{selected.full_name}</Typography>
              <Typography variant="subtitle1">{selected.title}</Typography>
              <Typography variant="body2">Role: {selected.role}</Typography>
              <Typography variant="body2">Team: {selected.team?.name}</Typography>
              <Typography variant="body2">Organization: {selected.organization?.name}</Typography>
              <Typography variant="body1" sx={{ color: "rgba(226, 232, 240, 0.7)" }}>{selected.responsibilities}</Typography>
            </>
          ) : null}
        </Stack>
      </Drawer>
    </>
  );
}

export default EmployeesPage;
