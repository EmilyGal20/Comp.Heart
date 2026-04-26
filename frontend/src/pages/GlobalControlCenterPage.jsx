import { useEffect, useState } from "react";
import { Button, Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { adminApi } from "../api/endpoints";
import CardListScroll from "../components/CardListScroll";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import MetricCard from "../components/MetricCard";
import PageState from "../components/PageState";
import PageHeader from "../components/PageHeader";
import { useRealtime } from "../store/RealtimeContext";
import { brandSurfacePinned, surfaceSubtle } from "../styles/muiSurfaces";

function GlobalControlCenterPage() {
  const navigate = useNavigate();
  const { versions, connectionState } = useRealtime();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const overview = data?.overview || {};
  const orgComparison = data?.organization_comparison || [];
  const atRiskOrganizations = data?.at_risk_organizations || [];
  const criticalNotifications = data?.critical_notifications || [];
  const importantAnnouncements = data?.important_announcements || [];
  const recentRuns = data?.automation_health?.recent_runs || [];
  const auditActivity = data?.audit_activity || [];

  const load = async () => {
    setLoading(true);
    try {
      const response = await adminApi.commandCenter().catch(() => adminApi.controlCenter());
      setData(response.data);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load command center");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [versions.activity, versions.notifications, versions.organizations, versions.users, versions.analytics]);

  return (
    <>
      <PageHeader
        eyebrow="Super Admin"
        title="Command center"
        description="Executive platform oversight for organization health, overdue pressure, approvals, alerts, automation posture, and system-wide activity."
        actions={[
          <Chip key="live" label={`Realtime ${connectionState}`} color={connectionState === "connected" ? "success" : "default"} />,
          <Button key="refresh" variant="outlined" onClick={load}>Refresh</Button>,
        ]}
      />
      <PageState
        loading={loading}
        error={error}
        empty={!loading && !error && !data}
        title="Command center is waiting for platform data"
        description="No system snapshot is available yet. Retry to reload the executive control surface."
        onRetry={load}
      />
      {data ? (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6, xl: 3 }}><MetricCard label="Organizations" value={overview.total_organizations || 0} helper="Companies on the platform" accent="rgba(155,124,255,0.28)" /></Grid>
          <Grid size={{ xs: 12, md: 6, xl: 3 }}><MetricCard label="Users" value={overview.total_users || 0} helper="People across all orgs" accent="rgba(61,200,255,0.22)" /></Grid>
          <Grid size={{ xs: 12, md: 6, xl: 3 }}><MetricCard label="Admins" value={overview.total_admins || 0} helper="Admin operators and owners" accent="rgba(245,165,36,0.22)" /></Grid>
          <Grid size={{ xs: 12, md: 6, xl: 3 }}><MetricCard label="Active tasks" value={overview.total_active_tasks || 0} helper="Open work across the platform" accent="rgba(255,107,122,0.20)" /></Grid>
          <Grid size={{ xs: 12, lg: 8 }}>
            <GlassPanel title="Organization comparison" subtitle="Top-line health, overdue pressure, and workload across companies">
              <TableContainer sx={orgComparison.length > 5 ? { maxHeight: 360, overflow: "auto" } : {}}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Organization</TableCell>
                      <TableCell>Industry</TableCell>
                      <TableCell>Users</TableCell>
                      <TableCell>Tasks</TableCell>
                      <TableCell>Overdue</TableCell>
                      <TableCell>Automations</TableCell>
                      <TableCell>Latest activity</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {orgComparison.length ? orgComparison.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.industry}</TableCell>
                        <TableCell>{item.users}</TableCell>
                        <TableCell>{item.tasks}</TableCell>
                        <TableCell>{item.overdue_tasks}</TableCell>
                        <TableCell>{item.automations}</TableCell>
                        <TableCell>{item.latest_activity}</TableCell>
                      </TableRow>
                    )) : <TableRow><TableCell colSpan={7}>No organization comparison data is available yet.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            </GlassPanel>
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <GlassPanel title="Quick actions" subtitle="Jump to the highest-leverage admin surfaces">
              <Stack spacing={1.2}>
                {[
                  { label: "Create organization", path: "/organizations" },
                  { label: "Manage organizations", path: "/organizations" },
                  { label: "Review approvals", path: "/approvals" },
                  { label: "Open users directory", path: "/employees" },
                  { label: "Open reports", path: "/reports" },
                ].map((item) => (
                  <Button key={item.label} variant="outlined" fullWidth onClick={() => navigate(item.path)}>{item.label}</Button>
                ))}
              </Stack>
            </GlassPanel>
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <GlassPanel title="At-risk organizations" subtitle="Highest overdue pressure and operational drift">
              <CardListScroll count={atRiskOrganizations.length}>
                <Stack spacing={1.2}>
                  {atRiskOrganizations.length ? atRiskOrganizations.map((item) => (
                    <Stack key={item.id} sx={{ p: 1.6, borderRadius: 2.5, bgcolor: (theme) => surfaceSubtle(theme) }}>
                      <Typography variant="subtitle2">{item.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{item.overdue_tasks} overdue tasks - {item.tasks} total tasks</Typography>
                    </Stack>
                  )) : <Typography variant="body2" color="text.secondary">No organizations are currently flagged as high risk.</Typography>}
                </Stack>
              </CardListScroll>
            </GlassPanel>
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <GlassPanel title="Critical alerts" subtitle="Recent high-severity signals">
              <CardListScroll count={criticalNotifications.length} rowEstimatePx={100}>
                <Stack spacing={1.2}>
                  {criticalNotifications.length ? criticalNotifications.map((item) => (
                    <Stack key={item.id} sx={{ p: 1.6, borderRadius: 2.5, bgcolor: "rgba(255,107,122,0.08)" }}>
                      <Typography variant="subtitle2">{item.title}</Typography>
                      <Typography variant="body2" color="text.secondary">{item.message}</Typography>
                    </Stack>
                  )) : <Typography variant="body2" color="text.secondary">No critical alerts right now.</Typography>}
                </Stack>
              </CardListScroll>
            </GlassPanel>
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <GlassPanel title="Important announcements" subtitle="Pinned and recent platform-wide notices">
              <CardListScroll count={importantAnnouncements.length}>
                <Stack spacing={1.2}>
                  {importantAnnouncements.length ? importantAnnouncements.map((item) => (
                    <Stack key={item.id} sx={{ p: 1.6, borderRadius: 2.5, bgcolor: (theme) => (item.is_pinned ? brandSurfacePinned(theme) : surfaceSubtle(theme)) }}>
                      <Typography variant="subtitle2">{item.title}</Typography>
                      <Typography variant="body2" color="text.secondary">{item.severity}</Typography>
                    </Stack>
                  )) : <Typography variant="body2" color="text.secondary">No recent announcements.</Typography>}
                </Stack>
              </CardListScroll>
            </GlassPanel>
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <GlassPanel title="Automation health" subtitle="Enabled rules and recent automation runs">
              <Stack spacing={1.2}>
                <Chip label={`${data.automation_health?.enabled_rules || 0} enabled rules`} color="secondary" />
                <CardListScroll count={recentRuns.length} rowEstimatePx={44}>
                  <Stack spacing={1.2}>
                    {recentRuns.length ? recentRuns.map((item) => (
                      <Typography key={item.id} variant="body2">{item.name} - {item.last_triggered_at ? new Date(item.last_triggered_at).toLocaleString() : "Not triggered yet"}</Typography>
                    )) : <Typography variant="body2" color="text.secondary">No automation runs have been recorded yet.</Typography>}
                  </Stack>
                </CardListScroll>
              </Stack>
            </GlassPanel>
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <GlassPanel title="Audit activity" subtitle="Recent system-level changes and operator actions">
              <CardListScroll count={auditActivity.length} rowEstimatePx={40}>
                <Stack spacing={1.2}>
                  {auditActivity.length ? auditActivity.map((item) => (
                    <Typography key={item.id} variant="body2">{item.action} - {item.details}</Typography>
                  )) : <Typography variant="body2" color="text.secondary">No audit activity is available right now.</Typography>}
                </Stack>
              </CardListScroll>
            </GlassPanel>
          </Grid>
        </Grid>
      ) : null}
    </>
  );
}

export default GlobalControlCenterPage;
