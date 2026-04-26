import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, List, ListItemButton, ListItemText, Stack, TextField, Typography } from "@mui/material";
import { aiApi } from "../api/endpoints";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../store/AuthContext";
import { assistantBubbleBg, surfaceSubtle, userBubbleBg } from "../styles/muiSurfaces";

function promptSetForRole(role) {
  if (role === "ADMIN") {
    return [
      "What workflow bottlenecks should I review this week?",
      "Summarize our most important org process documents.",
      "What should we improve in task escalation handling?",
    ];
  }
  if (role === "MANAGER") {
    return [
      "Which team actions should I take for overdue work?",
      "Summarize the release readiness process for my team.",
      "What documents should I share with new team members?",
    ];
  }
  return [
    "What process should I follow next?",
    "Which document is most relevant to my current work?",
    "Summarize the steps for handling an incident in my org.",
  ];
}

function mapMessages(msgs) {
  if (!Array.isArray(msgs)) return [];
  return msgs.map((m) => ({ role: m.role, content: m.content }));
}

function AIAssistantPage() {
  const { user, scopedOrganization, activeOrganizationId } = useAuth();
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState([]);
  const [references, setReferences] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [lastSource, setLastSource] = useState("");

  const listEndRef = useRef(null);
  const scrollRef = useRef(null);

  const loadConversations = useCallback(async () => {
    const response = await aiApi.conversations();
    setConversations(response.data);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, sending]);

  const sendMessage = async (text) => {
    const outgoing = (text || message).trim();
    if (!outgoing || sending) return;
    setSending(true);
    setSendError("");
    setHistory((previous) => [...previous, { role: "user", content: outgoing }]);
    setMessage("");
    try {
      const payload = {
        message: outgoing,
        conversation_id: conversationId,
        ...(user.role === "SUPER_ADMIN" && activeOrganizationId
          ? { organization_id: activeOrganizationId }
          : {}),
      };
      const response = await aiApi.chat(payload);
      setConversationId(response.data.conversation_id);
      setHistory((previous) => [
        ...previous,
        { role: "assistant", content: response.data.answer },
      ]);
      setReferences(response.data.references || []);
      if (response.data.used_openai != null) {
        setLastSource(response.data.used_openai ? "Model + knowledge" : "Knowledge (fallback)");
      }
      await loadConversations();
    } catch (e) {
      setSendError(e.response?.data?.detail || "Could not send. Check your network and try again.");
      setHistory((previous) => (previous.length ? previous.slice(0, -1) : previous));
    } finally {
      setSending(false);
    }
  };

  const openConversation = async (c) => {
    setSendError("");
    setConversationId(c.id);
    setSending(true);
    try {
      const response = await aiApi.conversation(c.id);
      setHistory(mapMessages(response.data?.messages));
      setReferences([]);
      setLastSource("");
    } catch {
      setHistory(mapMessages(c.messages));
    } finally {
      setSending(false);
    }
  };

  const prompts = promptSetForRole(user.role);

  return (
    <>
      <PageHeader
        eyebrow={`CompHeart AI${scopedOrganization ? ` / ${scopedOrganization.name}` : ""}`}
        title="Organization-aware assistant"
        description="Ask in the context of your company, your role, and the documents in your current scope. Press Enter to send, Shift+Enter for a new line. Super admins: pick an organization in the header so answers use that workspace's knowledge base."
      />
      {user.role === "SUPER_ADMIN" && !activeOrganizationId ? (
        <Alert severity="info" sx={{ mb: 2.5 }}>Select an <strong>Organization</strong> in the header to align answers with a specific company's knowledge. Without it, the assistant uses your home organization.</Alert>
      ) : null}
      {sendError ? <Alert severity="error" sx={{ mb: 2.5 }}>{sendError}</Alert> : null}
      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={3}>
          <GlassPanel title="Prompt starters" subtitle={`Tuned for ${user.role.toLowerCase()} workflows`}>
            <Stack spacing={1}>
              {prompts.map((prompt) => (
                <Chip
                  key={prompt}
                  label={prompt}
                  onClick={() => !sending && sendMessage(prompt)}
                  disabled={sending}
                  sx={{ justifyContent: "flex-start" }}
                />
              ))}
            </Stack>
            <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>Recent conversations</Typography>
            <List sx={{ p: 0 }}>
              {conversations.map((c) => (
                <ListItemButton key={c.id} selected={conversationId === c.id} onClick={() => openConversation(c)} disabled={sending}>
                  <ListItemText primary={c.title} secondary={`${(c.messages && c.messages.length) || 0} messages`} />
                </ListItemButton>
              ))}
            </List>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} lg={6}>
          <GlassPanel
            title="Conversation"
            subtitle="Role-aware answers grounded in internal knowledge"
            minHeight={520}
            action={
              lastSource ? <Chip size="small" label={lastSource} variant="outlined" color="primary" /> : null
            }
          >
            <Box
              ref={scrollRef}
              sx={{ minHeight: 360, maxHeight: { xs: 420, md: 480 }, overflowY: "auto", pr: 0.5, mb: 2 }}
            >
              <Stack spacing={2}>
                {!history.length && !sending ? (
                  <Typography color="text.secondary" variant="body2">
                    Start with a quick prompt or a question on your own. Answers use your visible knowledge articles.
                  </Typography>
                ) : null}
                {history.map((entry, index) => (
                  <Stack
                    key={`${entry.role}-${index}`}
                    sx={{
                      alignSelf: entry.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "90%",
                      p: 2,
                      borderRadius: 3,
                      bgcolor: (theme) => (entry.role === "user" ? userBubbleBg(theme) : assistantBubbleBg(theme)),
                    }}
                  >
                    <Typography variant="caption" sx={{ color: "primary.main", mb: 0.5 }}>
                      {entry.role === "user" ? "You" : "CompHeart AI"}
                    </Typography>
                    <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>{entry.content}</Typography>
                  </Stack>
                ))}
                {sending ? (
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ alignSelf: "flex-start", p: 2, borderRadius: 3, bgcolor: (t) => assistantBubbleBg(t) }}>
                    <CircularProgress size={22} />
                    <Typography variant="body2" color="text.secondary">Composing a reply…</Typography>
                  </Stack>
                ) : null}
                <span ref={listEndRef} />
              </Stack>
            </Box>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                maxRows={8}
                placeholder="Ask about workflows, tasks, docs, SLA handling, or operating guidance… (Enter to send, Shift+Enter for newline)"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={sending}
              />
              <Button variant="contained" onClick={() => sendMessage()} disabled={sending || !message.trim()} sx={{ height: 56, alignSelf: { xs: "stretch", md: "flex-start" } }}>
                Send
              </Button>
            </Stack>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} lg={3}>
          <GlassPanel title="Knowledge references" subtitle="Documents used for the last reply">
            {references.length ? (
              <Stack spacing={1.5}>
                {references.map((reference) => (
                  <Stack key={reference.id} sx={{ p: 1.5, borderRadius: 3, bgcolor: (theme) => surfaceSubtle(theme) }}>
                    <Typography variant="subtitle2">{reference.title}</Typography>
                    <Typography variant="caption" color="primary.main">{reference.category}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {reference.summary}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Typography color="text.secondary" variant="body2">Run a message to see which documents grounded the answer.</Typography>
            )}
          </GlassPanel>
        </Grid>
      </Grid>
    </>
  );
}

export default AIAssistantPage;
