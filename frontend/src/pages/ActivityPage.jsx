import { useEffect, useState } from "react";
import { Chip, Stack, Typography } from "@mui/material";
import { adminApi, usersApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import PageState from "../components/PageState";
import StatusPill from "../components/StatusPill";
import { useAuth } from "../store/AuthContext";
import { useRealtime } from "../store/RealtimeContext";

function ActivityPage() {
  const { user, activeOrganizationId, scopedOrganization } = useAuth();
  const { versions, connectionState } = useRealtime();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      if (user.role === "USER") {
        const response = await usersApi.myDashboard();
        setItems(response.data.recent_activity);
      } else {
        const response = await adminApi.activity({ organization_id: activeOrganizationId || undefined });
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
          <Stack spacing={1.4}>
            {items.map((item, index) => (
              <Stack key={item.id || `${item.label}-${index}`} direction={{ xs: "column", md: "row" }} justifyContent="space-between" sx={{ p: 2, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)" }}>
                <div>
                  <Typography variant="subtitle2">{item.message || item.label}</Typography>
                  <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.64)" }}>
                    {item.detail || item.event_type || "Activity update"}
                  </Typography>
                </div>
                {item.event_type ? <StatusPill value={item.event_type} /> : null}
              </Stack>
            ))}
          </Stack>
        ) : null}
      </GlassPanel>
    </>
  );
}

export default ActivityPage;
