import { useEffect, useState } from "react";
import { Add, PushPin } from "@mui/icons-material";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { selfNotesApi, settingsApi } from "../api/endpoints";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";

const emptyNote = { title: "", content: "", is_pinned: false, color: "cyan" };

function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [notes, setNotes] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyNote);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const [profileResponse, notesResponse] = await Promise.all([settingsApi.profile(), selfNotesApi.list()]);
      setProfile(profileResponse.data);
      setNotes(notesResponse.data);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load profile");
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (editing) await selfNotesApi.update(editing.id, form);
    else await selfNotesApi.create(form);
    setOpen(false);
    setEditing(null);
    setForm(emptyNote);
    await load();
  };

  const openNote = (note = null) => {
    setEditing(note);
    setForm(note || emptyNote);
    setOpen(true);
  };

  return (
    <>
      <PageHeader eyebrow="Profile" title="Profile and self notes" description="Your personal context, private notes, and quick reminders in one calm workspace." actions={[<Button key="new" startIcon={<Add />} variant="contained" onClick={() => openNote()}>New note</Button>]} />
      {error ? <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert> : null}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={4}>
          <GlassPanel title="Profile" subtitle="Role, team, and responsibilities">
            {profile ? <Stack spacing={1}><Typography variant="h6">{profile.full_name}</Typography><Typography variant="body2">{profile.email}</Typography><Typography variant="body2">{profile.title}</Typography><Typography variant="body2">{profile.role}</Typography><Typography variant="body2">{profile.responsibilities}</Typography></Stack> : null}
          </GlassPanel>
        </Grid>
        <Grid item xs={12} lg={8}>
          <GlassPanel title="Self notes" subtitle="Private sticky notes that stay scoped to you">
            <Grid container spacing={2}>
              {notes.map((note) => (
                <Grid item xs={12} md={6} key={note.id}>
                  <Box sx={{ p: 1.8, borderRadius: 3.5, bgcolor: note.color === "amber" ? "rgba(245,165,36,0.12)" : note.color === "violet" ? "rgba(155,124,255,0.12)" : "rgba(61,200,255,0.12)" }}>
                    <Stack direction="row" justifyContent="space-between"><Typography variant="subtitle2">{note.title}</Typography>{note.is_pinned ? <PushPin fontSize="small" /> : null}</Stack>
                    <Typography variant="body2" color="text.primary" sx={{ mt: 0.8 }}>{note.content}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1.2 }}><Button size="small" onClick={() => openNote(note)}>Edit</Button><Button size="small" color="error" onClick={() => selfNotesApi.remove(note.id).then(load)}>Delete</Button></Stack>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </GlassPanel>
        </Grid>
      </Grid>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit note" : "Create note"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Title" value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} />
            <TextField label="Content" multiline minRows={5} value={form.content} onChange={(event) => setForm((previous) => ({ ...previous, content: event.target.value }))} />
            <TextField select label="Color" value={form.color} onChange={(event) => setForm((previous) => ({ ...previous, color: event.target.value }))}><MenuItem value="cyan">Cyan</MenuItem><MenuItem value="amber">Amber</MenuItem><MenuItem value="violet">Violet</MenuItem></TextField>
            <TextField select label="Pinned" value={String(form.is_pinned)} onChange={(event) => setForm((previous) => ({ ...previous, is_pinned: event.target.value === "true" }))}><MenuItem value="false">No</MenuItem><MenuItem value="true">Yes</MenuItem></TextField>
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" onClick={save}>Save</Button></DialogActions>
      </Dialog>
    </>
  );
}

export default ProfilePage;
