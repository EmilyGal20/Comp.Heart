import { useEffect, useState } from "react";
import { Button, Chip, Grid, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { adminApi, announcementsApi, approvalsApi, analyticsApi, dashboardApi, meetingsApi, onboardingApi, selfNotesApi, usersApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";
import { useAuth } from "../store/AuthContext";
import { useRealtime } from "../store/RealtimeContext";

function DashboardPage() {
  const navigate = useNavigate();
  const { user, activeOrganizationId, scopedOrganization } = useAuth();
  const { versions, connectionState } = useRealtime();
  const [summary, setSummary] = useState(null);
  const [personal, setPersonal] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [approvals, setApprovals] = useState(null);
  const [risk, setRisk] = useState([]);
  const [notes, setNotes] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [onboarding, setOnboarding] = useState(null);
  const [onboardingOverview, setOnboardingOverview] = useState(null);

  const params = activeOrganizationId ? { organization_id: activeOrganizationId } : {};

  useEffect(() => {
    Promise.all([
      dashboardApi.summary(params),
      usersApi.myDashboard(),
      announcementsApi.list({ important_only: true, ...params }),
      approvalsApi.dashboard(params),
      analyticsApi.slaRisk(params),
      selfNotesApi.list(),
      meetingsApi.list(),
      onboardingApi.me(),
      ["ADMIN", "MANAGER", "SUPER_ADMIN"].includes(user.role)
        ? (user.role === "SUPER_ADMIN" && !activeOrganizationId ? Promise.resolve({ data: null }) : adminApi.onboardingOverview(user.role === "SUPER_ADMIN" ? params : {}))
        : Promise.resolve({ data: null }),
    ]).then(([summaryResponse, personalResponse, announcementResponse, approvalResponse, riskResponse, notesResponse, meetingsResponse, onboardingResponse, onboardingOverviewResponse]) => {
      setSummary(summaryResponse.data);
      setPersonal(personalResponse.data);
      setAnnouncements(announcementResponse.data);
      setApprovals(approvalResponse.data);
      setRisk(riskResponse.data);
      setNotes(notesResponse.data);
      setMeetings(meetingsResponse.data);
      setOnboarding(onboardingResponse.data);
      setOnboardingOverview(onboardingOverviewResponse.data);
    });
  }, [activeOrganizationId, versions.activity, versions.notifications, versions.tasks, versions.analytics, versions.users]);

  if (!summary || !personal || !approvals || !onboarding) return null;

  return (
    <>
      <PageHeader
        eyebrow={summary.scope_label}
        title={user.role === "USER" ? `Welcome back, ${user.full_name.split(" ")[0]}` : "Operational dashboard"}
        description="A more intentional daily workspace for onboarding progress, urgent messages, approvals, risk, and the work most likely to need your next move."
        actions={[
          <Chip key="scope" label={scopedOrganization?.name || "All organizations"} color="secondary" />,
          <Chip key="live" label={`Realtime ${connectionState}`} color={connectionState === "connected" ? "success" : "default"} />,
        ]}
      />
      <Grid container spacing={3}>
        <Grid item xs={12} md={3}><MetricCard label={user.role === "USER" ? "My open tasks" : "Open tasks"} value={user.role === "USER" ? personal.summary.my_open_tasks : summary.open_tasks} helper="Current active load" accent="rgba(61,200,255,0.22)" /></Grid>
        <Grid item xs={12} md={3}><MetricCard label="Pending approvals" value={approvals.summary.pending_count} helper="Visible approval queue" accent="rgba(245,165,36,0.22)" /></Grid>
        <Grid item xs={12} md={3}><MetricCard label="At-risk tasks" value={risk.filter((item) => item.risk_level !== "low").length} helper="Predictive SLA pressure" accent="rgba(255,107,122,0.24)" /></Grid>
        <Grid item xs={12} md={3}><MetricCard label="Onboarding progress" value={`${onboarding.summary.completion_percent}%`} helper="Role-aware first-step completion" accent="rgba(57,217,138,0.18)" /></Grid>

        <Grid item xs={12} lg={8}>
          <GlassPanel title="Important announcements" subtitle="Pinned updates, admin messages, and latest operating guidance" action={<Stack direction="row" spacing={1}><Button size="small" variant="outlined" onClick={() => navigate("/messages")}>Important messages</Button><Button size="small" variant="outlined" onClick={() => navigate("/announcements")}>All announcements</Button></Stack>}>
            <Stack spacing={1.4}>
              {announcements.slice(0, 4).map((item) => (
                <Stack key={item.id} sx={{ p: 1.6, borderRadius: 3.5, bgcolor: item.is_pinned ? "rgba(116,184,255,0.08)" : "rgba(255,255,255,0.03)" }}>
                  <Stack direction="row" justifyContent="space-between"><Typography variant="subtitle2">{item.title}</Typography><StatusPill value={item.severity} /></Stack>
                  <Typography variant="body2" sx={{ mt: 0.8, color: "rgba(226,232,240,0.66)" }}>{item.content}</Typography>
                </Stack>
              ))}
            </Stack>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} lg={4}>
          <GlassPanel title="Onboarding and quick actions" subtitle="High-value setup steps and fast entry points">
            <Stack spacing={1.2}>
              <Typography variant="h4">{onboarding.summary.completion_percent}%</Typography>
              <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.66)" }}>{onboarding.summary.completed_steps} of {onboarding.summary.total_steps} steps complete</Typography>
              <Button variant="contained" onClick={() => navigate("/onboarding")}>Open onboarding</Button>
              <Button variant="outlined" onClick={() => navigate("/search")}>Open AI search</Button>
              {user.role === "SUPER_ADMIN" ? <Button variant="outlined" onClick={() => navigate("/control-center")}>Open command center</Button> : null}
            </Stack>
          </GlassPanel>
        </Grid>

        <Grid item xs={12} lg={6}>
          <GlassPanel title={user.role === "USER" ? "My next work" : "Execution lane"} subtitle="The items most likely to shape your next move">
            <Stack spacing={1.2}>
              {(user.role === "USER" ? personal.my_tasks : summary.focus_items).map((item) => (
                <Stack key={item.id || item.title} sx={{ p: 1.5, borderRadius: 3.5, bgcolor: "rgba(255,255,255,0.03)" }}>
                  <Typography variant="subtitle2">{item.title}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.7, color: "rgba(226,232,240,0.62)" }}>{item.subtitle || item.status || "Work item"}</Typography>
                </Stack>
              ))}
            </Stack>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} lg={6}>
          <GlassPanel title={user.role === "USER" ? "Personal context" : "Team and risk watch"} subtitle={user.role === "USER" ? "Notes, meetings, and recommended next steps" : "Likely misses, onboarding drift, and operational pressure"}>
            <Stack spacing={1.2}>
              {(user.role === "USER" ? [...notes.slice(0, 2), ...meetings.slice(0, 2)] : risk.slice(0, 4)).map((item) => (
                <Stack key={item.id || item.task_id} sx={{ p: 1.5, borderRadius: 3.5, bgcolor: "rgba(255,255,255,0.03)" }}>
                  <Typography variant="subtitle2">{item.title}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.7, color: "rgba(226,232,240,0.62)" }}>{item.summary || item.content || item.reasons?.join(" - ")}</Typography>
                </Stack>
              ))}
              {onboardingOverview ? <Chip label={`Users in onboarding: ${onboardingOverview.users_in_progress}`} color="secondary" /> : null}
            </Stack>
          </GlassPanel>
        </Grid>
      </Grid>
    </>
  );
}

export default DashboardPage;
