import { useEffect, useMemo, useState } from "react";
import { Add, Forum, PersonAddAlt1, Send } from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { chatApi, organizationsApi, usersApi } from "../api/endpoints";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import PageState from "../components/PageState";
import { useAuth } from "../store/AuthContext";
import { useRealtime } from "../store/RealtimeContext";

const emptyChannel = { name: "", description: "", channel_type: "ORG", team_id: "", is_private: false };

function ChatPage() {
  const { user, activeOrganizationId } = useAuth();
  const { versions, connectionState } = useRealtime();
  const [channels, setChannels] = useState([]);
  const [selectedChannelId, setSelectedChannelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [teams, setTeams] = useState([]);
  const [people, setPeople] = useState([]);
  const [draft, setDraft] = useState("");
  const [channelOpen, setChannelOpen] = useState(false);
  const [directOpen, setDirectOpen] = useState(false);
  const [channelForm, setChannelForm] = useState(emptyChannel);
  const [channelSearch, setChannelSearch] = useState("");
  const [personSearch, setPersonSearch] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [startingDirect, setStartingDirect] = useState(false);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const orgId = activeOrganizationId || user.organization_id;

  const load = async () => {
    setLoading(true);
    try {
      const [channelResponse, teamResponse, peopleResponse] = await Promise.all([
        chatApi.channels({ organization_id: orgId }),
        organizationsApi.teams(orgId),
        usersApi.list({ paginated: true, page: 1, page_size: 100, organization_id: orgId }),
      ]);
      const channelItems = Array.isArray(channelResponse.data) ? channelResponse.data : [];
      const teamItems = Array.isArray(teamResponse.data) ? teamResponse.data : [];
      const userItems = Array.isArray(peopleResponse.data?.items)
        ? peopleResponse.data.items
        : Array.isArray(peopleResponse.data)
          ? peopleResponse.data
          : [];
      setChannels(channelItems);
      setTeams(teamItems);
      setPeople(userItems.filter((entry) => entry.id !== user.id));
      const nextChannelId = channelItems.some((item) => item.id === selectedChannelId)
        ? selectedChannelId
        : channelItems[0]?.id || null;
      setSelectedChannelId(nextChannelId);
      if (nextChannelId) {
        const messageResponse = await chatApi.messages(nextChannelId);
        setMessages(Array.isArray(messageResponse.data) ? messageResponse.data : []);
      } else {
        setMessages([]);
      }
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load chat workspace");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [orgId, versions.chat]);

  useEffect(() => {
    if (!selectedChannelId) return;
    chatApi
      .messages(selectedChannelId)
      .then((response) => setMessages(Array.isArray(response.data) ? response.data : []))
      .catch(() => setMessages([]));
  }, [selectedChannelId]);

  useEffect(() => {
    if (!directOpen) return;
    const timeout = window.setTimeout(() => {
      setPeopleLoading(true);
      usersApi
        .list({ paginated: true, page: 1, page_size: 100, organization_id: orgId, search: personSearch || undefined })
        .then((response) => {
          const userItems = Array.isArray(response.data?.items)
            ? response.data.items
            : Array.isArray(response.data)
              ? response.data
              : [];
          setPeople(userItems.filter((entry) => entry.id !== user.id));
        })
        .catch(() => setPeople([]))
        .finally(() => setPeopleLoading(false));
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [directOpen, orgId, personSearch, user.id]);

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedChannelId) || null,
    [channels, selectedChannelId]
  );

  const visibleChannels = useMemo(() => {
    const lowered = channelSearch.trim().toLowerCase();
    return channels.filter((channel) => {
      if (filterMode === "unread" && !channel.unread_count) return false;
      if (filterMode === "recent" && !channel.latest_message_preview) return false;
      if (filterMode === "direct" && channel.channel_type !== "DIRECT") return false;
      if (filterMode === "groups" && channel.channel_type === "DIRECT") return false;
      if (!lowered) return true;
      return `${channel.display_name || channel.name} ${channel.latest_message_preview || ""}`
        .toLowerCase()
        .includes(lowered);
    });
  }, [channelSearch, channels, filterMode]);

  const sendMessage = async () => {
    if (!draft.trim() || !selectedChannel) return;
    try {
      setSending(true);
      await chatApi.sendMessage(selectedChannel.id, { message: draft });
      setDraft("");
      const response = await chatApi.messages(selectedChannel.id);
      setMessages(Array.isArray(response.data) ? response.data : []);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to send channel message");
    } finally {
      setSending(false);
    }
  };

  const createChannel = async () => {
    try {
      setCreatingChannel(true);
      await chatApi.createChannel({ ...channelForm, team_id: channelForm.team_id || null });
      setChannelOpen(false);
      setChannelForm(emptyChannel);
      setError("");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to create channel");
    } finally {
      setCreatingChannel(false);
    }
  };

  const startDirectConversation = async (person) => {
    try {
      setStartingDirect(true);
      const response = await chatApi.createChannel({
        name: person.full_name,
        description: `Direct conversation with ${person.full_name}`,
        channel_type: "DIRECT",
        is_private: true,
        member_user_id: person.id,
      });
      setDirectOpen(false);
      setPersonSearch("");
      setSelectedChannelId(response.data.id);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to start direct conversation");
    } finally {
      setStartingDirect(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Collaboration"
        title="Chat workspace"
        description="Group rooms and direct conversations for fast, focused communication without leaving your organization context."
        actions={[
          <Chip
            key="live"
            label={`Realtime ${connectionState}`}
            color={connectionState === "connected" ? "success" : "default"}
          />,
          <Button key="direct" startIcon={<PersonAddAlt1 />} variant="outlined" onClick={() => setDirectOpen(true)}>
            New direct message
          </Button>,
          ...(user.role !== "USER"
            ? [
                <Button key="channel" startIcon={<Add />} variant="contained" onClick={() => setChannelOpen(true)}>
                  New channel
                </Button>,
              ]
            : []),
        ]}
      />
      {error ? <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert> : null}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 3.4 }}>
          <GlassPanel title="Conversations" subtitle="Groups and direct messages in one calm workspace">
            <Stack spacing={1.4} sx={{ mb: 2 }}>
              <TextField
                size="small"
                label="Search conversations"
                value={channelSearch}
                onChange={(event) => setChannelSearch(event.target.value)}
              />
              <TextField select size="small" label="Filter" value={filterMode} onChange={(event) => setFilterMode(event.target.value)}>
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="unread">Unread</MenuItem>
                <MenuItem value="recent">Recent</MenuItem>
                <MenuItem value="direct">Direct messages</MenuItem>
                <MenuItem value="groups">Group channels</MenuItem>
              </TextField>
            </Stack>
            <PageState
              loading={loading}
              error={error}
              empty={!loading && !error && visibleChannels.length === 0}
              title="No conversations match this view"
              description="Try a broader search or switch the current filter."
              onRetry={load}
              minHeight={180}
            />
            {!loading && !error ? (
              <List className="soft-scroll" sx={{ display: "grid", gap: 0.75, maxHeight: 720, overflowY: "auto" }}>
                {visibleChannels.map((channel) => (
                  <ListItemButton
                    key={channel.id}
                    selected={selectedChannelId === channel.id}
                    onClick={() => setSelectedChannelId(channel.id)}
                    sx={{ borderRadius: 2.5, alignItems: "flex-start", py: 1.4 }}
                  >
                    <ListItemText
                      primary={channel.channel_type === "DIRECT" ? channel.display_name : `# ${channel.display_name || channel.name}`}
                      secondary={(
                        <Stack spacing={0.6} sx={{ mt: 0.6 }}>
                          <Typography variant="caption" color="text.secondary">
                            {channel.latest_message_preview}
                          </Typography>
                          <Stack direction="row" spacing={0.8}>
                            <Chip size="small" label={channel.channel_type === "DIRECT" ? "DM" : channel.channel_type} />
                            {channel.unread_count ? <Chip size="small" color="info" label={`${channel.unread_count} unread`} /> : null}
                          </Stack>
                        </Stack>
                      )}
                    />
                  </ListItemButton>
                ))}
              </List>
            ) : null}
          </GlassPanel>
        </Grid>
        <Grid size={{ xs: 12, lg: 8.6 }}>
          <GlassPanel
            title={selectedChannel ? (selectedChannel.channel_type === "DIRECT" ? selectedChannel.display_name : `# ${selectedChannel.display_name || selectedChannel.name}`) : "Conversation"}
            subtitle={selectedChannel?.description || "Choose a conversation to start collaborating."}
            action={selectedChannel ? <Chip icon={<Forum />} label={selectedChannel.channel_type === "DIRECT" ? "Direct message" : selectedChannel.channel_type} /> : null}
            minHeight={720}
          >
            <Stack spacing={2.25} sx={{ minHeight: 620 }}>
              <Box className="soft-scroll" sx={{ flex: 1, maxHeight: 560, overflowY: "auto", pr: 0.5 }}>
                <Stack spacing={1.5}>
                  {messages.map((entry) => (
                    <Stack
                      key={entry.id}
                      direction="row"
                      spacing={1.4}
                      alignItems="flex-start"
                      sx={{ p: 1.25, borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.03)" }}
                    >
                      <Avatar sx={{ width: 38, height: 38, bgcolor: "secondary.main" }}>
                        {(entry.user?.full_name || "?").split(" ").map((part) => part[0]).join("").slice(0, 2)}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle2">{entry.user?.full_name || "Unknown"}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {dayjs(entry.created_at).format("MMM D, HH:mm")}
                          </Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ mt: 0.7, whiteSpace: "pre-wrap" }}>
                          {entry.message}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}
                  {!messages.length ? (
                    <Box sx={{ p: 4, borderRadius: 3, textAlign: "center", bgcolor: "rgba(255,255,255,0.025)" }}>
                      <Typography variant="subtitle1">No conversation yet</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Send a message to start the thread and establish a clear collaboration rhythm.
                      </Typography>
                    </Box>
                  ) : null}
                </Stack>
              </Box>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  maxRows={5}
                  placeholder={selectedChannel?.channel_type === "DIRECT" ? "Send a direct message..." : "Message this channel. Use @name to mention a teammate."}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <Button variant="contained" endIcon={<Send />} onClick={sendMessage} disabled={!selectedChannel || !draft.trim() || sending}>
                  {sending ? "Sending..." : "Send"}
                </Button>
              </Stack>
            </Stack>
          </GlassPanel>
        </Grid>
      </Grid>

      <Dialog open={channelOpen} onClose={() => setChannelOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create channel</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={channelForm.name} onChange={(event) => setChannelForm((previous) => ({ ...previous, name: event.target.value }))} />
            <TextField label="Description" multiline minRows={3} value={channelForm.description} onChange={(event) => setChannelForm((previous) => ({ ...previous, description: event.target.value }))} />
            <TextField select label="Channel type" value={channelForm.channel_type} onChange={(event) => setChannelForm((previous) => ({ ...previous, channel_type: event.target.value }))}>
              <MenuItem value="ORG">Organization</MenuItem>
              <MenuItem value="TEAM">Team</MenuItem>
            </TextField>
            {channelForm.channel_type === "TEAM" ? (
              <TextField select label="Team" value={channelForm.team_id} onChange={(event) => setChannelForm((previous) => ({ ...previous, team_id: event.target.value }))}>
                {teams.map((team) => (
                  <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>
                ))}
              </TextField>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChannelOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={createChannel}
            disabled={creatingChannel || !channelForm.name.trim() || (channelForm.channel_type === "TEAM" && !channelForm.team_id)}
          >
            {creatingChannel ? "Creating..." : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={directOpen} onClose={() => setDirectOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Start a direct conversation</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Search people" value={personSearch} onChange={(event) => setPersonSearch(event.target.value)} placeholder="Search by name, title, or email" />
            <Stack spacing={1}>
              {people.map((person) => (
                <Stack
                  key={person.id}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ p: 1.4, borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.03)" }}
                >
                  <Box>
                    <Typography variant="subtitle2">{person.full_name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {[person.title, person.email].filter(Boolean).join(" • ")}
                    </Typography>
                  </Box>
                  <Button variant="outlined" onClick={() => startDirectConversation(person)} disabled={startingDirect}>
                    {startingDirect ? "Starting..." : "Message"}
                  </Button>
                </Stack>
              ))}
              {peopleLoading ? <Typography variant="body2" color="text.secondary">Searching teammates...</Typography> : null}
              {!peopleLoading && !people.length ? <Typography variant="body2" color="text.secondary">No people match this search.</Typography> : null}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDirectOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default ChatPage;
