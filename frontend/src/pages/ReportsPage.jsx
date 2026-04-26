import { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, Stack, Typography } from "@mui/material";
import { analyticsApi, workApi } from "../api/endpoints";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import PageState from "../components/PageState";
import PaginationControls from "../components/PaginationControls";
import { useAuth } from "../store/AuthContext";
import { useRealtime } from "../store/RealtimeContext";
import { progressTrackBg, surfaceSubtle } from "../styles/muiSurfaces";

function BarRow({ label, value, max, accent = "linear-gradient(90deg, rgba(116,184,255,0.95), rgba(155,124,255,0.92))" }) {
  return (
    <Stack spacing={0.8}>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" color="text.secondary">{value}</Typography>
      </Stack>
      <Box sx={{ height: 10, borderRadius: 999, bgcolor: (theme) => progressTrackBg(theme), overflow: "hidden" }}>
        <Box sx={{ width: `${max ? (value / max) * 100 : 0}%`, height: "100%", background: accent }} />
      </Box>
    </Stack>
  );
}

function ReportsPage() {
  const { activeOrganizationId, user } = useAuth();
  const { versions } = useRealtime();
  const [summary, setSummary] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [slaRisk, setSlaRisk] = useState([]);
  const [userRisk, setUserRisk] = useState([]);
  const [teamRisk, setTeamRisk] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [auditMeta, setAuditMeta] = useState(null);
  const [auditPage, setAuditPage] = useState(1);
  const orgId = activeOrganizationId || user.organization_id;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      workApi.reports({ organization_id: orgId }),
      workApi.auditLogs({ organization_id: orgId, paginated: true, page: auditPage, page_size: 10 }),
      analyticsApi.slaRisk({ organization_id: orgId }),
      analyticsApi.userRisk({ organization_id: orgId }),
      analyticsApi.teamRisk({ organization_id: orgId }),
    ])
      .then(([summaryResponse, logsResponse, taskRiskResponse, userRiskResponse, teamRiskResponse]) => {
        setSummary(summaryResponse.data);
        setAuditLogs(logsResponse.data.items || []);
        setAuditMeta(logsResponse.data.meta || null);
        setSlaRisk(taskRiskResponse.data);
        setUserRisk(userRiskResponse.data);
        setTeamRisk(teamRiskResponse.data);
        setError("");
      })
      .catch((requestError) => setError(requestError.response?.data?.detail || "Unable to load reports"))
      .finally(() => setLoading(false));
  }, [orgId, versions.tasks, versions.analytics, versions.activity, auditPage]);

  const retry = () => {
    setAuditPage(1);
    setSummary(null);
    setError("");
    setLoading(true);
  };

  const hasSummary = Boolean(summary);
  const statusMax = hasSummary ? Math.max(...Object.values(summary.tasks_by_status), 1) : 1;
  const userMax = hasSummary ? Math.max(...summary.tasks_by_user.map((item) => item.count), 1) : 1;
  const teamMax = Math.max(...teamRisk.map((item) => item.avg_risk_score), 1);


  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Reports, predictive risk, and governance signals"
        description="Track SLA pressure, workload imbalance, sprint performance, and audit history with richer operational visuals."
        actions={[<Button key="export" variant="outlined" component="a" href={`http://localhost:7155/api/work/reports/tasks.csv?organization_id=${orgId}`} target="_blank">Export CSV</Button>]}
      />
      {error && hasSummary ? <Alert severity="warning" sx={{ mb: 2.5 }}>{error}</Alert> : null}
      <PageState
        loading={loading && !hasSummary}
        error={!hasSummary ? error : ""}
        empty={!loading && !error && !hasSummary}
        title="No reports available yet"
        description="As more work flows through tasks, approvals, and sprints, the reporting layer will populate automatically."
        onRetry={retry}
      />
      {hasSummary ? (
      <Grid container spacing={3}>
        <Grid item xs={12} md={3}><MetricCard label="Breached SLA" value={summary.sla_performance.breached} helper="Tasks already outside SLA" accent="rgba(255,107,122,0.22)" /></Grid>
        <Grid item xs={12} md={3}><MetricCard label="At risk" value={slaRisk.filter((item) => item.risk_level !== "low").length} helper="Likely to slip soon" accent="rgba(245,165,36,0.22)" /></Grid>
        <Grid item xs={12} md={3}><MetricCard label="Overloaded users" value={userRisk.filter((item) => item.risk_level !== "low").length} helper="Watch allocation and handoffs" accent="rgba(61,200,255,0.18)" /></Grid>
        <Grid item xs={12} md={3}><MetricCard label="Healthy tasks" value={summary.sla_performance.on_track_or_resolved} helper="On-track or resolved" accent="rgba(57,217,138,0.18)" /></Grid>

        <Grid item xs={12} lg={6}>
          <GlassPanel title="Tasks by status" subtitle="Execution posture across the visible workspace">
            <Stack spacing={1.4}>
              {Object.entries(summary.tasks_by_status).map(([status, value]) => (
                <BarRow key={status} label={status.replaceAll("_", " ")} value={value} max={statusMax} />
              ))}
            </Stack>
          </GlassPanel>
        </Grid>

        <Grid item xs={12} lg={6}>
          <GlassPanel title="Workload by user" subtitle="Who is carrying the largest active volume">
            <Stack spacing={1.4}>
              {summary.tasks_by_user.slice(0, 6).map((entry) => (
                <BarRow key={entry.user} label={entry.user} value={entry.count} max={userMax} accent="linear-gradient(90deg, rgba(61,200,255,0.9), rgba(116,184,255,0.9))" />
              ))}
            </Stack>
          </GlassPanel>
        </Grid>

        <Grid item xs={12} lg={6}>
          <GlassPanel title="Team risk overview" subtitle="Teams most likely to miss SLA or stall on delivery">
            <Stack spacing={1.35}>
              {teamRisk.map((team) => (
                <Box key={team.team_name} sx={{ p: 1.5, borderRadius: 3.5, bgcolor: (theme) => surfaceSubtle(theme) }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2">{team.team_name}</Typography>
                    <Chip size="small" label={team.risk_level} color={team.risk_level === "high" || team.risk_level === "critical" ? "warning" : "default"} />
                  </Stack>
                  <Box sx={{ mt: 1.2 }}><BarRow label="Average risk" value={team.avg_risk_score} max={teamMax} accent="linear-gradient(90deg, rgba(245,165,36,0.95), rgba(255,107,122,0.95))" /></Box>
                </Box>
              ))}
            </Stack>
          </GlassPanel>
        </Grid>

        <Grid item xs={12} lg={6}>
          <GlassPanel title="Top task risks" subtitle="Explainable flags using due dates, blockers, priority, and workload">
            <Stack spacing={1.2}>
              {slaRisk.slice(0, 6).map((entry) => (
                <Box key={entry.task_id} sx={{ p: 1.5, borderRadius: 3.5, bgcolor: (theme) => surfaceSubtle(theme) }}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography variant="subtitle2">{entry.title}</Typography>
                    <Chip size="small" label={`${entry.risk_score} ${entry.risk_level}`} color={entry.risk_level === "critical" ? "error" : entry.risk_level === "high" ? "warning" : "default"} />
                  </Stack>
                  <Typography variant="body2" sx={{ mt: 0.8, color: "text.secondary" }}>{entry.assignee} · {entry.team}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.8, color: "text.primary" }}>{entry.reasons.join(" · ")}</Typography>
                </Box>
              ))}
            </Stack>
          </GlassPanel>
        </Grid>

        <Grid item xs={12} lg={6}>
          <GlassPanel title="Sprint performance" subtitle="Completion signal across the visible sprint horizon">
            <Stack spacing={1.2}>
              {summary.sprint_performance.map((sprint) => (
                <Box key={sprint.id} sx={{ p: 1.5, borderRadius: 3.5, bgcolor: (theme) => surfaceSubtle(theme) }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle2">{sprint.name}</Typography>
                    <Chip size="small" label={sprint.status} />
                  </Stack>
                  <Box sx={{ mt: 1.2 }}>
                    <BarRow label="Completed tasks" value={sprint.completed_tasks} max={Math.max(sprint.total_tasks, 1)} />
                  </Box>
                </Box>
              ))}
            </Stack>
          </GlassPanel>
        </Grid>

        <Grid item xs={12} lg={6}>
          <GlassPanel title="Audit log" subtitle="Governance trail for user, org, task, and approval changes">
            <Stack spacing={1.2}>
              {auditLogs.slice(0, 10).map((log) => (
                <Box key={log.id} sx={{ p: 1.4, borderRadius: 3.5, bgcolor: (theme) => surfaceSubtle(theme) }}>
                  <Typography variant="subtitle2">{log.action}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.6, color: "text.secondary" }}>
                    {log.entity_type} #{log.entity_id || "-"} · {log.details || "No details"}
                  </Typography>
                </Box>
              ))}
            </Stack>
            <PaginationControls meta={auditMeta} page={auditPage} onChange={setAuditPage} />
          </GlassPanel>
        </Grid>
      </Grid>
      ) : null}
    </>
  );
}

export default ReportsPage;
