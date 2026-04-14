import { useEffect, useMemo, useState } from "react";
import { Box, Button, Chip, Drawer, InputAdornment, List, ListItemButton, ListItemText, MenuItem, Stack, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { knowledgeApi } from "../api/endpoints";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import PageState from "../components/PageState";
import PaginationControls from "../components/PaginationControls";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../store/AuthContext";

function KnowledgePage() {
  const { activeOrganizationId, user } = useAuth();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [versions, setVersions] = useState([]);
  const [filters, setFilters] = useState({ search: "", category: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      const response = await knowledgeApi.list({ ...filters, paginated: true, page, page_size: 16, organization_id: activeOrganizationId || undefined });
      setItems(response.data.items || []);
      setMeta(response.data.meta || null);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load knowledge");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [activeOrganizationId, filters.search, filters.category, page]);
  useEffect(() => { setPage(1); }, [activeOrganizationId, filters.search, filters.category]);

  const categories = useMemo(() => [...new Set(items.map((item) => item.category))], [items]);

  const openItem = async (item) => {
    setSelected(item);
    const response = await knowledgeApi.versions(item.id);
    setVersions(response.data);
  };

  return (
    <>
      <PageHeader eyebrow="Knowledge Graph" title={user.role === "USER" ? "Recommended knowledge and company docs" : "Searchable company intelligence"} description="SOPs, runbooks, FAQs, and versioned operating knowledge with history and restore support." />
      {error ? <Box sx={{ mb: 2.5 }}><PageState error={error} onRetry={load} /></Box> : null}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={4}>
          <GlassPanel title="Search and scope" subtitle="Filter by category and find the right document quickly" minHeight={240}>
            <TextField fullWidth placeholder="Search docs, runbooks, FAQs..." value={filters.search} onChange={(event) => setFilters((previous) => ({ ...previous, search: event.target.value }))} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} />
            <TextField select fullWidth label="Category" value={filters.category} onChange={(event) => setFilters((previous) => ({ ...previous, category: event.target.value }))} sx={{ mt: 2 }}>
              <MenuItem value="">All</MenuItem>
              {categories.map((category) => <MenuItem key={category} value={category}>{category}</MenuItem>)}
            </TextField>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} lg={8}>
          <GlassPanel title="Document library" subtitle={`${items.length} version-aware knowledge assets in scope`} minHeight={520}>
            <PageState
              loading={loading}
              error={error}
              empty={!loading && !error && items.length === 0}
              title="No knowledge items matched this scope"
              description="Try a different category or a broader search phrase."
              onRetry={load}
            />
            <List sx={{ p: 0 }}>
              {items.map((item) => (
                <ListItemButton key={item.id} onClick={() => openItem(item)} sx={{ mb: 1, borderRadius: 3.5, alignItems: "flex-start", bgcolor: "rgba(255,255,255,0.025)" }}>
                  <ListItemText primary={item.title} secondary={<Box sx={{ mt: 1 }}><Typography variant="body2" sx={{ color: "rgba(226,232,240,0.62)", mb: 1 }}>{item.summary}</Typography><Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap><Chip size="small" label={item.category} color="info" /><Chip size="small" label={`v${item.current_version || 1}`} /><Chip size="small" label={item.organization?.name || "Scoped"} variant="outlined" />{item.tags.map((tag) => <Chip key={tag.id} size="small" label={tag.name} variant="outlined" />)}</Stack></Box>} />
                </ListItemButton>
              ))}
            </List>
            <PaginationControls meta={meta} onChange={setPage} disabled={loading} />
          </GlassPanel>
        </Grid>
      </Grid>
      <Drawer anchor="right" open={Boolean(selected)} onClose={() => setSelected(null)}>
        <Box sx={{ width: { xs: 360, md: 620 }, p: 3 }}>
          {selected ? <Stack spacing={2.2}><Typography variant="overline" color="primary.main">{selected.category}</Typography><Typography variant="h5">{selected.title}</Typography><Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap><Chip label={`Current v${selected.current_version || 1}`} color="secondary" />{selected.tags.map((tag) => <Chip key={tag.id} label={tag.name} variant="outlined" />)}</Stack><Typography variant="body1" sx={{ color: "rgba(226,232,240,0.76)", whiteSpace: "pre-wrap" }}>{selected.content}</Typography><GlassPanel title="Version history" subtitle="Restore previous revisions when needed"><Stack spacing={1.1}>{versions.map((version) => <Box key={version.id} sx={{ p: 1.3, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)" }}><Stack direction="row" justifyContent="space-between"><Typography variant="subtitle2">v{version.version_number}</Typography><Button size="small" onClick={() => knowledgeApi.restoreVersion(selected.id, version.id).then(() => openItem(selected))}>Restore</Button></Stack><Typography variant="body2" sx={{ color: "rgba(226,232,240,0.62)" }}>{version.editor?.full_name || "Unknown"} · {new Date(version.created_at).toLocaleString()}</Typography><Typography variant="body2" sx={{ mt: 0.8, color: "rgba(226,232,240,0.72)" }}>{version.summary_snapshot}</Typography></Box>)}</Stack></GlassPanel></Stack> : null}
        </Box>
      </Drawer>
    </>
  );
}

export default KnowledgePage;
