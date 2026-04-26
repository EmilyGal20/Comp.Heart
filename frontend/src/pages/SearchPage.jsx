import { useEffect, useMemo, useState } from "react";
import { Close } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { searchApi } from "../api/endpoints";
import CardListScroll from "../components/CardListScroll";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import PageState from "../components/PageState";
import { useAuth } from "../store/AuthContext";

function SearchPage() {
  const navigate = useNavigate();
  const { user, activeOrganizationId } = useAuth();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("global");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const groups = useMemo(() => (Array.isArray(data?.groups) ? data.groups : []), [data]);
  const hasResults = groups.some((group) => Array.isArray(group.items) && group.items.length > 0);

  useEffect(() => {
    if (query.trim().length < 2) {
      setData(null);
      setError("");
      setLoading(false);
      return undefined;
    }

    let active = true;
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response =
          mode === "ai"
            ? await searchApi.ai({
                query,
                organization_id: user.role === "SUPER_ADMIN" ? activeOrganizationId || undefined : undefined,
              })
            : await searchApi.global({
                q: query,
                organization_id: user.role === "SUPER_ADMIN" ? activeOrganizationId || undefined : undefined,
              });
        if (!active) return;
        setData(response.data);
        setError("");
      } catch (requestError) {
        if (!active) return;
        setError(requestError.response?.data?.detail || "Unable to search right now");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [activeOrganizationId, mode, query, user.role]);

  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/", { replace: true });
  };

  return (
    <Dialog
      open
      onClose={handleClose}
      fullWidth
      maxWidth="lg"
      disableScrollLock
      PaperProps={{
        sx: {
          borderRadius: 3,
          minHeight: { xs: "100%", sm: "78vh" },
          backgroundImage: "none",
        },
      }}
    >
      <DialogContent sx={{ p: { xs: 2, md: 3 }, display: "flex", flexDirection: "column", gap: 2.5 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
        >
          <Box>
            <Typography variant="overline" color="text.secondary">
              Search
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.4 }}>
              Search across COMP.HEART
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8, maxWidth: 720 }}>
              Explore tasks, knowledge, meetings, announcements, people, approvals, and discussion threads without leaving your current flow.
            </Typography>
          </Box>
          <IconButton onClick={handleClose} aria-label="Close search">
            <Close />
          </IconButton>
        </Stack>

        <GlassPanel title="Search console" subtitle="Describe the work, person, process, or question you need and CompHeart will search the relevant surfaces.">
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
              <TextField
                fullWidth
                autoFocus
                label="Ask anything across CompHeart"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Show me overdue onboarding tasks for support"
              />
              <Stack direction="row" spacing={1}>
                <Button variant={mode === "global" ? "contained" : "outlined"} onClick={() => setMode("global")}>
                  Global
                </Button>
                <Button variant={mode === "ai" ? "contained" : "outlined"} onClick={() => setMode("ai")}>
                  AI mode
                </Button>
              </Stack>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Press <strong>Esc</strong> or click outside this overlay to close and return to your previous screen.
            </Typography>
          </Stack>
        </GlassPanel>

        {error ? <Alert severity="error">{error}</Alert> : null}

        <Box sx={{ flex: 1, minHeight: 320 }}>
          <PageState
            loading={loading}
            error={error}
            empty={!loading && !error && query.trim().length >= 2 && !hasResults}
            title={
              query.trim().length < 2
                ? "Start with a quick question"
                : "No results matched your query"
            }
            description={
              query.trim().length < 2
                ? "Try a task, document, person, or process name to see grouped results across the workspace."
                : "Try a broader phrase, fewer constraints, or switch between global and AI search modes."
            }
          />

          {!loading && !error && hasResults ? (
            <Grid container spacing={3} sx={{ mt: 0.5 }}>
              {groups.map((group) => {
                const items = Array.isArray(group.items) ? group.items : [];
                if (!items.length) {
                  return null;
                }
                return (
                  <Grid key={group.type} size={{ xs: 12, lg: 6 }}>
                    <GlassPanel title={group.label} subtitle={`${group.count || items.length} results`}>
                      <CardListScroll count={items.length} rowEstimatePx={96}>
                      <Stack spacing={1.25}>
                        {items.map((item) => (
                          <Stack
                            key={`${group.type}-${item.id}`}
                            component={item.path ? "button" : "div"}
                            type={item.path ? "button" : undefined}
                            spacing={0.8}
                            onClick={() => {
                              if (item.path) navigate(item.path);
                            }}
                            sx={{
                              p: 1.6,
                              borderRadius: 2.5,
                              bgcolor: "action.hover",
                              border: "none",
                              textAlign: "left",
                              width: "100%",
                              cursor: item.path ? "pointer" : "default",
                              font: "inherit",
                              color: "inherit",
                            }}
                          >
                            <Stack direction="row" justifyContent="space-between" spacing={1}>
                              <Typography variant="subtitle2">{item.title}</Typography>
                              <Chip size="small" label={item.type} variant="outlined" />
                            </Stack>
                            {item.subtitle ? (
                              <Typography variant="body2" color="text.secondary">
                                {item.subtitle}
                              </Typography>
                            ) : null}
                            {item.snippet ? <Typography variant="body2">{item.snippet}</Typography> : null}
                            {item.path ? (
                              <Typography variant="caption" color="text.secondary">
                                {item.path}
                              </Typography>
                            ) : null}
                          </Stack>
                        ))}
                      </Stack>
                      </CardListScroll>
                    </GlassPanel>
                  </Grid>
                );
              })}
            </Grid>
          ) : null}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export default SearchPage;
