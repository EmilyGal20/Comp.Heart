import { useEffect, useState } from "react";
import { Button, Chip, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { notificationsApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../store/AuthContext";
import { useRealtime } from "../store/RealtimeContext";

function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const { activeOrganizationId, user } = useAuth();
  const { versions, connectionState } = useRealtime();
  const [filters, setFilters] = useState({ severity: "", type: "", unread_only: "false" });

  const load = () =>
    notificationsApi
      .list({
        severity: filters.severity || undefined,
        type: filters.type || undefined,
        organization_id: user.role === "SUPER_ADMIN" ? activeOrganizationId || undefined : undefined,
        unread_only: filters.unread_only === "true",
      })
      .then((response) => setNotifications(response.data));

  useEffect(() => {
    load();
  }, [filters, activeOrganizationId, versions.notifications]);

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  return (
    <>
      <PageHeader
        eyebrow="Signals Center"
        title="Notifications and segmented alerts"
        description="Filter personal, org-wide, and role-targeted notifications by urgency and unread state."
        actions={[
          <Chip key="unread" label={`${unreadCount} unread`} color={unreadCount ? "error" : "default"} />,
          <Chip key="live" label={`Realtime ${connectionState}`} color={connectionState === "connected" ? "success" : "default"} variant="outlined" />,
        ]}
      />
      <GlassPanel
        title="Notification center"
        subtitle="Scoped by your permissions and company context"
        action={
          <Stack direction="row" spacing={1.2}>
            <TextField select size="small" label="Severity" value={filters.severity} onChange={(event) => setFilters((previous) => ({ ...previous, severity: event.target.value }))} sx={{ minWidth: 130 }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
            </TextField>
            <TextField select size="small" label="Type" value={filters.type} onChange={(event) => setFilters((previous) => ({ ...previous, type: event.target.value }))} sx={{ minWidth: 140 }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="task">Task</MenuItem>
              <MenuItem value="mention">Mention</MenuItem>
              <MenuItem value="sla">SLA</MenuItem>
              <MenuItem value="automation">Automation</MenuItem>
            </TextField>
            <TextField select size="small" label="Read state" value={filters.unread_only} onChange={(event) => setFilters((previous) => ({ ...previous, unread_only: event.target.value }))} sx={{ minWidth: 140 }}>
              <MenuItem value="false">All</MenuItem>
              <MenuItem value="true">Unread only</MenuItem>
            </TextField>
          </Stack>
        }
      >
        <Stack spacing={1.5}>
          {notifications.map((notification) => (
            <Stack key={notification.id} direction={{ xs: "column", md: "row" }} justifyContent="space-between" sx={{ p: 2, borderRadius: 3, bgcolor: notification.is_read ? "rgba(255,255,255,0.02)" : "rgba(116,184,255,0.08)" }}>
              <div>
                <Stack direction="row" spacing={1} sx={{ mb: 0.75 }} flexWrap="wrap" useFlexGap>
                  <Typography variant="subtitle1">{notification.title}</Typography>
                  <Chip size="small" label={notification.severity} color={notification.severity === "critical" ? "error" : "info"} />
                  {notification.is_org_wide ? <Chip size="small" label="Org-wide" variant="outlined" /> : null}
                  {notification.role_target ? <Chip size="small" label={notification.role_target} variant="outlined" /> : null}
                </Stack>
                <Typography variant="body2" sx={{ color: "rgba(226, 232, 240, 0.66)" }}>{notification.message}</Typography>
              </div>
              {!notification.is_read ? <Button onClick={() => notificationsApi.markRead(notification.id).then(load)}>Mark read</Button> : null}
            </Stack>
          ))}
        </Stack>
      </GlassPanel>
    </>
  );
}

export default NotificationsPage;
