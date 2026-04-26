import { useEffect, useMemo, useState } from "react";
import { Box, Chip, FormControl, InputAdornment, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import Clear from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import { adminApi, usersApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import PageState from "../components/PageState";
import StatusPill from "../components/StatusPill";
import { useAuth } from "../store/AuthContext";
import { useRealtime } from "../store/RealtimeContext";
import { surfaceSubtle } from "../styles/muiSurfaces";

function normalizeActivityItem(item, index) {
  const eventType = item.event_type || item.type || "";
  const title = item.message || item.label || "";
  const subline = item.detail || (item.task_id != null ? `Task #${item.task_id}` : "") || (eventType ? String(eventType).replaceAll("_", " ") : "Activity");
  const createdAt = item.created_at ? new Date(item.created_at) : null;
  return {
    key: item.id != null ? `id-${item.id}` : `i-${index}-${String(item.created_at || "")}`,
    eventType,
    title,
    subline,
    createdAt,
  };
}

function withinDatePreset(createdAt, preset) {
  if (preset === "all" || !createdAt) return true;
  const now = Date.now();
  const ms = { "24h": 24 * 60 * 60 * 1000, "7d": 7 * 24 * 60 * 60 * 1000, "30d": 30 * 24 * 60 * 60 * 1000 }[preset];
  if (ms == null) return true;
  return now - createdAt.getTime() <= ms;
}

function matchesSearchTokens(row, q) {
  const t = String(q).trim().toLowerCase();
  if (!t) return true;
  const hay = [row.title, row.subline, row.eventType, row.eventType?.replaceAll("_", " ")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return t.split(/\s+/).every((w) => w && hay.includes(w));
}

function ActivityPage() {
  const { user, activeOrganizationId, scopedOrganization } = useAuth();
  const { versions, connectionState } = useRealtime();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [datePreset, setDatePreset] = useState("all");

  useEffect(() => {
    setSearch("");
    setTypeFilter("");
    setDatePreset("all");
  }, [activeOrganizationId, user.role]);

  const load = async () => {
    setLoading(true);
    try {
      if (user.role === "USER") {
        const response = await usersApi.myDashboard();
        setItems(response.data.recent_activity);
      } else {
        const response = await adminApi.activity({
          organization_id: activeOrganizationId || undefined,
          limit: 100,
        });
        setItems(response.data);
      }
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load activity");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [activeOrganizationId, user.role, versions.activity]);

  const rows = useMemo(() => (items && items.length ? items.map((item, index) => normalizeActivityItem(item, index)) : []), [items]);

  const typeOptions = useMemo(() => {
    const s = new Set();
    for (const r of rows) {
      if (r.eventType) s.add(r.eventType);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (typeFilter && row.eventType !== typeFilter) return false;
      if (!withinDatePreset(row.createdAt, datePreset)) return false;
      if (!matchesSearchTokens(row, search)) return false;
      return true;
    });
  }, [rows, typeFilter, datePreset, search]);

  return (
    <>
      <PageHeader
        eyebrow="Live Activity"
        title={user.role === "USER" ? "Recent work around your scope" : "Organization activity stream"}
        description="A realtime feed of task movement, collaboration, and operational changes filtered by your role and company scope."
        actions={[
          <Chip key="state" label={`Realtime ${connectionState}`} color={connectionState === "connected" ? "success" : "default"} />,
          <Chip key="scope" label={scopedOrganization?.name || "Global"} color="secondary" />,
        ]}
      />
      <GlassPanel title="Activity feed" subtitle="Newest updates first">
        <PageState
          loading={loading}
          error={error}
          empty={!loading && !error && (!items || items.length === 0)}
          title="No recent activity yet"
          description="New task updates, comments, announcements, and operational changes will appear here."
          onRetry={load}
        />
        {!loading && !error && items?.length ? (
          <>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              useFlexGap
              sx={{ mb: 1.5 }}
              alignItems={{ sm: "flex-start" }}
            >
              <TextField
                size="small"
                fullWidth
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search message, type, or task"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: search ? (
                    <InputAdornment position="end">
                      <Box
                        component="button"
                        type="button"
                        aria-label="Clear search"
                        onClick={() => setSearch("")}
                        sx={{ border: "none", p: 0, m: 0, bgcolor: "transparent", cursor: "pointer", display: "flex", color: "text.secondary" }}
                      >
                        <Clear fontSize="small" />
                      </Box>
                    </InputAdornment>
                  ) : null,
                }}
                sx={{ flex: 1, minWidth: 0 }}
              />
              <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 200 } }}>
                <InputLabel id="activity-type-filter">Event type</InputLabel>
                <Select
                  labelId="activity-type-filter"
                  value={typeFilter}
                  label="Event type"
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <MenuItem value="">
                    <em>All types</em>
                  </MenuItem>
                  {typeOptions.map((t) => (
                    <MenuItem key={t} value={t}>
                      {t.replaceAll("_", " ")}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 160 } }}>
                <InputLabel id="activity-date-preset">Time</InputLabel>
                <Select labelId="activity-date-preset" value={datePreset} label="Time" onChange={(e) => setDatePreset(e.target.value)}>
                  <MenuItem value="all">Any time</MenuItem>
                  <MenuItem value="24h">Last 24 hours</MenuItem>
                  <MenuItem value="7d">Last 7 days</MenuItem>
                  <MenuItem value="30d">Last 30 days</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
              {filteredRows.length === rows.length
                ? `${rows.length} ${rows.length === 1 ? "event" : "events"}`
                : `Showing ${filteredRows.length} of ${rows.length} events`}
            </Typography>
            {filteredRows.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 1 }}>
                No events match your filters. Try a different search, event type, or time range.
              </Typography>
            ) : (
              <Stack spacing={1.4}>
                {filteredRows.map((row) => (
                  <Stack
                    key={row.key}
                    direction={{ xs: "column", md: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", md: "center" }}
                    gap={1}
                    sx={{ p: 2, borderRadius: 3, bgcolor: (theme) => surfaceSubtle(theme) }}
                  >
                    <div>
                      <Typography variant="subtitle2">{row.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {row.subline}
                        {row.createdAt ? (
                          <>
                            {" "}
                            · {row.createdAt.toLocaleString()}
                          </>
                        ) : null}
                      </Typography>
                    </div>
                    {row.eventType ? <StatusPill value={row.eventType} /> : null}
                  </Stack>
                ))}
              </Stack>
            )}
          </>
        ) : null}
      </GlassPanel>
    </>
  );
}

export default ActivityPage;
