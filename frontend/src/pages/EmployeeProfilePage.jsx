import { useEffect, useState } from "react";
import { Alert, Avatar, Chip, Stack, Typography } from "@mui/material";
import { useParams } from "react-router-dom";
import { usersApi } from "../api/endpoints";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";

function EmployeeProfilePage() {
  const { userId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    usersApi.profile(userId).then((response) => {
      setData(response.data);
      setError("");
    }).catch((requestError) => setError(requestError.response?.data?.detail || "Unable to load employee profile"));
  }, [userId]);

  return (
    <>
      {data ? (
        <PageHeader
          eyebrow={data.user.organization?.name || "Profile"}
          title={data.user.full_name}
          description="A full internal employee profile with work context, profile completeness, approvals, activity, meetings, and linked operational signals."
          actions={[
            <Chip key="role" label={data.user.role} color="secondary" />,
            <Chip key="status" label={data.user.is_active ? "Active" : "Inactive"} color={data.user.is_active ? "success" : "default"} />,
          ]}
        />
      ) : (
        <PageHeader eyebrow="Profile" title="Employee profile" description="Loading profile details..." />
      )}
      {error ? <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert> : null}
      {data ? (
        <Grid container spacing={3}>
          <Grid item xs={12} xl={4}>
            <Stack spacing={3}>
              <GlassPanel title="Identity" subtitle="Role, team, responsibilities, and organization context">
                <Stack spacing={1.4}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ width: 56, height: 56, bgcolor: "secondary.main" }}>
                      {data.user.full_name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                    </Avatar>
                    <Stack>
                      <Typography variant="h6">{data.user.full_name}</Typography>
                      <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.66)" }}>{data.user.title}</Typography>
                    </Stack>
                  </Stack>
                  <Typography variant="body2">Email: {data.user.email}</Typography>
                  <Typography variant="body2">Team: {data.user.team?.name || "No team assigned"}</Typography>
                  <Typography variant="body2">Organization: {data.user.organization?.name}</Typography>
                  <Typography variant="body2">Joined: {new Date(data.user.created_at).toLocaleDateString()}</Typography>
                  <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.68)" }}>{data.user.responsibilities}</Typography>
                </Stack>
              </GlassPanel>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4} xl={12}><MetricCard label="Profile completion" value={`${data.profile_completion_percent}%`} helper="Identity and setup completeness" accent="rgba(116,184,255,0.24)" /></Grid>
                <Grid item xs={12} md={4} xl={12}><MetricCard label="Assigned tasks" value={data.activity_summary.assigned_tasks} helper="Current delivery load" accent="rgba(245,165,36,0.22)" /></Grid>
                <Grid item xs={12} md={4} xl={12}><MetricCard label="Unread alerts" value={data.activity_summary.unread_notifications} helper="Signals needing review" accent="rgba(255,107,122,0.22)" /></Grid>
              </Grid>
            </Stack>
          </Grid>
          <Grid item xs={12} xl={8}>
            <Stack spacing={3}>
              <GlassPanel title="Assigned work" subtitle="Current execution responsibilities">
                <Stack spacing={1.2}>
                  {data.assigned_tasks.map((item) => (
                    <Stack key={item.id} sx={{ p: 1.5, borderRadius: 3.5, bgcolor: "rgba(255,255,255,0.03)" }}>
                      <Typography variant="subtitle2">{item.title}</Typography>
                      <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.66)" }}>{item.status} - {item.priority}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </GlassPanel>
              <Grid container spacing={3}>
                <Grid item xs={12} lg={6}>
                  <GlassPanel title="Recent notifications" subtitle="Latest relevant alerts and announcements">
                    <Stack spacing={1.2}>
                      {data.recent_notifications.map((item) => (
                        <Typography key={item.id} variant="body2">{item.title} - {item.type}</Typography>
                      ))}
                    </Stack>
                  </GlassPanel>
                </Grid>
                <Grid item xs={12} lg={6}>
                  <GlassPanel title="Approvals and watched work" subtitle="Review queues and work this person follows">
                    <Stack spacing={1.2}>
                      {data.approvals.map((item) => (
                        <Typography key={item.id} variant="body2">{item.title} - {item.status}</Typography>
                      ))}
                      {data.watched_tasks.map((item) => (
                        <Typography key={`watch-${item.id}`} variant="body2">{item.title} - watched</Typography>
                      ))}
                    </Stack>
                  </GlassPanel>
                </Grid>
              </Grid>
              <GlassPanel title="Recent activity" subtitle="Task changes, comments, and meetings">
                <Stack spacing={1.2}>
                  {data.recent_activity.map((item) => (
                    <Typography key={item.id} variant="body2">{item.label}</Typography>
                  ))}
                  {data.recent_meetings.map((item) => (
                    <Typography key={`meeting-${item.id}`} variant="body2">Meeting: {item.title}</Typography>
                  ))}
                </Stack>
              </GlassPanel>
            </Stack>
          </Grid>
        </Grid>
      ) : null}
    </>
  );
}

export default EmployeeProfilePage;
