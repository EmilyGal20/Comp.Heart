import { useEffect, useState } from "react";
import { Button, Chip, CircularProgress, Grid, Stack, Typography } from "@mui/material";
import { dashboardApi, usersApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";
import { useAuth } from "../store/AuthContext";

function DashboardPage() {
  const { user, activeOrganizationId, scopedOrganization } = useAuth();
  const [summary, setSummary] = useState(null);
  const [personal, setPersonal] = useState(null);

  useEffect(() => {
    Promise.all([
      dashboardApi.summary(activeOrganizationId ? { organization_id: activeOrganizationId } : {}),
      usersApi.myDashboard(),
    ]).then(([summaryResponse, personalResponse]) => {
      setSummary(summaryResponse.data);
      setPersonal(personalResponse.data);
    });
  }, [activeOrganizationId]);

  if (!summary || !personal) {
    return <CircularProgress />;
  }

  const roleTitleMap = {
    SUPER_ADMIN: "Global visibility across every organization and role tier.",
    ADMIN: "Operational oversight for your organization, with access to users, automations, and workflow health.",
    MANAGER: "Team-level execution, workload balance, and SLA accountability.",
    USER: "Your work queue, alerts, recommended docs, and AI shortcuts in one place.",
  };

  return (
    <>
      <PageHeader
        eyebrow={summary.scope_label}
        title={user.role === "USER" ? `Welcome back, ${user.full_name.split(" ")[0]}` : "Operational dashboard"}
        description={roleTitleMap[user.role]}
        actions={[
          <Chip key="scope" label={scopedOrganization?.name || "All organizations"} color="secondary" />,
          <Chip key="role" label={user.role.replace("_", " ")} color={user.role === "SUPER_ADMIN" ? "error" : "primary"} />,
        ]}
      />
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6} xl={3}><MetricCard label={user.role === "USER" ? "My open tasks" : "Open tasks"} value={user.role === "USER" ? personal.summary.my_open_tasks : summary.open_tasks} helper="Immediate work requiring attention" accent="rgba(61,200,255,0.28)" /></Grid>
        <Grid item xs={12} md={6} xl={3}><MetricCard label="Overdue pressure" value={user.role === "USER" ? personal.summary.overdue_tasks : summary.overdue_tasks} helper="SLA risks and delayed execution" accent="rgba(255,107,122,0.25)" /></Grid>
        <Grid item xs={12} md={6} xl={3}><MetricCard label="Recommended docs" value={user.role === "USER" ? personal.summary.recommended_docs : summary.total_knowledge_items} helper="Relevant knowledge available now" accent="rgba(155,124,255,0.25)" /></Grid>
        <Grid item xs={12} md={6} xl={3}><MetricCard label="Unread alerts" value={user.role === "USER" ? personal.summary.unread_notifications : summary.unread_notifications} helper="Signals still waiting on review" accent="rgba(57,217,138,0.18)" /></Grid>
        <Grid item xs={12} lg={7}>
          <GlassPanel title={user.role === "USER" ? "My task lane" : "Priority execution lane"} subtitle="The items most likely to shape your next move" minHeight={340}>
            <Stack spacing={1.5}>
              {(user.role === "USER" ? personal.my_tasks : summary.focus_items).map((item) => (
                <Stack key={item.id || item.title} sx={{ p: 2, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)" }}>
                  <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                    <div>
                      <Typography variant="subtitle1">{item.title}</Typography>
                      <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.62)" }}>
                        {item.subtitle || item.status || "Active work item"}
                      </Typography>
                    </div>
                    <Stack direction="row" spacing={1}>
                      <StatusPill value={item.priority} />
                      <StatusPill value={item.sla_status} />
                      {item.risk_score ? <Chip label={`Risk ${item.risk_score}`} color={item.risk_score > 70 ? "error" : "info"} /> : null}
                    </Stack>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} lg={5}>
          <GlassPanel title="Recent notifications" subtitle="The latest alerts relevant to your scope" minHeight={340}>
            <Stack spacing={1.5}>
              {personal.recent_notifications.map((notification) => (
                <Stack key={notification.id} sx={{ p: 1.5, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)" }}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography variant="subtitle2">{notification.title}</Typography>
                    <StatusPill value={notification.severity} />
                  </Stack>
                  <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.62)" }}>{notification.type}</Typography>
                </Stack>
              ))}
            </Stack>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} md={6}>
          <GlassPanel title="Task mix" subtitle="Current breakdown across the visible workload">
            <Stack spacing={1.8}>
              {Object.entries(summary.task_breakdown).map(([key, value]) => (
                <Stack direction="row" justifyContent="space-between" key={key}>
                  <Typography>{key.replaceAll("_", " ")}</Typography>
                  <Typography color="primary.main">{value}</Typography>
                </Stack>
              ))}
            </Stack>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} md={6}>
          <GlassPanel title="AI quick prompts" subtitle="Jump into the org-aware assistant faster">
            <Stack spacing={1.2}>
              {[
                "What process should I follow next?",
                "Show me the most relevant knowledge for overdue work.",
                "Summarize the latest workflow pressure in my scope.",
              ].map((prompt) => (
                <Button key={prompt} variant="outlined" sx={{ justifyContent: "flex-start" }}>
                  {prompt}
                </Button>
              ))}
            </Stack>
          </GlassPanel>
        </Grid>
      </Grid>
    </>
  );
}

export default DashboardPage;
