import { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import { onboardingApi } from "../api/endpoints";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import { useRealtime } from "../store/RealtimeContext";
import { borderSubtle, successTintBox, surfaceSubtle } from "../styles/muiSurfaces";

function OnboardingPage() {
  const { versions } = useRealtime();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const response = await onboardingApi.me();
      setData(response.data);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load onboarding");
    }
  };

  useEffect(() => {
    load();
  }, [versions.activity, versions.notifications, versions.users]);

  const toggleStep = async (step) => {
    await onboardingApi.updateStep(step.id, { is_completed: !step.is_completed });
    await load();
  };

  return (
    <>
      <PageHeader
        eyebrow="Onboarding"
        title="Welcome flow and first-step guidance"
        description="A role-aware onboarding workspace with progress tracking, recommended docs, contacts, tasks, and the actions most useful for your first week."
      />
      {error ? <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert> : null}
      {data ? (
        <Grid container spacing={3}>
          <Grid item xs={12} lg={8}>
            <GlassPanel title="Checklist" subtitle="Complete the setup steps that unlock a faster first week">
              <Stack spacing={1.4}>
                <LinearProgress variant="determinate" value={data.summary.completion_percent} sx={{ height: 10, borderRadius: 999 }} />
                {data.steps.map((step) => (
                  <Box key={step.id} sx={{ p: 1.7, borderRadius: 3.5, bgcolor: (theme) => (step.is_completed ? successTintBox(theme) : surfaceSubtle(theme)), border: (theme) => `1px solid ${borderSubtle(theme)}` }}>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.25}>
                      <Box>
                        <Typography variant="subtitle2">{step.title}</Typography>
                        <Typography variant="body2" sx={{ mt: 0.7, color: "text.secondary" }}>{step.description}</Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Chip size="small" label={step.step_type} variant="outlined" />
                        <Chip size="small" label={step.is_completed ? "Completed" : "Open"} color={step.is_completed ? "success" : "warning"} />
                        <Button size="small" variant={step.is_completed ? "outlined" : "contained"} onClick={() => toggleStep(step)}>
                          {step.is_completed ? "Mark open" : "Complete"}
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </GlassPanel>
          </Grid>
          <Grid item xs={12} lg={4}>
            <Stack spacing={3}>
              <GlassPanel title="Progress" subtitle="How far you are through the initial setup">
                <Stack spacing={1}>
                  <Typography variant="h3">{data.summary.completion_percent}%</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>{data.summary.completed_steps} of {data.summary.total_steps} steps completed</Typography>
                  <Chip label={`Profile completeness ${data.summary.profile_completion_percent}%`} color="secondary" />
                </Stack>
              </GlassPanel>
              <GlassPanel title="Recommended docs" subtitle="Best starting documents">
                <Stack spacing={1.2}>
                  {data.summary.recommended_documents.map((item) => (
                    <Box key={item.id}>
                      <Typography variant="subtitle2">{item.title}</Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>{item.summary}</Typography>
                    </Box>
                  ))}
                </Stack>
              </GlassPanel>
              <GlassPanel title="Key contacts" subtitle="People you may want right away">
                <Stack spacing={1.2}>
                  {data.summary.key_contacts.map((item) => (
                    <Box key={item.id}>
                      <Typography variant="subtitle2">{item.full_name}</Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>{item.title}{item.team ? ` - ${item.team}` : ""}</Typography>
                    </Box>
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

export default OnboardingPage;
