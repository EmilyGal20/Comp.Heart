import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import Close from "@mui/icons-material/Close";
import dayjs from "dayjs";
import { tasksApi } from "../api/endpoints";
import Grid from "../components/AppGrid";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";
import PageState from "../components/PageState";
import PaginationControls from "../components/PaginationControls";
import StatusPill from "../components/StatusPill";
import { useAuth } from "../store/AuthContext";
import { useRealtime } from "../store/RealtimeContext";
import { surfaceSubtle } from "../styles/muiSurfaces";

function formatDateTime(value) {
  return value ? dayjs(value).format("MMM D, YYYY HH:mm") : "—";
}

function personLabel(u) {
  if (!u) return "—";
  return u.full_name || u.email || `User #${u.id}`;
}

function TaskArchivePage() {
  const { user, activeOrganizationId, scopedOrganization } = useAuth();
  const { versions } = useRealtime();
  const orgId = activeOrganizationId || user.organization_id;
  const needsOrgPicker = user.role === "SUPER_ADMIN" && !activeOrganizationId;

  const [tasks, setTasks] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [drawerId, setDrawerId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const taskIdFromQuery = searchParams.get("taskId");

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, orgId]);

  const loadList = useCallback(async () => {
    if (needsOrgPicker) {
      setTasks([]);
      setMeta(null);
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await tasksApi.list({
        status: "DONE",
        search: search.trim() || undefined,
        paginated: true,
        page,
        page_size: 20,
        organization_id: orgId,
      });
      setTasks(res.data?.items || []);
      setMeta(res.data?.meta || null);
      setError("");
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to load archived tasks");
      setTasks([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [needsOrgPicker, orgId, page, search, user.role]);

  useEffect(() => {
    loadList();
  }, [loadList, versions.tasks, versions.activity]);

  const openDetail = useCallback(async (taskId) => {
    setDrawerId(taskId);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const res = await tasksApi.detail(taskId);
      setDetail(res.data);
    } catch (e) {
      setDetailError(e.response?.data?.detail || "Unable to load task");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!taskIdFromQuery) return;
    const n = Number(taskIdFromQuery);
    if (Number.isNaN(n) || n <= 0) {
      setSearchParams({}, { replace: true });
      return;
    }
    setSearchParams({}, { replace: true });
    void openDetail(n);
  }, [taskIdFromQuery, openDetail, setSearchParams]);

  const closeDetail = () => {
    setDrawerId(null);
    setDetail(null);
    setDetailError("");
  };

  const activityTimeline = useMemo(() => {
    if (!detail?.activities?.length) return [];
    return [...detail.activities].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [detail]);

  const commentTimeline = useMemo(() => {
    if (!detail?.comments?.length) return [];
    return [...detail.comments].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [detail]);

  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title="Task archive"
        description="Read-only view of completed work: full task details, who created and owned it, every comment, and a full activity trail. Mark a task as Done from the Tasks page to open it here."
        actions={[
          <Chip key="org" color="secondary" label={needsOrgPicker ? "Pick an org (header)" : scopedOrganization?.name || "Your org"} />,
        ]}
      />

      <GlassPanel title="Completed tasks" subtitle="Status DONE · use search to find titles or description text">
        {needsOrgPicker ? (
          <PageState
            empty
            title="Select an organization"
            description="Super admins need to pick an active organization in the header to load the task archive for that org."
          />
        ) : (
          <>
            <TextField
              size="small"
              fullWidth
              sx={{ mb: 2 }}
              placeholder="Search by title or description"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <PageState
              loading={loading}
              error={error}
              empty={!loading && !error && !tasks.length}
              title="No completed tasks in this org"
              description="When work is finished and set to Done, it appears here for audit and review."
              onRetry={loadList}
            />
            {!loading && !error && tasks.length ? (
              <>
                <TableContainer sx={{ borderRadius: 2, bgcolor: (theme) => surfaceSubtle(theme) }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Task</TableCell>
                        <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Assignee</TableCell>
                        <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Creator</TableCell>
                        <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>
                          Completed / updated
                        </TableCell>
                        <TableCell align="right">View</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tasks.map((t) => (
                        <TableRow
                          key={t.id}
                          hover
                          sx={{ cursor: "pointer" }}
                          onClick={() => openDetail(t.id)}
                        >
                          <TableCell>
                            <Typography variant="subtitle2">{t.title}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "block", sm: "none" } }}>
                              {personLabel(t.assignee)} · {formatDateTime(t.updated_at)}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>{personLabel(t.assignee)}</TableCell>
                          <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{personLabel(t.creator)}</TableCell>
                          <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>
                            <Typography variant="body2" color="text.secondary">
                              {formatDateTime(t.updated_at)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              size="small"
                              label="Details"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetail(t.id);
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <PaginationControls
                  meta={meta}
                  disabled={loading}
                  onChange={(next) => setPage(next)}
                />
              </>
            ) : null}
          </>
        )}
      </GlassPanel>

      <Drawer anchor="right" open={Boolean(drawerId)} onClose={closeDetail} PaperProps={{ sx: { width: { xs: "100%", sm: 480, md: 640 } } }}>
        <Box sx={{ p: 2.5, minHeight: "100%" }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
            <Typography variant="h6" component="h2" sx={{ pr: 1 }}>
              Archived task record
            </Typography>
            <IconButton aria-label="Close" onClick={closeDetail} size="small">
              <Close />
            </IconButton>
          </Stack>
          <PageState loading={detailLoading} error={detailError} onRetry={() => drawerId && openDetail(drawerId)} />
          {detail && !detailLoading && !detailError ? (
            <Stack spacing={2.5}>
              <Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
                  <StatusPill value={detail.status} />
                  <StatusPill value={detail.priority} />
                  {detail.sla_status ? <StatusPill value={detail.sla_status} /> : null}
                </Stack>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  {detail.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  Task ID {detail.id} · Org {detail.organization_id}
                </Typography>
              </Box>

              <Grid container spacing={1.5}>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary">
                    Created
                  </Typography>
                  <Typography variant="body2">{formatDateTime(detail.created_at)}</Typography>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary">
                    Last updated
                  </Typography>
                  <Typography variant="body2">{formatDateTime(detail.updated_at)}</Typography>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary">
                    Due
                  </Typography>
                  <Typography variant="body2">{formatDateTime(detail.due_at)}</Typography>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary">
                    SLA hours
                  </Typography>
                  <Typography variant="body2">{detail.sla_hours}</Typography>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary">
                    Risk score
                  </Typography>
                  <Typography variant="body2">{detail.risk_score ?? 0}</Typography>
                </Grid>
              </Grid>

              <Stack spacing={0.5}>
                <Typography variant="subtitle2" color="text.secondary">
                  Assignee
                </Typography>
                <Typography variant="body1">{personLabel(detail.assignee)}</Typography>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
                  Creator
                </Typography>
                <Typography variant="body1">{personLabel(detail.creator)}</Typography>
              </Stack>

              <Divider flexItem />
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  Description
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }} color="text.primary">
                  {detail.description}
                </Typography>
              </Box>
              {detail.tags?.length ? (
                <Stack direction="row" flexWrap="wrap" gap={0.75} useFlexGap>
                  {detail.tags.map((tag) => (
                    <Chip key={tag} size="small" label={tag} />
                  ))}
                </Stack>
              ) : null}
              {detail.external_refs?.length ? (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    External references
                  </Typography>
                  {detail.external_refs.map((ref) => (
                    <Typography key={ref} variant="body2" component="p" sx={{ fontFamily: "ui-monospace, monospace" }} color="text.secondary">
                      {ref}
                    </Typography>
                  ))}
                </Box>
              ) : null}

              {detail.subtasks?.length ? (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Subtasks
                  </Typography>
                  <Stack spacing={1}>
                    {detail.subtasks.map((s) => (
                      <Box key={s.id} sx={{ p: 1.5, borderRadius: 2, bgcolor: (t) => surfaceSubtle(t) }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} flexWrap="wrap">
                          <Typography variant="body2">{s.title}</Typography>
                          <Stack direction="row" spacing={0.5}>
                            <StatusPill value={s.status} />
                            <StatusPill value={s.priority} />
                          </Stack>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {personLabel(s.assignee)} · {formatDateTime(s.due_at)}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              ) : null}

              <Divider flexItem />
              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Comments
                </Typography>
                {commentTimeline.length ? (
                  <Stack spacing={1.2}>
                    {commentTimeline.map((c) => (
                      <Box key={c.id} sx={{ p: 1.5, borderRadius: 2, bgcolor: (t) => surfaceSubtle(t) }}>
                        <Typography variant="subtitle2">
                          {personLabel(c.author)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDateTime(c.created_at)}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>
                          {c.content}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography color="text.secondary" variant="body2">
                    No comments.
                  </Typography>
                )}
              </Box>

              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Watchers
                </Typography>
                {detail.watchers?.length ? (
                  <Stack spacing={0.5}>
                    {detail.watchers.map((w) => (
                      <Typography key={w.id} variant="body2">
                        {personLabel(w.user)}
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                          ({formatDateTime(w.created_at)})
                        </Typography>
                      </Typography>
                    ))}
                  </Stack>
                ) : (
                  <Typography color="text.secondary" variant="body2">
                    None listed.
                  </Typography>
                )}
              </Box>

              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Attachments
                </Typography>
                {detail.attachments?.length ? (
                  <Stack spacing={0.75}>
                    {detail.attachments.map((a) => (
                      <Box key={a.id}>
                        <Typography variant="body2">{a.file_name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {personLabel(a.uploader)} · {formatDateTime(a.created_at)}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography color="text.secondary" variant="body2">
                    None.
                  </Typography>
                )}
              </Box>

              <Box>
                <Typography variant="h6" sx={{ mb: 1.5 }}>
                  Activity — who did what
                </Typography>
                {activityTimeline.length ? (
                  <Stack spacing={1.25}>
                    {activityTimeline.map((a) => (
                      <Box key={a.id} sx={{ p: 1.5, borderRadius: 2, bgcolor: (t) => surfaceSubtle(t) }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} flexWrap="wrap">
                          <Box>
                            <Typography variant="subtitle2">{personLabel(a.user) || (a.user_id == null ? "System / automated" : "Unknown user")}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {a.action_type} · {formatDateTime(a.created_at)}
                            </Typography>
                          </Box>
                        </Stack>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {a.message}
                        </Typography>
                        {a.field_changed ? (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, fontSize: 12 }}>
                            Field: {a.field_changed}
                            {a.old_value != null || a.new_value != null ? (
                              <>
                                <br />
                                {a.old_value != null ? <>Before: {String(a.old_value)}</> : null}
                                {a.old_value != null && a.new_value != null ? " → " : null}
                                {a.new_value != null ? <>After: {String(a.new_value)}</> : null}
                              </>
                            ) : null}
                          </Typography>
                        ) : null}
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography color="text.secondary" variant="body2">
                    No activity log entries.
                  </Typography>
                )}
              </Box>
            </Stack>
          ) : null}
        </Box>
      </Drawer>
    </>
  );
}

export default TaskArchivePage;
