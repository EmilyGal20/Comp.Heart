import { useEffect, useState } from "react";
import { Button, Chip, CircularProgress, Grid, Stack, Typography } from "@mui/material";
import { usersApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";
import { useRealtime } from "../store/RealtimeContext";

function MyWorkPage() {
  const { versions } = useRealtime();
  const [data, setData] = useState(null);

  useEffect(() => {
    usersApi.myDashboard().then((response) => setData(response.data));
  }, [versions.activity, versions.tasks, versions.notifications]);

  if (!data) {
    return <CircularProgress />;
  }

  return (
    <>
      <PageHeader
        eyebrow="My Work"
        title="Your focus lane"
        description="Assigned work, watched tasks, recent mentions, and practical shortcuts to help you move quickly."
      />
      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={6}>
          <GlassPanel title="Assigned tasks" subtitle="What needs movement now">
            <Stack spacing={1.4}>
              {data.my_tasks.map((task) => (
                <Stack key={task.id} direction="row" justifyContent="space-between" sx={{ p: 1.5, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)" }}>
                  <div>
                    <Typography variant="subtitle2">{task.title}</Typography>
                    <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.64)" }}>
                      Due {task.due_at ? new Date(task.due_at).toLocaleString() : "TBD"}
                    </Typography>
                  </div>
                  <Stack direction="row" spacing={1}>
                    <StatusPill value={task.priority} />
                    <StatusPill value={task.status} />
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} lg={6}>
          <GlassPanel title="Watched tasks" subtitle="Work you asked to follow closely">
            <Stack spacing={1.4}>
              {data.watched_tasks.map((task) => (
                <Stack key={task.id} direction="row" justifyContent="space-between" sx={{ p: 1.5, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)" }}>
                  <Typography variant="subtitle2">{task.title}</Typography>
                  <StatusPill value={task.sla_status} />
                </Stack>
              ))}
            </Stack>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} lg={6}>
          <GlassPanel title="Mentions" subtitle="Places you were pulled into the conversation">
            <Stack spacing={1.4}>
              {data.mentions.map((mention) => (
                <Stack key={mention.id} sx={{ p: 1.5, borderRadius: 3, bgcolor: "rgba(116,184,255,0.08)" }}>
                  <Typography variant="subtitle2">{mention.title}</Typography>
                  <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.68)" }}>{mention.message}</Typography>
                </Stack>
              ))}
            </Stack>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} lg={6}>
          <GlassPanel title="AI shortcuts" subtitle="Jump into the assistant with useful prompts">
            <Stack spacing={1.2}>
              {[
                "Summarize my overdue work",
                "Show me blockers across my watched tasks",
                "Find the best docs for my current assignments",
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

export default MyWorkPage;
