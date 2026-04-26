import { useEffect, useState } from "react";
import { Alert, Avatar, Box, Button, Drawer, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { contactsApi } from "../api/endpoints";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import PageState from "../components/PageState";
import PaginationControls from "../components/PaginationControls";
import PageHeader from "../components/PageHeader";
import { surfaceSubtle } from "../styles/muiSurfaces";

function ContactsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("grid");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      const response = await contactsApi.list({ search: search || undefined, paginated: true, page, page_size: view === "grid" ? 18 : 15 });
      setItems(response.data.items || []);
      setMeta(response.data.meta || null);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load contacts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, search, view]);

  useEffect(() => {
    setPage(1);
  }, [search, view]);

  return (
    <>
      <PageHeader
        eyebrow="Contacts"
        title="Company contacts"
        description="Find teammates by name, title, team, or email, with quick access to the people you work with most often."
        actions={[
          <TextField key="search" size="small" label="Search contacts" value={search} onChange={(event) => setSearch(event.target.value)} />,
          <TextField key="view" size="small" select label="View" value={view} onChange={(event) => setView(event.target.value)}><MenuItem value="grid">Grid</MenuItem><MenuItem value="list">List</MenuItem></TextField>,
        ]}
      />
      {error ? <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert> : null}
      <GlassPanel title="Directory" subtitle={`${items.length} visible contacts`}>
        <PageState
          loading={loading}
          error={error}
          empty={!loading && !error && items.length === 0}
          title="No contacts matched your search"
          description="Try a wider name, title, team, or email query."
          onRetry={load}
          minHeight={180}
        />
        {view === "grid" ? (
          <Grid container spacing={2.2}>
            {items.map((item) => (
              <Grid item xs={12} md={6} xl={4} key={item.id}>
                <Box onClick={() => setSelected(item)} sx={{ p: 1.8, borderRadius: 3.5, cursor: "pointer", bgcolor: (theme) => surfaceSubtle(theme) }}>
                  <Stack direction="row" spacing={1.4} alignItems="center">
                    <Avatar sx={{ bgcolor: "secondary.main" }}>{item.full_name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</Avatar>
                    <Box>
                      <Typography variant="subtitle2">{item.full_name}</Typography>
                      <Typography variant="body2" color="text.secondary">{item.title}</Typography>
                    </Box>
                  </Stack>
                </Box>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Stack spacing={1.2}>
            {items.map((item) => (
              <Box key={item.id} onClick={() => setSelected(item)} sx={{ p: 1.6, borderRadius: 3.5, cursor: "pointer", bgcolor: (theme) => surfaceSubtle(theme) }}>
                <Typography variant="subtitle2">{item.full_name}</Typography>
                <Typography variant="body2" color="text.secondary">{item.email} - {item.team?.name || "No team"}</Typography>
              </Box>
            ))}
          </Stack>
        )}
        <PaginationControls meta={meta} onChange={setPage} disabled={loading} />
      </GlassPanel>
      <Drawer anchor="right" open={Boolean(selected)} onClose={() => setSelected(null)}>
        <Box sx={{ width: { xs: 340, md: 460 }, p: 3 }}>
          {selected ? (
            <Stack spacing={2}>
              <Typography variant="h5">{selected.full_name}</Typography>
              <Typography variant="body1">{selected.title}</Typography>
              <Typography variant="body2">{selected.email}</Typography>
              <Typography variant="body2">Team: {selected.team?.name || "No team"}</Typography>
              <Typography variant="body2">Responsibilities: {selected.responsibilities}</Typography>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={() => navigate(`/people/${selected.id}`)}>Open profile</Button>
                <Button variant="outlined">Email</Button>
              </Stack>
            </Stack>
          ) : null}
        </Box>
      </Drawer>
    </>
  );
}

export default ContactsPage;
