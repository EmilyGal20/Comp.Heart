import { useEffect, useState } from "react";
import { Button, Chip, Grid, Stack, Typography } from "@mui/material";
import { workApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../store/AuthContext";
import { useRealtime } from "../store/RealtimeContext";

function ReportsPage() {
  const { activeOrganizationId, user } = useAuth();
  const { versions } = useRealtime();
  const [summary, setSummary] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const orgId = activeOrganizationId || user.organization_id;

  useEffect(() => {
    Promise.all([
      workApi.reports({ organization_id: orgId }),
      workApi.auditLogs({ organization_id: orgId }),
    ]).then(([summaryResponse, logsResponse]) => {
      setSummary(summaryResponse.data);
      setAuditLogs(logsResponse.data);
    });
  }, [orgId, versions.activity, versions.tasks, versions.organizations, versions.users]);

  if (!summary) return null;

  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Reports, exports, and audit trails"
        description="Track sprint health, SLA performance, workload spread, overdue pressure, and the most important system changes."
        actions={[<Button key="export" variant="outlined" component="a" href={`http://localhost:7155/api/work/reports/tasks.csv?organization_id=${orgId}`} target="_blank">Export CSV</Button>]}
      />
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={4}><MetricCard label="Breached SLA" value={summary.sla_performance.breached} helper="Tasks outside SLA" accent="rgba(255,107,122,0.22)" /></Grid>
        <Grid item xs={12} md={4}><MetricCard label="Warning" value={summary.sla_performance.warning} helper="At-risk tasks" accent="rgba(245,165,36,0.22)" /></Grid>
        <Grid item xs={12} md={4}><MetricCard label="On track" value={summary.sla_performance.on_track_or_resolved} helper="Healthy tasks" accent="rgba(57,217,138,0.18)" /></Grid>
        <Grid item xs={12} lg={6}>
          <GlassPanel title="Tasks by status" subtitle="Current shape of execution">
            <Stack spacing={1.2}>
              {Object.entries(summary.tasks_by_status).map(([status, value]) => (
                <Stack key={status} direction="row" justifyContent="space-between">
                  <Typography>{status.replaceAll("_", " ")}</Typography>
                  <Chip size="small" label={value} />
                </Stack>
              ))}
            </Stack>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} lg={6}>
          <GlassPanel title="Tasks by user" subtitle="Who carries the most work">
            <Stack spacing={1.2}>
              {summary.tasks_by_user.map((entry) => (
                <Stack key={entry.user} direction="row" justifyContent="space-between">
                  <Typography>{entry.user}</Typography>
                  <Chip size="small" label={entry.count} />
                </Stack>
              ))}
            </Stack>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} lg={6}>
          <GlassPanel title="Sprint performance" subtitle="Execution quality across iterations">
            <Stack spacing={1.2}>
              {summary.sprint_performance.map((sprint) => (
                <Stack key={sprint.id} sx={{ p: 1.4, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)" }}>
                  <Typography variant="subtitle2">{sprint.name}</Typography>
                  <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.64)" }}>{sprint.completed_tasks}/{sprint.total_tasks} completed • {sprint.status}</Typography>
                </Stack>
              ))}
            </Stack>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} lg={6}>
          <GlassPanel title="Audit log" subtitle="Recent governance and platform actions">
            <Stack spacing={1.2}>
              {auditLogs.map((log) => (
                <Stack key={log.id} sx={{ p: 1.4, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)" }}>
                  <Typography variant="subtitle2">{log.action}</Typography>
                  <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.64)" }}>{log.entity_type} #{log.entity_id || "-"} • {log.details || "No details"}</Typography>
                </Stack>
              ))}
            </Stack>
          </GlassPanel>
        </Grid>
      </Grid>
    </>
  );
}

export default ReportsPage;
