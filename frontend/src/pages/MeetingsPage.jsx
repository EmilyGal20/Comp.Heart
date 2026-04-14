import { useEffect, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import { meetingsApi } from "../api/endpoints";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import PageState from "../components/PageState";
import PaginationControls from "../components/PaginationControls";
import PageHeader from "../components/PageHeader";

const emptyMeeting = { title: "", raw_notes: "" };

function MeetingsPage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyMeeting);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      const response = await meetingsApi.list({ paginated: true, page, page_size: 12 });
      setItems(response.data.items || []);
      setMeta(response.data.meta || null);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load meetings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]);

  const summarize = async () => {
    const response = await meetingsApi.summarize(form);
    setOpen(false);
    setForm(emptyMeeting);
    setSelected(response.data);
    await load();
  };

  return (
    <>
      <PageHeader eyebrow="Meetings" title="AI meeting summaries" description="Turn raw meeting notes into clean summaries, action items, decisions, and follow-ups, then convert actions into tasks." actions={[<Button key="new" variant="contained" onClick={() => setOpen(true)}>Summarize meeting</Button>]} />
      {error ? <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert> : null}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={5}>
          <GlassPanel title="Recent meeting summaries" subtitle="Structured meeting memory for your organization">
            <PageState
              loading={loading}
              error={error}
              empty={!loading && !error && items.length === 0}
              title="No meeting summaries yet"
              description="Paste notes or a transcript to create the first one."
              onRetry={load}
              minHeight={180}
            />
            <Stack spacing={1.3}>
              {items.map((item) => (
                <Box key={item.id} onClick={() => setSelected(item)} sx={{ p: 1.7, borderRadius: 3.5, cursor: "pointer", bgcolor: "rgba(255,255,255,0.03)" }}>
                  <Typography variant="subtitle2">{item.title}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.8, color: "rgba(226,232,240,0.64)" }}>{item.summary}</Typography>
                </Box>
              ))}
            </Stack>
            <PaginationControls meta={meta} onChange={setPage} disabled={loading} />
          </GlassPanel>
        </Grid>
        <Grid item xs={12} lg={7}>
          <GlassPanel title={selected?.title || "Meeting detail"} subtitle="Summary, action items, decisions, and follow-ups">
            {selected ? (
              <Stack spacing={2}>
                <Typography variant="body1" sx={{ color: "rgba(226,232,240,0.8)" }}>{selected.summary}</Typography>
                <Box><Typography variant="subtitle2">Action items</Typography>{selected.action_items.map((item) => <Typography key={item} variant="body2" sx={{ mt: 0.6 }}>• {item}</Typography>)}</Box>
                <Box><Typography variant="subtitle2">Decisions</Typography>{selected.decisions.map((item) => <Typography key={item} variant="body2" sx={{ mt: 0.6 }}>• {item}</Typography>)}</Box>
                <Box><Typography variant="subtitle2">Follow-ups</Typography>{selected.followups.map((item) => <Typography key={item} variant="body2" sx={{ mt: 0.6 }}>• {item}</Typography>)}</Box>
                <Button variant="contained" onClick={() => meetingsApi.createTasks(selected.id).then(load)}>Create tasks from actions</Button>
              </Stack>
            ) : <Typography variant="body2">Select a meeting summary to review it.</Typography>}
          </GlassPanel>
        </Grid>
      </Grid>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Summarize meeting</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Meeting title" value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} />
            <TextField label="Raw notes / transcript" multiline minRows={10} value={form.raw_notes} onChange={(event) => setForm((previous) => ({ ...previous, raw_notes: event.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" onClick={summarize}>Generate summary</Button></DialogActions>
      </Dialog>
    </>
  );
}

export default MeetingsPage;
