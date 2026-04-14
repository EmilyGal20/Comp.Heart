import { useEffect, useState } from "react";
import { Button, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { adminApi } from "../api/endpoints";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import MetricCard from "../components/MetricCard";
import PageState from "../components/PageState";
import PageHeader from "../components/PageHeader";
import { useRealtime } from "../store/RealtimeContext";

function GlobalControlCenterPage() {
  const navigate = useNavigate();
  const { versions, connectionState } = useRealtime();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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
          <Grid item xs={12} md={6} xl={3}><MetricCard label="Organizations" value={data.overview.total_organizations} helper="Companies on the platform" accent="rgba(155,124,255,0.28)" /></Grid>
          <Grid item xs={12} md={6} xl={3}><MetricCard label="Users" value={data.overview.total_users} helper="People across all orgs" accent="rgba(61,200,255,0.22)" /></Grid>
          <Grid item xs={12} md={6} xl={3}><MetricCard label="Admins" value={data.overview.total_admins} helper="Admin operators and owners" accent="rgba(245,165,36,0.22)" /></Grid>
          <Grid item xs={12} md={6} xl={3}><MetricCard label="Active tasks" value={data.overview.total_active_tasks} helper="Open work across the platform" accent="rgba(255,107,122,0.20)" /></Grid>
          <Grid item xs={12} lg={8}>
            <GlassPanel title="Organization comparison" subtitle="Top-line health, overdue pressure, and workload across companies">
              <Table>
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
                  {data.organization_comparison.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.industry}</TableCell>
                      <TableCell>{item.users}</TableCell>
                      <TableCell>{item.tasks}</TableCell>
                      <TableCell>{item.overdue_tasks}</TableCell>
                      <TableCell>{item.automations}</TableCell>
                      <TableCell>{item.latest_activity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </GlassPanel>
          </Grid>
          <Grid item xs={12} lg={4}>
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
          <Grid item xs={12} lg={4}>
            <GlassPanel title="At-risk organizations" subtitle="Highest overdue pressure and operational drift">
              <Stack spacing={1.2}>
                {data.at_risk_organizations.map((item) => (
                  <Stack key={item.id} sx={{ p: 1.6, borderRadius: 3.5, bgcolor: "rgba(255,255,255,0.03)" }}>
                    <Typography variant="subtitle2">{item.name}</Typography>
                    <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.66)" }}>{item.overdue_tasks} overdue tasks - {item.tasks} total tasks</Typography>
                  </Stack>
                ))}
              </Stack>
            </GlassPanel>
          </Grid>
          <Grid item xs={12} lg={4}>
            <GlassPanel title="Critical alerts" subtitle="Recent high-severity signals">
              <Stack spacing={1.2}>
                {data.critical_notifications.length ? data.critical_notifications.map((item) => (
                  <Stack key={item.id} sx={{ p: 1.6, borderRadius: 3.5, bgcolor: "rgba(255,107,122,0.08)" }}>
                    <Typography variant="subtitle2">{item.title}</Typography>
                    <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.66)" }}>{item.message}</Typography>
                  </Stack>
                )) : <Typography variant="body2">No critical alerts right now.</Typography>}
              </Stack>
            </GlassPanel>
          </Grid>
          <Grid item xs={12} lg={4}>
            <GlassPanel title="Important announcements" subtitle="Pinned and recent platform-wide notices">
              <Stack spacing={1.2}>
                {data.important_announcements.length ? data.important_announcements.map((item) => (
                  <Stack key={item.id} sx={{ p: 1.6, borderRadius: 3.5, bgcolor: item.is_pinned ? "rgba(116,184,255,0.08)" : "rgba(255,255,255,0.03)" }}>
                    <Typography variant="subtitle2">{item.title}</Typography>
                    <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.66)" }}>{item.severity}</Typography>
                  </Stack>
                )) : <Typography variant="body2">No recent announcements.</Typography>}
              </Stack>
            </GlassPanel>
          </Grid>
          <Grid item xs={12} lg={6}>
            <GlassPanel title="Automation health" subtitle="Enabled rules and recent automation runs">
              <Stack spacing={1.2}>
                <Chip label={`${data.automation_health.enabled_rules} enabled rules`} color="secondary" />
                {data.automation_health.recent_runs.map((item) => (
                  <Typography key={item.id} variant="body2">{item.name} - {item.last_triggered_at ? new Date(item.last_triggered_at).toLocaleString() : "Not triggered yet"}</Typography>
                ))}
              </Stack>
            </GlassPanel>
          </Grid>
          <Grid item xs={12} lg={6}>
            <GlassPanel title="Audit activity" subtitle="Recent system-level changes and operator actions">
              <Stack spacing={1.2}>
                {data.audit_activity.map((item) => (
                  <Typography key={item.id} variant="body2">{item.action} - {item.details}</Typography>
                ))}
              </Stack>
            </GlassPanel>
          </Grid>
        </Grid>
      ) : null}
    </>
  );
}

export default GlobalControlCenterPage;
