import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Snackbar } from "@mui/material";
import { useAuth } from "./AuthContext";
import { API_BASE_URL, APP_AUTH_EXPIRED_EVENT } from "../api/client";

const RealtimeContext = createContext(null);

function shouldBump(kind, eventType) {
  if (kind === "notifications") return eventType.startsWith("notification") || eventType === "task_mentioned" || eventType.startsWith("announcement_");
  if (kind === "tasks") return eventType.startsWith("task_");
  if (kind === "chat") return eventType.startsWith("chat_") || eventType === "task_message_created";
  if (kind === "analytics") return eventType.includes("approval") || eventType.includes("recurring") || eventType.includes("task_") || eventType === "meeting_tasks_created" || eventType === "onboarding_updated";
  if (kind === "activity") return eventType.startsWith("task_") || eventType.startsWith("announcement_") || eventType.startsWith("meeting_") || eventType === "organization_updated" || eventType === "user_updated" || eventType === "onboarding_updated";
  if (kind === "organizations") return eventType.startsWith("organization_");
  if (kind === "users") return eventType === "user_updated" || eventType === "onboarding_updated";
  return false;
}

export function RealtimeProvider({ children }) {
  const { token, user, activeOrganizationId, isAuthenticated } = useAuth();
  const socketRef = useRef(null);
  const reconnectRef = useRef(null);
  const shouldReconnectRef = useRef(false);
  const generationRef = useRef(0);
  const toastKeyRef = useRef("");
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
    const closeSocket = (intentional = false) => {
      shouldReconnectRef.current = !intentional && shouldReconnectRef.current;
      if (reconnectRef.current) {
        window.clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      if (socketRef.current) {
        const socket = socketRef.current;
        socketRef.current = null;
        // if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        //   socket.close(1000, "client_reset");
        // }
        if (socket.readyState === WebSocket.OPEN) {
  socket.close(1000, "client_reset");
}
      }
    };

    if (!isAuthenticated || !token || !user) {
      shouldReconnectRef.current = false;
      closeSocket(true);
      setConnectionState("idle");
      return undefined;
    }

    const url = new URL(API_BASE_URL.replace(/\/api$/, "/ws/live"));
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("token", token);
    if (user.role === "SUPER_ADMIN" && activeOrganizationId) {
      url.searchParams.set("scope_org_id", String(activeOrganizationId));
    }

    shouldReconnectRef.current = true;
    const connect = () => {
      const generation = ++generationRef.current;
      const hadSocket = Boolean(socketRef.current);
      closeSocket(true);
      setConnectionState(hadSocket ? "reconnecting" : "connecting");
      const socket = new WebSocket(url.toString());
      socketRef.current = socket;

      socket.onopen = () => {
        if (generation !== generationRef.current) return;
        setConnectionState("connected");
      };

      socket.onmessage = (event) => {
        if (generation !== generationRef.current) return;
        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
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

        const toastKey = `${payload.event_type}:${payload.timestamp || ""}:${payload.data?.message || payload.data?.title || ""}`;
        if (payload.event_type !== "connection_ready" && toastKey !== toastKeyRef.current) {
          toastKeyRef.current = toastKey;
          setToast({
            severity: payload.event_type === "task_mentioned" ? "info" : payload.data?.severity || "success",
            message: payload.data?.message || payload.data?.title || payload.event_type,
          });
        }
      };

      socket.onclose = (event) => {
        if (generation !== generationRef.current) return;
        socketRef.current = null;
        if (!shouldReconnectRef.current) {
          setConnectionState("idle");
          return;
        }
        if (event.code === 4401 || event.code === 4403) {
          shouldReconnectRef.current = false;
          setConnectionState("auth_required");
          window.dispatchEvent(new CustomEvent(APP_AUTH_EXPIRED_EVENT, { detail: { message: "Realtime session expired" } }));
          return;
        }
        setConnectionState("reconnecting");
        if (reconnectRef.current) {
          window.clearTimeout(reconnectRef.current);
        }
        reconnectRef.current = window.setTimeout(connect, 2500);
      };

      socket.onerror = () => {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      };
    };

    connect();
    return () => {
      shouldReconnectRef.current = false;
      closeSocket(true);
      setConnectionState("idle");
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
