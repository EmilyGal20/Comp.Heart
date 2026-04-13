import { useEffect, useState } from "react";
import { Alert, Avatar, Box, Button, Drawer, Grid, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { contactsApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";

function ContactsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("grid");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const response = await contactsApi.list({ search: search || undefined });
      setItems(response.data);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load contacts");
    }
  };

  useEffect(() => {
    load();
  }, [search]);

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
        {view === "grid" ? (
          <Grid container spacing={2.2}>
            {items.map((item) => (
              <Grid item xs={12} md={6} xl={4} key={item.id}>
                <Box onClick={() => setSelected(item)} sx={{ p: 1.8, borderRadius: 3.5, cursor: "pointer", bgcolor: "rgba(255,255,255,0.03)" }}>
                  <Stack direction="row" spacing={1.4} alignItems="center">
                    <Avatar sx={{ bgcolor: "secondary.main" }}>{item.full_name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</Avatar>
                    <Box>
                      <Typography variant="subtitle2">{item.full_name}</Typography>
                      <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.62)" }}>{item.title}</Typography>
                    </Box>
                  </Stack>
                </Box>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Stack spacing={1.2}>
            {items.map((item) => (
              <Box key={item.id} onClick={() => setSelected(item)} sx={{ p: 1.6, borderRadius: 3.5, cursor: "pointer", bgcolor: "rgba(255,255,255,0.03)" }}>
                <Typography variant="subtitle2">{item.full_name}</Typography>
                <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.62)" }}>{item.email} - {item.team?.name || "No team"}</Typography>
              </Box>
            ))}
          </Stack>
        )}
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
