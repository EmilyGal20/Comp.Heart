import { useEffect, useState } from "react";
import { Button, Chip, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { adminApi, announcementsApi, approvalsApi, analyticsApi, dashboardApi, meetingsApi, onboardingApi, selfNotesApi, usersApi } from "../api/endpoints";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import MetricCard from "../components/MetricCard";
import PageState from "../components/PageState";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";
import { useAuth } from "../store/AuthContext";
import { useRealtime } from "../store/RealtimeContext";
import { brandSurfacePinned, surfaceSubtle } from "../styles/muiSurfaces";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const params = activeOrganizationId ? { organization_id: activeOrganizationId } : {};
  const announcementItems = announcements.slice(0, 4);
  const executionItems = user.role === "USER" ? personal?.my_tasks || [] : summary?.focus_items || [];
  const contextItems =
    user.role === "USER"
      ? [
          ...notes.slice(0, 2).map((item) => ({ ...item, _kind: "note" })),
          ...meetings.slice(0, 2).map((item) => ({ ...item, _kind: "meeting" })),
        ]
      : risk.slice(0, 4);

  const load = async () => {
    setLoading(true);
    const requests = await Promise.allSettled([
      dashboardApi.summary(params),
      usersApi.myDashboard(),
      announcementsApi.list({ important_only: true, ...params }),
      approvalsApi.dashboard(params),
      analyticsApi.slaRisk(params),
      selfNotesApi.list(),
      meetingsApi.list({ paginated: true, page: 1, page_size: 4 }),
      onboardingApi.me(),
      ["ADMIN", "MANAGER", "SUPER_ADMIN"].includes(user.role)
        ? (user.role === "SUPER_ADMIN" && !activeOrganizationId ? Promise.resolve({ data: null }) : adminApi.onboardingOverview(user.role === "SUPER_ADMIN" ? params : {}))
        : Promise.resolve({ data: null }),
    ]);

    const [summaryResponse, personalResponse, announcementResponse, approvalResponse, riskResponse, notesResponse, meetingsResponse, onboardingResponse, onboardingOverviewResponse] = requests;

    if (summaryResponse.status === "fulfilled") setSummary(summaryResponse.value.data);
    if (personalResponse.status === "fulfilled") setPersonal(personalResponse.value.data);
    if (announcementResponse.status === "fulfilled") setAnnouncements(Array.isArray(announcementResponse.value.data) ? announcementResponse.value.data : announcementResponse.value.data.items || []);
    if (approvalResponse.status === "fulfilled") setApprovals(approvalResponse.value.data);
    if (riskResponse.status === "fulfilled") setRisk(riskResponse.value.data);
    if (notesResponse.status === "fulfilled") setNotes(Array.isArray(notesResponse.value.data) ? notesResponse.value.data : notesResponse.value.data.items || []);
    if (meetingsResponse.status === "fulfilled") setMeetings(Array.isArray(meetingsResponse.value.data) ? meetingsResponse.value.data : meetingsResponse.value.data.items || []);
    if (onboardingResponse.status === "fulfilled") setOnboarding(onboardingResponse.value.data);
    if (onboardingOverviewResponse.status === "fulfilled") setOnboardingOverview(onboardingOverviewResponse.value.data);

    const criticalError = [summaryResponse, personalResponse, approvalResponse, onboardingResponse].find((entry) => entry.status === "rejected");
    setError(criticalError?.reason?.response?.data?.detail || criticalError?.reason?.message || "");
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [activeOrganizationId, versions.activity, versions.notifications, versions.tasks, versions.analytics, versions.users]);

  return (
    <>
      <PageHeader
        eyebrow={summary?.scope_label || (user.role === "SUPER_ADMIN" ? "Global" : "Organization")}
        title={user.role === "USER" ? `Welcome back, ${user.full_name.split(" ")[0]}` : "Operational dashboard"}
        description="A more intentional daily workspace for onboarding progress, urgent messages, approvals, risk, and the work most likely to need your next move."
        actions={[
          <Chip key="scope" label={scopedOrganization?.name || "All organizations"} color="secondary" />,
          <Chip key="live" label={`Realtime ${connectionState}`} color={connectionState === "connected" ? "success" : "default"} />,
        ]}
      />
      <PageState
        loading={loading}
        error={error}
        empty={!loading && !error && (!summary || !personal || !approvals || !onboarding)}
        title="Dashboard data is temporarily unavailable"
        description="The core overview widgets could not be assembled yet. Retry to refresh the operational snapshot."
        onRetry={load}
      />
      {summary && personal && approvals && onboarding ? (
        <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 3 }}><MetricCard label={user.role === "USER" ? "My open tasks" : "Open tasks"} value={user.role === "USER" ? personal.summary.my_open_tasks : summary.open_tasks} helper="Current active load" accent="rgba(61,200,255,0.22)" /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><MetricCard label="Pending approvals" value={approvals.summary.pending_count} helper="Visible approval queue" accent="rgba(245,165,36,0.22)" /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><MetricCard label="At-risk tasks" value={risk.filter((item) => item.risk_level !== "low").length} helper="Predictive SLA pressure" accent="rgba(255,107,122,0.24)" /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><MetricCard label="Onboarding progress" value={`${onboarding.summary.completion_percent}%`} helper="Role-aware first-step completion" accent="rgba(57,217,138,0.18)" /></Grid>

        <Grid size={{ xs: 12, lg: 8 }}>
          <GlassPanel title="Important announcements" subtitle="Pinned updates, admin messages, and latest operating guidance" action={<Stack direction="row" spacing={1}><Button size="small" variant="outlined" onClick={() => navigate("/messages")}>Important messages</Button><Button size="small" variant="outlined" onClick={() => navigate("/announcements")}>All announcements</Button></Stack>}>
            <Stack spacing={1.4}>
              {announcementItems.length ? announcementItems.map((item) => (
                <Stack key={item.id} sx={{ p: 1.6, borderRadius: 2.5, bgcolor: (theme) => (item.is_pinned ? brandSurfacePinned(theme) : surfaceSubtle(theme)) }}>
                  <Stack direction="row" justifyContent="space-between"><Typography variant="subtitle2">{item.title}</Typography><StatusPill value={item.severity} /></Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>{item.content}</Typography>
                </Stack>
              )) : <Typography variant="body2" color="text.secondary">No important announcements right now.</Typography>}
            </Stack>
          </GlassPanel>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <GlassPanel title="Onboarding and quick actions" subtitle="High-value setup steps and fast entry points">
            <Stack spacing={1.2}>
              <Typography variant="h4">{onboarding.summary.completion_percent}%</Typography>
              <Typography variant="body2" color="text.secondary">{onboarding.summary.completed_steps} of {onboarding.summary.total_steps} steps complete</Typography>
              <Button variant="contained" onClick={() => navigate("/onboarding")}>Open onboarding</Button>
              <Button variant="outlined" onClick={() => navigate("/search")}>Open AI search</Button>
              {user.role === "SUPER_ADMIN" ? <Button variant="outlined" onClick={() => navigate("/control-center")}>Open command center</Button> : null}
            </Stack>
          </GlassPanel>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <GlassPanel title={user.role === "USER" ? "My next work" : "Execution lane"} subtitle="The items most likely to shape your next move">
            <Stack spacing={1.2}>
              {executionItems.length ? executionItems.map((item) => (
                <Stack key={item.id || item.title} sx={{ p: 1.5, borderRadius: 2.5, bgcolor: (theme) => surfaceSubtle(theme) }}>
                  <Typography variant="subtitle2">{item.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.7 }}>{item.subtitle || item.status || "Work item"}</Typography>
                </Stack>
              )) : <Typography variant="body2" color="text.secondary">Nothing urgent is queued right now.</Typography>}
            </Stack>
          </GlassPanel>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <GlassPanel title={user.role === "USER" ? "Personal context" : "Team and risk watch"} subtitle={user.role === "USER" ? "Notes, meetings, and recommended next steps" : "Likely misses, onboarding drift, and operational pressure"}>
            <Stack spacing={1.2}>
              {contextItems.length ? contextItems.map((item) => (
                <Stack
                  key={item.id || item.task_id}
                  onClick={item._kind === "meeting" && item.id != null ? () => navigate(`/meetings/${item.id}`) : undefined}
                  role={item._kind === "meeting" && item.id != null ? "button" : undefined}
                  sx={{
                    p: 1.5,
                    borderRadius: 2.5,
                    bgcolor: (theme) => surfaceSubtle(theme),
                    cursor: item._kind === "meeting" && item.id != null ? "pointer" : "default",
                    "&:focus-visible": item._kind === "meeting" ? { outline: "2px solid", outlineOffset: 2, outlineColor: "primary.main" } : undefined,
                  }}
                >
                  <Typography variant="subtitle2">{item.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.7 }}>{item.summary || item.content || item.reasons?.join(" - ")}</Typography>
                </Stack>
              )) : <Typography variant="body2" color="text.secondary">No additional context items are waiting right now.</Typography>}
              {onboardingOverview ? <Chip label={`Users in onboarding: ${onboardingOverview.users_in_progress}`} color="secondary" /> : null}
            </Stack>
          </GlassPanel>
        </Grid>
        </Grid>
      ) : null}
    </>
  );
}

export default DashboardPage;
