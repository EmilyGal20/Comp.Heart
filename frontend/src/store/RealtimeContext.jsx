import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Snackbar } from "@mui/material";
import { useAuth } from "./AuthContext";

const RealtimeContext = createContext(null);

function shouldBump(kind, eventType) {
  if (kind === "notifications") return eventType.startsWith("notification") || eventType === "task_mentioned";
  if (kind === "tasks") return eventType.startsWith("task_");
  if (kind === "chat") return eventType.startsWith("chat_") || eventType === "task_message_created";
  if (kind === "analytics") return eventType.includes("approval") || eventType.includes("recurring") || eventType.includes("task_");
  if (kind === "activity") return eventType.startsWith("task_") || eventType === "organization_updated" || eventType === "user_updated";
  if (kind === "organizations") return eventType.startsWith("organization_");
  if (kind === "users") return eventType === "user_updated";
  return false;
}

export function RealtimeProvider({ children }) {
  const { token, user, activeOrganizationId, isAuthenticated } = useAuth();
  const socketRef = useRef(null);
  const reconnectRef = useRef(null);
  const [connectionState, setConnectionState] = useState("idle");
  const [lastEvent, setLastEvent] = useState(null);
  const [versions, setVersions] = useState({
    notifications: 0,
    tasks: 0,
    chat: 0,
    analytics: 0,
    activity: 0,
    organizations: 0,
    users: 0,
  });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !token || !user) {
      setConnectionState("idle");
      if (socketRef.current) socketRef.current.close();
      return undefined;
    }

    let cancelled = false;
    const connect = () => {
      const scope = user.role === "SUPER_ADMIN" ? `&scope_org_id=${activeOrganizationId || ""}` : "";
      const socket = new WebSocket(`ws://localhost:7155/ws/live?token=${encodeURIComponent(token)}${scope}`);
      socketRef.current = socket;
      setConnectionState("connecting");

      socket.onopen = () => {
        if (!cancelled) setConnectionState("connected");
      };

      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        setLastEvent(payload);
        setVersions((previous) => {
          const next = { ...previous };
          Object.keys(next).forEach((key) => {
            if (shouldBump(key, payload.event_type)) {
              next[key] += 1;
            }
          });
          return next;
        });
        if (payload.event_type !== "connection_ready") {
          setToast({
            severity: payload.event_type === "task_mentioned" ? "info" : payload.data?.severity || "success",
            message: payload.data?.message || payload.data?.title || payload.event_type,
          });
        }
      };

      socket.onclose = () => {
        if (cancelled) return;
        setConnectionState("reconnecting");
        reconnectRef.current = window.setTimeout(connect, 2000);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [activeOrganizationId, isAuthenticated, token, user]);

  const value = useMemo(
    () => ({
      connectionState,
      lastEvent,
      versions,
    }),
    [connectionState, lastEvent, versions]
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
      <Snackbar open={Boolean(toast)} autoHideDuration={3800} onClose={() => setToast(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert onClose={() => setToast(null)} severity={toast?.severity || "info"} variant="filled" sx={{ width: "100%" }}>
          {toast?.message || ""}
        </Alert>
      </Snackbar>
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useRealtime must be used within RealtimeProvider");
  }
  return context;
}
