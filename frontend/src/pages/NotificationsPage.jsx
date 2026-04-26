import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { notificationsApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import PageState from "../components/PageState";
import PaginationControls from "../components/PaginationControls";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../store/AuthContext";
import { useRealtime } from "../store/RealtimeContext";
import { borderSubtle, brandSurfaceSelected, surfaceSubtle, surfaceSubtleEmphasis2 } from "../styles/muiSurfaces";

function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const { activeOrganizationId, user } = useAuth();
  const { versions, connectionState } = useRealtime();
  const [filters, setFilters] = useState({ severity: "", type: "", source: "", unread_only: "false", search: "" });
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      const response = await notificationsApi.list({
        paginated: true,
        page,
        page_size: 20,
        severity: filters.severity || undefined,
        type: filters.type || undefined,
        source: filters.source || undefined,
        search: filters.search || undefined,
        organization_id: user.role === "SUPER_ADMIN" ? activeOrganizationId || undefined : undefined,
        unread_only: filters.unread_only === "true",
      });
      setNotifications(response.data.items || []);
      setMeta(response.data.meta || null);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filters.severity, filters.type, filters.source, filters.unread_only, filters.search, activeOrganizationId, versions.notifications, page]);

  useEffect(() => {
    setPage(1);
  }, [filters.severity, filters.type, filters.source, filters.unread_only, filters.search, activeOrganizationId]);

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;
  const grouped = useMemo(() => ({
    important: notifications.filter((item) => !item.is_read && ["high", "critical"].includes(item.severity)),
    recent: notifications.filter((item) => new Date(item.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)),
    older: notifications.filter((item) => new Date(item.created_at) <= new Date(Date.now() - 24 * 60 * 60 * 1000)),
  }), [notifications]);

  const bulkRead = async () => {
    if (!selectedIds.length) return;
    try {
      setActionLoading(true);
      await notificationsApi.bulkRead(selectedIds);
      setSelectedIds([]);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to update notifications");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Signals Center"
        title="Advanced notification center"
        description="A cleaner alert workspace with grouped notifications, severity filters, live delivery, and bulk actions across the signals you are allowed to see."
        actions={[
          <Chip key="unread" label={`${unreadCount} unread`} color={unreadCount ? "error" : "default"} />,
          <Chip key="live" label={`Realtime ${connectionState}`} color={connectionState === "connected" ? "success" : "default"} variant="outlined" />,
          <Button
            key="all-read"
            variant="outlined"
            disabled={actionLoading}
            onClick={async () => {
              try {
                setActionLoading(true);
                await notificationsApi.markAllRead({ organization_id: user.role === "SUPER_ADMIN" ? activeOrganizationId || undefined : undefined });
                await load();
              } catch (requestError) {
                setError(requestError.response?.data?.detail || "Unable to update notifications");
              } finally {
                setActionLoading(false);
              }
            }}
          >
            Mark all read
          </Button>,
        ]}
      />
      {error ? <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert> : null}
      <GlassPanel
        title="Filters"
        subtitle="Search and narrow alerts by severity, type, source, and read state"
        action={<Button variant="contained" disabled={!selectedIds.length || actionLoading} onClick={bulkRead}>{actionLoading ? "Updating..." : "Mark selected read"}</Button>}
      >
        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.2} flexWrap="wrap" useFlexGap>
          <TextField size="small" label="Search" value={filters.search} onChange={(event) => setFilters((previous) => ({ ...previous, search: event.target.value }))} />
          <TextField select size="small" label="Severity" value={filters.severity} onChange={(event) => setFilters((previous) => ({ ...previous, severity: event.target.value }))}>
            <MenuItem value="">All</MenuItem>
            {["low", "medium", "high", "critical"].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Type" value={filters.type} onChange={(event) => setFilters((previous) => ({ ...previous, type: event.target.value }))}>
            <MenuItem value="">All</MenuItem>
            {["task", "approval", "mention", "announcement", "automation", "sla", "knowledge"].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Read state" value={filters.unread_only} onChange={(event) => setFilters((previous) => ({ ...previous, unread_only: event.target.value }))}>
            <MenuItem value="false">All</MenuItem>
            <MenuItem value="true">Unread only</MenuItem>
          </TextField>
        </Stack>
      </GlassPanel>
      <Stack spacing={3} sx={{ mt: 3 }}>
        <PageState
          loading={loading}
          error={error}
          empty={!loading && !error && notifications.length === 0}
          title="No notifications match this view"
          description="Try widening the filters or switch back to all alerts."
          onRetry={load}
          minHeight={180}
        />
        {[["Pinned and urgent", grouped.important], ["Recent", grouped.recent], ["Older", grouped.older]].map(([label, items]) => (
          <GlassPanel key={label} title={label} subtitle={`${items.length} notifications`}>
            <Stack spacing={1.3}>
              {items.length ? items.map((notification) => {
                const selected = selectedIds.includes(notification.id);
                return (
                  <Box key={notification.id} onClick={() => setSelectedIds((previous) => selected ? previous.filter((id) => id !== notification.id) : [...previous, notification.id])} sx={{ p: 1.8, borderRadius: 2.5, cursor: "pointer", bgcolor: (theme) => (selected ? brandSurfaceSelected(theme) : notification.is_read ? surfaceSubtle(theme) : surfaceSubtleEmphasis2(theme)), border: (theme) => `1px solid ${borderSubtle(theme)}` }}>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.4}>
                      <Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 0.8 }}>
                          <Typography variant="subtitle2">{notification.title}</Typography>
                          <Chip size="small" label={notification.severity} color={notification.severity === "critical" ? "error" : notification.severity === "high" ? "warning" : "default"} />
                          <Chip size="small" variant="outlined" label={notification.type} />
                          {notification.is_org_wide ? <Chip size="small" variant="outlined" label="Org-wide" /> : null}
                        </Stack>
                        <Typography variant="body2" color="text.secondary">{notification.message}</Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {!notification.is_read ? <Button size="small" disabled={actionLoading} onClick={async (event) => { event.stopPropagation(); try { setActionLoading(true); await notificationsApi.markRead(notification.id); await load(); } catch (requestError) { setError(requestError.response?.data?.detail || "Unable to update notifications"); } finally { setActionLoading(false); } }}>Mark read</Button> : <Chip size="small" variant="outlined" label="Read" />}
                      </Stack>
                    </Stack>
                  </Box>
                );
              }) : <Typography variant="body2" color="text.secondary">Nothing here right now.</Typography>}
            </Stack>
          </GlassPanel>
        ))}
        <PaginationControls meta={meta} onChange={setPage} disabled={loading} />
      </Stack>
    </>
  );
}

export default NotificationsPage;
