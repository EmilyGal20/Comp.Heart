import { useEffect, useState } from "react";
import { Alert, Button, Chip, Stack, TextField, Typography } from "@mui/material";
import { searchApi } from "../api/endpoints";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import PageState from "../components/PageState";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../store/AuthContext";

function SearchPage() {
  const { user, activeOrganizationId } = useAuth();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("global");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setData(null);
      setError("");
      return;
    }
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = mode === "ai"
          ? await searchApi.ai({ query, organization_id: user.role === "SUPER_ADMIN" ? activeOrganizationId || undefined : undefined })
          : await searchApi.global({ q: query, organization_id: user.role === "SUPER_ADMIN" ? activeOrganizationId || undefined : undefined });
        setData(response.data);
        setError("");
      } catch (requestError) {
        setError(requestError.response?.data?.detail || "Unable to search");
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [activeOrganizationId, mode, query, user.role]);

  return (
    <>
      <PageHeader
        eyebrow="Search"
        title="AI search across the platform"
        description="Search tasks, knowledge, meetings, announcements, people, approvals, and discussions from one permission-aware workspace."
        actions={[
          <Button key="global" variant={mode === "global" ? "contained" : "outlined"} onClick={() => setMode("global")}>Global</Button>,
          <Button key="ai" variant={mode === "ai" ? "contained" : "outlined"} onClick={() => setMode("ai")}>AI mode</Button>,
        ]}
      />
      <GlassPanel title="Search console" subtitle="Natural language works best when you describe the work, person, or process you need">
        <TextField fullWidth label="Ask anything across CompHeart" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Show me overdue onboarding tasks for support" />
      </GlassPanel>
      <PageState
        loading={loading}
        error={error}
        empty={!loading && !error && query.trim().length >= 2 && (!data?.groups || data.groups.every((group) => !group.items?.length))}
        title="No results matched your query"
        description="Try a different phrase, broader role, or fewer constraints."
      />
      {data ? (
        <Grid container spacing={3} sx={{ mt: 0.5 }}>
          {data.groups.map((group) => (
            <Grid item xs={12} lg={6} key={group.type}>
              <GlassPanel title={group.label} subtitle={`${group.count} results`}>
                <Stack spacing={1.25}>
                  {group.items.map((item) => (
                    <Stack key={item.id} sx={{ p: 1.6, borderRadius: 3.5, bgcolor: "rgba(255,255,255,0.03)" }} spacing={0.8}>
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Typography variant="subtitle2">{item.title}</Typography>
                        <Chip size="small" label={item.type} variant="outlined" />
                      </Stack>
                      {item.subtitle ? <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.72)" }}>{item.subtitle}</Typography> : null}
                      {item.snippet ? <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.60)" }}>{item.snippet}</Typography> : null}
                      {item.path ? <Typography variant="caption" sx={{ color: "rgba(148,163,184,0.9)" }}>{item.path}</Typography> : null}
                    </Stack>
                  ))}
                </Stack>
              </GlassPanel>
            </Grid>
          ))}
        </Grid>
      ) : null}
    </>
  );
}

export default SearchPage;
