import { useEffect, useState } from "react";
import { Chip, CircularProgress, Grid, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { adminApi, organizationsApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import { useRealtime } from "../store/RealtimeContext";

function GlobalControlCenterPage() {
  const { versions, connectionState } = useRealtime();
  const [summary, setSummary] = useState(null);
  const [comparison, setComparison] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    Promise.all([adminApi.globalSummary(), adminApi.organizationComparison(), organizationsApi.list(), adminApi.users({ organization_id: "" }).catch(() => ({ data: [] }))]).then(
      ([summaryResponse, comparisonResponse, organizationsResponse, usersResponse]) => {
        setSummary(summaryResponse.data);
        setComparison(comparisonResponse.data);
        setOrganizations(organizationsResponse.data);
        setUsers(usersResponse.data);
      }
    );
  }, [versions.activity, versions.organizations, versions.users]);

  if (!summary) {
    return <CircularProgress />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Super Admin"
        title="Global control center"
        description="A cross-organization operating view for tenant health, workforce scale, overdue pressure, and portfolio-level execution signals."
        actions={[<Chip key="live" label={`Realtime ${connectionState}`} color={connectionState === "connected" ? "success" : "default"} />]}
      />
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6} xl={3}><MetricCard label="Organizations" value={organizations.length} helper="Active companies on the platform" accent="rgba(155,124,255,0.28)" /></Grid>
        <Grid item xs={12} md={6} xl={3}><MetricCard label="Users" value={summary.total_users} helper="People managed across all orgs" accent="rgba(61,200,255,0.24)" /></Grid>
        <Grid item xs={12} md={6} xl={3}><MetricCard label="Tasks" value={summary.total_tasks} helper="Cross-org workload in the system" accent="rgba(255,107,122,0.22)" /></Grid>
        <Grid item xs={12} md={6} xl={3}><MetricCard label="Unread alerts" value={summary.unread_notifications} helper="Global signal volume" accent="rgba(57,217,138,0.18)" /></Grid>
        <Grid item xs={12} lg={8}>
          <GlassPanel title="Organization comparison" subtitle="Performance and workload across companies">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Organization</TableCell>
                  <TableCell>Slug</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Industry</TableCell>
                  <TableCell>Users</TableCell>
                  <TableCell>Teams</TableCell>
                  <TableCell>Tasks</TableCell>
                  <TableCell>Overdue</TableCell>
                  <TableCell>Knowledge</TableCell>
                  <TableCell>Notifications</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {comparison.map((organization) => (
                  <TableRow key={organization.id}>
                    <TableCell>{organization.name}</TableCell>
                    <TableCell>{organization.slug}</TableCell>
                    <TableCell>{organization.status}</TableCell>
                    <TableCell>{organization.industry}</TableCell>
                    <TableCell>{organization.users}</TableCell>
                    <TableCell>{organization.teams}</TableCell>
                    <TableCell>{organization.tasks}</TableCell>
                    <TableCell>{organization.overdue_tasks}</TableCell>
                    <TableCell>{organization.knowledge_items}</TableCell>
                    <TableCell>{organization.notifications}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} lg={4}>
          <GlassPanel title="Cross-org attention lane" subtitle="The highest-pressure items right now">
            <Stack spacing={1.5}>
              {summary.focus_items.map((item) => (
                <Stack key={item.title} sx={{ p: 1.5, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)" }}>
                  <Typography variant="subtitle2">{item.title}</Typography>
                  <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.62)" }}>{item.subtitle}</Typography>
                </Stack>
              ))}
            </Stack>
          </GlassPanel>
        </Grid>
        <Grid item xs={12}>
          <GlassPanel title="Organization summaries" subtitle="Latest activity and quick operational shape">
            <Grid container spacing={2}>
              {organizations.map((entry) => (
                <Grid item xs={12} md={6} xl={4} key={entry.organization.id}>
                  <Stack sx={{ p: 2, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)" }} spacing={1}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Typography variant="subtitle1">{entry.organization.name}</Typography>
                      <Chip size="small" label={entry.organization.is_active ? "Active" : "Inactive"} color={entry.organization.is_active ? "success" : "default"} />
                    </Stack>
                    <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.62)" }}>{entry.latest_activity}</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={`${entry.user_count} users`} />
                      <Chip size="small" label={`${entry.team_count} teams`} />
                      <Chip size="small" label={`${entry.task_count} tasks`} />
                    </Stack>
                  </Stack>
                </Grid>
              ))}
            </Grid>
          </GlassPanel>
        </Grid>
      </Grid>
    </>
  );
}

export default GlobalControlCenterPage;
