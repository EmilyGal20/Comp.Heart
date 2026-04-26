import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, Drawer, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { approvalsApi, usersApi } from "../api/endpoints";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import PageState from "../components/PageState";
import PaginationControls from "../components/PaginationControls";
import PageHeader from "../components/PageHeader";
import { borderSubtle, surfaceSubtle } from "../styles/muiSurfaces";
import StatusPill from "../components/StatusPill";
import { useAuth } from "../store/AuthContext";
import { useRealtime } from "../store/RealtimeContext";

function ApprovalsPage() {
  const { activeOrganizationId, user } = useAuth();
  const { versions } = useRealtime();
  const [dashboard, setDashboard] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ status: "", requester_id: "", approver_id: "", created_from: "", created_to: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const orgId = activeOrganizationId || user.organization_id;

  const load = async () => {
    setLoading(true);
    try {
      const scopedParams = user.role === "SUPER_ADMIN" && !activeOrganizationId ? {} : { organization_id: orgId };
      const [dashboardResponse, approvalsResponse, usersResponse] = await Promise.all([
        approvalsApi.dashboard(scopedParams),
        approvalsApi.list({
          ...scopedParams,
          paginated: true,
          page,
          page_size: 20,
          status: filters.status || undefined,
          requester_id: filters.requester_id || undefined,
          approver_id: filters.approver_id || undefined,
          created_from: filters.created_from || undefined,
          created_to: filters.created_to || undefined,
        }),
        usersApi.list(scopedParams),
      ]);
      setDashboard(dashboardResponse.data);
      setApprovals(approvalsResponse.data.items || []);
      setMeta(approvalsResponse.data.meta || null);
      setUsers(usersResponse.data);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load approvals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [activeOrganizationId, versions.analytics, versions.activity, versions.tasks, filters.status, filters.requester_id, filters.approver_id, filters.created_from, filters.created_to, page]);

  useEffect(() => {
    setPage(1);
  }, [activeOrganizationId, filters.status, filters.requester_id, filters.approver_id, filters.created_from, filters.created_to]);

  const canDecide = useMemo(() => ["SUPER_ADMIN", "ADMIN"].includes(user.role), [user.role]);

  const decide = async (approval, status) => {
    await approvalsApi.update(approval.id, { status });
    await load();
    setSelected(null);
  };

  return (
    <>
      <PageHeader
        eyebrow="Approvals"
        title="Approval command center"
        description="Review pending decisions, track historical outcomes, and act on approvals without digging into task drawers."
      />
      {error ? <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert> : null}
      {dashboard ? (
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}><GlassPanel title="Pending"><Typography variant="h3">{dashboard.summary.pending_count}</Typography></GlassPanel></Grid>
          <Grid item xs={12} md={3}><GlassPanel title="Awaiting me"><Typography variant="h3">{dashboard.summary.awaiting_me}</Typography></GlassPanel></Grid>
          <Grid item xs={12} md={3}><GlassPanel title="Teams"><Typography variant="h3">{dashboard.summary.approvals_by_team.length}</Typography></GlassPanel></Grid>
          <Grid item xs={12} md={3}><GlassPanel title="Recent actions"><Typography variant="h3">{dashboard.summary.recent_actions.length}</Typography></GlassPanel></Grid>
          <Grid item xs={12}>
            <GlassPanel
              title="Approval queue"
              subtitle="Filter by decision state, requester, approver, and date window"
              action={
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} flexWrap="wrap" useFlexGap>
                  <TextField select size="small" label="Status" value={filters.status} onChange={(event) => setFilters((previous) => ({ ...previous, status: event.target.value }))}>
                    <MenuItem value="">All</MenuItem>
                    {["PENDING", "APPROVED", "REJECTED"].map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
                  </TextField>
                  <TextField select size="small" label="Requester" value={filters.requester_id} onChange={(event) => setFilters((previous) => ({ ...previous, requester_id: event.target.value }))}>
                    <MenuItem value="">All</MenuItem>
                    {users.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.full_name}</MenuItem>)}
                  </TextField>
                  <TextField select size="small" label="Approver" value={filters.approver_id} onChange={(event) => setFilters((previous) => ({ ...previous, approver_id: event.target.value }))}>
                    <MenuItem value="">All</MenuItem>
                    {users.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.full_name}</MenuItem>)}
                  </TextField>
                  <TextField size="small" type="datetime-local" label="From" InputLabelProps={{ shrink: true }} value={filters.created_from} onChange={(event) => setFilters((previous) => ({ ...previous, created_from: event.target.value }))} />
                  <TextField size="small" type="datetime-local" label="To" InputLabelProps={{ shrink: true }} value={filters.created_to} onChange={(event) => setFilters((previous) => ({ ...previous, created_to: event.target.value }))} />
                </Stack>
              }
            >
              <Stack spacing={1.2}>
                <PageState
                  loading={loading}
                  error={error}
                  empty={!loading && !error && approvals.length === 0}
                  title="No approvals match this queue"
                  description="Adjust the filters or review a different date range."
                  onRetry={load}
                  minHeight={160}
                />
                {approvals.map((approval) => (
                  <Box key={approval.id} onClick={() => setSelected(approval)} sx={{ p: 1.7, borderRadius: 3.5, cursor: "pointer", bgcolor: (theme) => surfaceSubtle(theme), border: (theme) => `1px solid ${borderSubtle(theme)}` }}>
                    <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" spacing={1.5}>
                      <Box>
                        <Typography variant="subtitle2">{approval.task?.title || `Task #${approval.task_id}`}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.7 }}>
                          {(approval.requester?.full_name || "Unknown requester")} - {approval.reason || "No explicit reason provided"}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <StatusPill value={approval.status} />
                        {approval.approver?.full_name ? <Chip size="small" label={approval.approver.full_name} /> : null}
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
              <PaginationControls meta={meta} onChange={setPage} disabled={loading} />
            </GlassPanel>
          </Grid>
        </Grid>
      ) : null}
      <Drawer anchor="right" open={Boolean(selected)} onClose={() => setSelected(null)}>
        <Box sx={{ width: { xs: 360, md: 520 }, p: 3 }}>
          {selected ? (
            <Stack spacing={2}>
              <Typography variant="h5">{selected.task?.title || `Task #${selected.task_id}`}</Typography>
              <StatusPill value={selected.status} />
              <Typography variant="body2">Requested by {selected.requester?.full_name || "Unknown"}</Typography>
              <Typography variant="body2">Reason: {selected.reason || "No reason provided"}</Typography>
              {canDecide && selected.status === "PENDING" ? (
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" color="success" onClick={() => decide(selected, "APPROVED")}>Approve</Button>
                  <Button variant="outlined" color="error" onClick={() => decide(selected, "REJECTED")}>Reject</Button>
                </Stack>
              ) : null}
            </Stack>
          ) : null}
        </Box>
      </Drawer>
    </>
  );
}

export default ApprovalsPage;
