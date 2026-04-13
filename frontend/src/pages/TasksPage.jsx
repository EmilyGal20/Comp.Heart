import { useEffect, useState } from "react";
import { Box, Button, CircularProgress, Drawer, Grid, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import dayjs from "dayjs";
import { tasksApi, usersApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";
import { useAuth } from "../store/AuthContext";

function TasksPage() {
  const { user, activeOrganizationId } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ status: "", priority: "", sla_status: "", assignee_id: "" });

  useEffect(() => {
    const params = {
      ...filters,
      organization_id: activeOrganizationId || undefined,
      assignee_id: filters.assignee_id || undefined,
    };
    const request = tasksApi.list(params);
    Promise.all([request, usersApi.list({ organization_id: activeOrganizationId || undefined })]).then(([taskResponse, userResponse]) => {
      setTasks(taskResponse.data);
      setUsers(userResponse.data);
    });
  }, [activeOrganizationId, filters]);

  const markDone = async () => {
    if (!selected) return;
    await tasksApi.updateStatus(selected.id, "done");
    const refreshed = await tasksApi.detail(selected.id);
    setSelected(refreshed.data);
    const listResponse = await tasksApi.list({ ...filters, organization_id: activeOrganizationId || undefined });
    setTasks(listResponse.data);
  };

  return (
    <>
      <PageHeader
        eyebrow={user.role === "USER" ? "My Tasks" : "Execution Layer"}
        title={user.role === "USER" ? "Personal work queue" : "Tasks, urgency, and workload control"}
        description={user.role === "USER"
          ? "See your assignments, overdue warnings, upcoming due dates, and linked process context."
          : "Filter operational work by status, priority, SLA posture, and assignee across your allowed scope."}
      />
      <GlassPanel
        title="Task workspace"
        subtitle={`${tasks.length} tasks visible in your current scope`}
        action={
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
            <TextField select size="small" label="Status" value={filters.status} onChange={(event) => setFilters((previous) => ({ ...previous, status: event.target.value }))} sx={{ minWidth: 130 }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="todo">Todo</MenuItem>
              <MenuItem value="in_progress">In progress</MenuItem>
              <MenuItem value="review">Review</MenuItem>
              <MenuItem value="done">Done</MenuItem>
            </TextField>
            <TextField select size="small" label="Priority" value={filters.priority} onChange={(event) => setFilters((previous) => ({ ...previous, priority: event.target.value }))} sx={{ minWidth: 130 }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
            </TextField>
            <TextField select size="small" label="SLA" value={filters.sla_status} onChange={(event) => setFilters((previous) => ({ ...previous, sla_status: event.target.value }))} sx={{ minWidth: 130 }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="on_track">On track</MenuItem>
              <MenuItem value="warning">Warning</MenuItem>
              <MenuItem value="breached">Breached</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
            </TextField>
            {(user.role === "SUPER_ADMIN" || user.role === "ADMIN" || user.role === "MANAGER") ? (
              <TextField select size="small" label="Assignee" value={filters.assignee_id} onChange={(event) => setFilters((previous) => ({ ...previous, assignee_id: event.target.value }))} sx={{ minWidth: 170 }}>
                <MenuItem value="">All</MenuItem>
                {users.map((assignee) => <MenuItem key={assignee.id} value={assignee.id}>{assignee.full_name}</MenuItem>)}
              </TextField>
            ) : null}
          </Stack>
        }
      >
        {!tasks.length ? <CircularProgress /> : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Task</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Assignee</TableCell>
                <TableCell>Due</TableCell>
                <TableCell>SLA</TableCell>
                <TableCell>Risk</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id} hover onClick={() => setSelected(task)} sx={{ cursor: "pointer" }}>
                  <TableCell>
                    <Typography variant="subtitle2">{task.title}</Typography>
                    <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.56)" }}>{task.description.slice(0, 84)}...</Typography>
                  </TableCell>
                  <TableCell><StatusPill value={task.status} /></TableCell>
                  <TableCell><StatusPill value={task.priority} /></TableCell>
                  <TableCell>{task.assignee?.full_name || "Unassigned"}</TableCell>
                  <TableCell>{task.due_at ? dayjs(task.due_at).format("MMM D, HH:mm") : "TBD"}</TableCell>
                  <TableCell><StatusPill value={task.sla_status} /></TableCell>
                  <TableCell>{task.risk_score}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </GlassPanel>
      <Drawer anchor="right" open={Boolean(selected)} onClose={() => setSelected(null)}>
        <Box sx={{ width: { xs: 340, md: 500 }, p: 3 }}>
          {selected ? (
            <Stack spacing={2}>
              <Typography variant="h5">{selected.title}</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <StatusPill value={selected.status} />
                <StatusPill value={selected.priority} />
                <StatusPill value={selected.sla_status} />
              </Stack>
              <Typography variant="body1" sx={{ color: "rgba(226,232,240,0.74)" }}>{selected.description}</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}><Typography variant="body2">Assignee</Typography><Typography>{selected.assignee?.full_name || "Unassigned"}</Typography></Grid>
                <Grid item xs={6}><Typography variant="body2">Risk score</Typography><Typography>{selected.risk_score}</Typography></Grid>
                <Grid item xs={6}><Typography variant="body2">Due date</Typography><Typography>{selected.due_at ? dayjs(selected.due_at).format("MMM D, HH:mm") : "TBD"}</Typography></Grid>
                <Grid item xs={6}><Typography variant="body2">Linked knowledge</Typography><Typography>{selected.related_knowledge?.title || "None linked"}</Typography></Grid>
              </Grid>
              {selected.assignee?.id === user.id || ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(user.role) ? (
                <Button variant="contained" onClick={markDone}>Mark as done</Button>
              ) : null}
            </Stack>
          ) : null}
        </Box>
      </Drawer>
    </>
  );
}

export default TasksPage;
