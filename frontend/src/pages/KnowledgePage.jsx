import { useEffect, useMemo, useState } from "react";
import { Box, Chip, CircularProgress, Drawer, Grid, InputAdornment, List, ListItemButton, ListItemText, MenuItem, Stack, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { knowledgeApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../store/AuthContext";

function KnowledgePage() {
  const { activeOrganizationId, user } = useAuth();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ search: "", category: "" });

  useEffect(() => {
    knowledgeApi.list({ ...filters, organization_id: activeOrganizationId || undefined }).then((response) => setItems(response.data));
  }, [activeOrganizationId, filters]);

  const categories = useMemo(() => [...new Set(items.map((item) => item.category))], [items]);

  return (
    <>
      <PageHeader
        eyebrow="Knowledge Graph"
        title={user.role === "USER" ? "Recommended knowledge and company docs" : "Searchable company intelligence"}
        description="SOPs, release guides, FAQs, and org-specific operating knowledge surfaced with better filtering and AI relevance."
      />
      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={4}>
          <GlassPanel title="Search and scope" subtitle="Filter by what matters right now" minHeight={220}>
            <TextField
              fullWidth
              placeholder="Search docs, runbooks, FAQs..."
              value={filters.search}
              onChange={(event) => setFilters((previous) => ({ ...previous, search: event.target.value }))}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
            />
            <TextField
              select
              fullWidth
              label="Category"
              value={filters.category}
              onChange={(event) => setFilters((previous) => ({ ...previous, category: event.target.value }))}
              sx={{ mt: 2 }}
            >
              <MenuItem value="">All</MenuItem>
              {categories.map((category) => <MenuItem key={category} value={category}>{category}</MenuItem>)}
            </TextField>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
              {categories.map((category) => <Chip key={category} label={category} color="secondary" variant="outlined" />)}
            </Stack>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} lg={8}>
          <GlassPanel title="Document library" subtitle={`${items.length} knowledge assets in your visible scope`} minHeight={480}>
            {!items.length ? <CircularProgress /> : (
              <List sx={{ p: 0 }}>
                {items.map((item) => (
                  <ListItemButton key={item.id} onClick={() => setSelected(item)} sx={{ mb: 1, borderRadius: 3, alignItems: "flex-start", bgcolor: "rgba(255,255,255,0.025)" }}>
                    <ListItemText
                      primary={item.title}
                      secondary={
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.62)", mb: 1 }}>{item.summary}</Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip size="small" label={item.category} color="info" />
                            <Chip size="small" label={item.organization?.name || "Scoped"} variant="outlined" />
                            {item.tags.map((tag) => <Chip key={tag.id} size="small" label={tag.name} variant="outlined" />)}
                          </Stack>
                        </Box>
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </GlassPanel>
        </Grid>
      </Grid>
      <Drawer anchor="right" open={Boolean(selected)} onClose={() => setSelected(null)}>
        <Box sx={{ width: { xs: 340, md: 520 }, p: 3 }}>
          {selected ? (
            <Stack spacing={2}>
              <Typography variant="overline" color="primary.main">{selected.category}</Typography>
              <Typography variant="h5">{selected.title}</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={selected.organization?.name || "Organization"} color="secondary" />
                {selected.tags.map((tag) => <Chip key={tag.id} label={tag.name} variant="outlined" />)}
              </Stack>
              <Typography variant="body1" sx={{ color: "rgba(226,232,240,0.76)", whiteSpace: "pre-wrap" }}>
                {selected.content}
              </Typography>
            </Stack>
          ) : null}
        </Box>
      </Drawer>
    </>
  );
}

export default KnowledgePage;
