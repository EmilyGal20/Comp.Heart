import { useEffect, useMemo, useState } from "react";
import { Add, Forum, Send } from "@mui/icons-material";
import { Alert, Avatar, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItemButton, ListItemText, MenuItem, Stack, TextField, Typography } from "@mui/material";
import dayjs from "dayjs";
import { chatApi, organizationsApi } from "../api/endpoints";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
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
  const [draft, setDraft] = useState("");
  const [channelOpen, setChannelOpen] = useState(false);
  const [channelForm, setChannelForm] = useState(emptyChannel);
  const [error, setError] = useState("");
  const orgId = activeOrganizationId || user.organization_id;

  const load = async () => {
    try {
      const [channelResponse, teamResponse] = await Promise.all([
        chatApi.channels({ organization_id: orgId }),
        organizationsApi.teams(orgId),
      ]);
      setChannels(channelResponse.data);
      setTeams(teamResponse.data);
      const nextChannelId = selectedChannelId || channelResponse.data[0]?.id || null;
      setSelectedChannelId(nextChannelId);
      if (nextChannelId) {
        const messageResponse = await chatApi.messages(nextChannelId);
        setMessages(messageResponse.data);
      } else {
        setMessages([]);
      }
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load chat workspace");
    }
  };

  useEffect(() => {
    load();
  }, [orgId, versions.chat]);

  useEffect(() => {
    if (!selectedChannelId) return;
    chatApi.messages(selectedChannelId).then((response) => setMessages(response.data));
  }, [selectedChannelId]);

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedChannelId) || null,
    [channels, selectedChannelId]
  );

  const sendMessage = async () => {
    if (!draft.trim() || !selectedChannel) return;
    await chatApi.sendMessage(selectedChannel.id, { message: draft });
    setDraft("");
    const response = await chatApi.messages(selectedChannel.id);
    setMessages(response.data);
  };

  const createChannel = async () => {
    await chatApi.createChannel({ ...channelForm, team_id: channelForm.team_id || null });
    setChannelOpen(false);
    setChannelForm(emptyChannel);
    await load();
  };

  return (
    <>
      <PageHeader
        eyebrow="Collaboration"
        title="Chat workspace"
        description="Slack-style channels for organization and team conversations, with live updates, mentions, and task-linked coordination."
        actions={[
          <Chip key="live" label={`Realtime ${connectionState}`} color={connectionState === "connected" ? "success" : "default"} />,
          ...(user.role !== "USER" ? [<Button key="channel" startIcon={<Add />} variant="contained" onClick={() => setChannelOpen(true)}>New channel</Button>] : []),
        ]}
      />
      {error ? <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert> : null}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={3.2}>
          <GlassPanel title="Channels" subtitle="Organization, team, and focused conversation rooms">
            <List className="soft-scroll" sx={{ display: "grid", gap: 0.75, maxHeight: 720, overflowY: "auto" }}>
              {channels.map((channel) => (
                <ListItemButton
                  key={channel.id}
                  selected={selectedChannelId === channel.id}
                  onClick={() => setSelectedChannelId(channel.id)}
                  sx={{ borderRadius: 3.5, alignItems: "flex-start", py: 1.4 }}
                >
                  <ListItemText
                    primary={`# ${channel.name}`}
                    secondary={
                      <Stack spacing={0.6} sx={{ mt: 0.6 }}>
                        <Typography variant="caption" sx={{ color: "rgba(226,232,240,0.58)" }}>
                          {channel.latest_message_preview}
                        </Typography>
                        <Stack direction="row" spacing={0.8}>
                          <Chip size="small" label={channel.channel_type} />
                          {channel.unread_count ? <Chip size="small" color="info" label={`${channel.unread_count} unread`} /> : null}
                        </Stack>
                      </Stack>
                    }
                  />
                </ListItemButton>
              ))}
            </List>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} lg={8.8}>
          <GlassPanel
            title={selectedChannel ? `# ${selectedChannel.name}` : "Channel feed"}
            subtitle={selectedChannel?.description || "Choose a channel to start collaborating."}
            action={selectedChannel ? <Chip icon={<Forum />} label={selectedChannel.channel_type} /> : null}
            minHeight={720}
          >
            <Stack spacing={2.25} sx={{ minHeight: 620 }}>
              <Box className="soft-scroll" sx={{ flex: 1, maxHeight: 560, overflowY: "auto", pr: 0.5 }}>
                <Stack spacing={1.5}>
                  {messages.map((entry) => (
                    <Stack key={entry.id} direction="row" spacing={1.4} alignItems="flex-start" sx={{ p: 1.25, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)" }}>
                      <Avatar sx={{ width: 38, height: 38, bgcolor: "secondary.main" }}>
                        {(entry.user?.full_name || "?").split(" ").map((part) => part[0]).join("").slice(0, 2)}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle2">{entry.user?.full_name || "Unknown"}</Typography>
                          <Typography variant="caption" sx={{ color: "rgba(226,232,240,0.5)" }}>
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
                    <Box sx={{ p: 4, borderRadius: 4, textAlign: "center", bgcolor: "rgba(255,255,255,0.025)" }}>
                      <Typography variant="subtitle1">No conversation yet</Typography>
                      <Typography variant="body2" sx={{ mt: 1, color: "rgba(226,232,240,0.6)" }}>
                        Start a channel message to create a visible team rhythm.
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
                  placeholder="Message this channel. Use @name to mention a teammate."
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <Button variant="contained" endIcon={<Send />} onClick={sendMessage} disabled={!selectedChannel}>
                  Send
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
          <Button variant="contained" onClick={createChannel}>Create</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default ChatPage;
