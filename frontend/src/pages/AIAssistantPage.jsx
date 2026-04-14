import { useEffect, useState } from "react";
import { Button, Chip, List, ListItemButton, ListItemText, Stack, TextField, Typography } from "@mui/material";
import { aiApi } from "../api/endpoints";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../store/AuthContext";

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

function AIAssistantPage() {
  const { user, scopedOrganization } = useAuth();
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState([]);
  const [references, setReferences] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);

  const loadConversations = async () => {
    const response = await aiApi.conversations();
    setConversations(response.data);
  };

  useEffect(() => {
    loadConversations();
  }, []);

  const sendMessage = async (text) => {
    const outgoing = text || message;
    if (!outgoing) return;
    setHistory((previous) => [...previous, { role: "user", content: outgoing }]);
    setMessage("");
    const response = await aiApi.chat({ message: outgoing, conversation_id: conversationId });
    setConversationId(response.data.conversation_id);
    setHistory((previous) => [...previous, { role: "assistant", content: response.data.answer }]);
    setReferences(response.data.references);
    await loadConversations();
  };

  const prompts = promptSetForRole(user.role);

  return (
    <>
      <PageHeader
        eyebrow={`CompHeart AI${scopedOrganization ? ` / ${scopedOrganization.name}` : ""}`}
        title="Organization-aware assistant"
        description="Ask in the context of your company, your role, and the documents available in your visible scope."
      />
      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={3}>
          <GlassPanel title="Prompt starters" subtitle={`Tuned for ${user.role.toLowerCase()} workflows`}>
            <Stack spacing={1}>
              {prompts.map((prompt) => (
                <Chip key={prompt} label={prompt} onClick={() => sendMessage(prompt)} sx={{ justifyContent: "flex-start" }} />
              ))}
            </Stack>
            <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>Recent conversations</Typography>
            <List sx={{ p: 0 }}>
              {conversations.map((conversation) => (
                <ListItemButton key={conversation.id} onClick={() => {
                  setConversationId(conversation.id);
                  setHistory(conversation.messages);
                }}>
                  <ListItemText primary={conversation.title} secondary={`${conversation.messages.length} messages`} />
                </ListItemButton>
              ))}
            </List>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} lg={6}>
          <GlassPanel title="Conversation" subtitle="Role-aware answers grounded in internal knowledge" minHeight={520}>
            <Stack spacing={2} sx={{ minHeight: 360, mb: 2 }}>
              {history.map((entry, index) => (
                <Stack
                  key={`${entry.role}-${index}`}
                  sx={{
                    alignSelf: entry.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "90%",
                    p: 2,
                    borderRadius: 3,
                    bgcolor: entry.role === "user" ? "rgba(116,184,255,0.16)" : "rgba(255,255,255,0.04)",
                  }}
                >
                  <Typography variant="caption" sx={{ color: "primary.main", mb: 0.5 }}>
                    {entry.role === "user" ? "You" : "CompHeart AI"}
                  </Typography>
                  <Typography variant="body1">{entry.content}</Typography>
                </Stack>
              ))}
            </Stack>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField fullWidth placeholder="Ask about workflows, tasks, docs, SLA handling, or operating guidance..." value={message} onChange={(event) => setMessage(event.target.value)} />
              <Button variant="contained" onClick={() => sendMessage()}>Send</Button>
            </Stack>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} lg={3}>
          <GlassPanel title="Knowledge references" subtitle="Documents used to answer the latest prompt">
            <Stack spacing={1.5}>
              {references.map((reference) => (
                <Stack key={reference.id} sx={{ p: 1.5, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)" }}>
                  <Typography variant="subtitle2">{reference.title}</Typography>
                  <Typography variant="caption" color="primary.main">{reference.category}</Typography>
                  <Typography variant="body2" sx={{ color: "rgba(226, 232, 240, 0.66)", mt: 0.5 }}>
                    {reference.summary}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </GlassPanel>
        </Grid>
      </Grid>
    </>
  );
}

export default AIAssistantPage;
