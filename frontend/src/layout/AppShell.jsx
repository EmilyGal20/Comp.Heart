import { useEffect, useMemo, useState } from "react";
import {
  Apartment,
  AutoAwesome,
  Forum,
  GppGood,
  Hub,
  Insights,
  KeyboardCommandKey,
  Logout,
  MenuBook,
  Notifications,
  People,
  QueryStats,
  Settings,
  Shield,
  SpaceDashboard,
  TaskAlt,
  Timeline,
  Tune,
  WorkOutline,
} from "@mui/icons-material";
import {
  AppBar,
  Avatar,
  Box,
  Chip,
  Dialog,
  DialogContent,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../store/AuthContext";
import { useRealtime } from "../store/RealtimeContext";
import { workApi } from "../api/endpoints";

const drawerWidth = 292;

const navItems = [
  { label: "Global Dashboard", path: "/", icon: <SpaceDashboard />, roles: ["SUPER_ADMIN"] },
  { label: "Org Dashboard", path: "/", icon: <SpaceDashboard />, roles: ["ADMIN", "MANAGER"] },
  { label: "My Dashboard", path: "/", icon: <SpaceDashboard />, roles: ["USER"] },
  { label: "Control Center", path: "/control-center", icon: <Shield />, roles: ["SUPER_ADMIN"] },
  { label: "Organizations", path: "/organizations", icon: <Apartment />, roles: ["SUPER_ADMIN"] },
  { label: "My Work", path: "/my-work", icon: <WorkOutline />, roles: ["USER"] },
  { label: "Planning", path: "/planning", icon: <Timeline />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { label: "Chat", path: "/chat", icon: <Forum />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] },
  { label: "Knowledge", path: "/knowledge", icon: <MenuBook />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] },
  { label: "Tasks", path: "/tasks", icon: <TaskAlt />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] },
  { label: "Automation", path: "/automation", icon: <Hub />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { label: "People", path: "/employees", icon: <People />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { label: "Activity", path: "/activity", icon: <Insights />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] },
  { label: "AI", path: "/ai", icon: <AutoAwesome />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] },
  { label: "Notifications", path: "/notifications", icon: <Notifications />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] },
  { label: "Reports", path: "/reports", icon: <QueryStats />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { label: "Permissions", path: "/permissions", icon: <GppGood />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] },
  { label: "Settings", path: "/settings", icon: <Settings />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] },
];

function AppShell({ children }) {
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, organizations, activeOrganizationId, scopedOrganization, setScopedOrganizationId } = useAuth();
  const { connectionState, versions } = useRealtime();

  const allowedNavItems = useMemo(
    () => navItems.filter((item) => item.roles.includes(user.role)),
    [user.role]
  );

  const pageTitle = useMemo(
    () => allowedNavItems.find((item) => item.path === location.pathname)?.label || "CompHeart",
    [allowedNavItems, location.pathname]
  );

  const organizationOptions = useMemo(
    () => organizations.map((entry) => entry.organization || entry),
    [organizations]
  );

  useEffect(() => {
    const handler = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!paletteOpen || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timeout = window.setTimeout(() => {
      workApi.search({
        q: searchQuery,
        organization_id: user.role === "SUPER_ADMIN" ? activeOrganizationId || undefined : undefined,
      }).then((response) => setSearchResults(response.data));
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [activeOrganizationId, paletteOpen, searchQuery, user.role]);

  const quickCommands = useMemo(() => {
    const base = allowedNavItems.map((item) => ({ type: "command", title: `Open ${item.label}`, path: item.path, id: item.path }));
    return [
      ...base,
      { type: "command", title: "Create task", path: "/tasks", id: "create-task" },
      ...(user.role === "SUPER_ADMIN" ? [{ type: "command", title: "Open organizations", path: "/organizations", id: "orgs" }] : []),
    ];
  }, [allowedNavItems, user.role]);

  const drawerContent = (
    <Box sx={{ p: 2.5, height: "100%", background: "rgba(5, 9, 16, 0.92)", display: "flex", flexDirection: "column" }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 4 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 3,
            background: "linear-gradient(135deg, rgba(116,184,255,0.95), rgba(155,124,255,0.92))",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 18px 44px rgba(85, 112, 255, 0.35)",
          }}
        >
          <Tune />
        </Box>
        <Box>
          <Typography variant="h6">COMPHEART</Typography>
          <Typography variant="body2" sx={{ color: "rgba(226, 232, 240, 0.6)" }}>
            Multi-org company operating system
          </Typography>
        </Box>
      </Stack>
      <List sx={{ display: "grid", gap: 1 }}>
        {allowedNavItems.map((item) => (
          <ListItemButton
            key={item.path}
            component={NavLink}
            to={item.path}
            onClick={() => setOpen(false)}
            sx={{
              borderRadius: 3,
              py: 1.2,
              "&.active": {
                background: "linear-gradient(90deg, rgba(116,184,255,0.18), rgba(155,124,255,0.12))",
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 38, color: "inherit" }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ mt: "auto", pt: 4 }}>
        <Box
          sx={{
            p: 2,
            borderRadius: 4,
            background: user.role === "SUPER_ADMIN"
              ? "linear-gradient(135deg, rgba(255,107,122,0.14), rgba(155,124,255,0.18))"
              : "linear-gradient(135deg, rgba(61,200,255,0.14), rgba(155,124,255,0.14))",
            border: "1px solid rgba(116,184,255,0.18)",
          }}
        >
          <Typography variant="subtitle2">
            {user.role === "SUPER_ADMIN" ? "Global mode available" : "Scoped workspace active"}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: "rgba(226, 232, 240, 0.68)" }}>
            {user.role === "SUPER_ADMIN"
              ? "Switch between all organizations and company-specific contexts from the top bar."
              : "Your permissions and content are scoped to your current organization."}
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        color="transparent"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          background: "rgba(7, 11, 20, 0.78)",
          backdropFilter: "blur(18px)",
          borderBottom: "1px solid rgba(148, 163, 184, 0.08)",
        }}
      >
        <Toolbar sx={{ minHeight: "84px !important", gap: 2 }}>
          <IconButton color="inherit" edge="start" onClick={() => setOpen(true)} sx={{ display: { md: "none" } }}>
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="body2" sx={{ color: "rgba(226, 232, 240, 0.56)" }}>
              {scopedOrganization ? scopedOrganization.name : "Global platform mode"}
            </Typography>
            <Typography variant="h6">{pageTitle}</Typography>
          </Box>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} alignItems={{ xs: "stretch", md: "center" }}>
            <TextField
              size="small"
              placeholder="Search or jump..."
              value={searchQuery}
              onFocus={() => setPaletteOpen(true)}
              onChange={(event) => setSearchQuery(event.target.value)}
              sx={{ minWidth: 230, display: { xs: "none", lg: "flex" } }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                endAdornment: <InputAdornment position="end"><Chip size="small" icon={<KeyboardCommandKey />} label="K" /></InputAdornment>,
              }}
            />
            <Chip
              icon={<Apartment />}
              label={scopedOrganization ? scopedOrganization.slug : "all organizations"}
              color={user.role === "SUPER_ADMIN" ? "secondary" : "info"}
            />
            <Chip label={`Live ${connectionState}`} color={connectionState === "connected" ? "success" : "default"} variant="outlined" />
            <Chip label={`${versions.notifications} signal sync`} variant="outlined" />
            <Chip label={user.role.replace("_", " ")} color={user.role === "SUPER_ADMIN" ? "error" : "primary"} />
            {user.role === "SUPER_ADMIN" ? (
              <FormControl size="small" sx={{ minWidth: 210 }}>
                <InputLabel>Organization scope</InputLabel>
                <Select
                  label="Organization scope"
                  value={activeOrganizationId || ""}
                  onChange={(event) => setScopedOrganizationId(event.target.value ? Number(event.target.value) : null)}
                >
                  <MenuItem value="">All organizations</MenuItem>
                  {organizationOptions.map((organization) => (
                    <MenuItem key={organization.id} value={organization.id}>
                      {organization.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <Chip label={user.organization?.name || "Organization"} variant="outlined" />
            )}
            <Stack direction="row" spacing={1} alignItems="center">
              <Avatar sx={{ bgcolor: "secondary.main" }}>
                {user.full_name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
              </Avatar>
              <IconButton color="inherit" onClick={logout}>
                <Logout />
              </IconButton>
            </Stack>
          </Stack>
        </Toolbar>
      </AppBar>
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={open}
          onClose={() => setOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth, borderRight: "none" } }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
              borderRight: "1px solid rgba(148, 163, 184, 0.08)",
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>
      <Box
        component="main"
        className="hero-grid"
        sx={{
          flexGrow: 1,
          p: { xs: 2.5, md: 4.5 },
          pt: { xs: 14, md: 15.5 },
          width: { md: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 1480, mx: "auto" }}>
          {children}
        </Box>
      </Box>
      <Dialog open={paletteOpen} onClose={() => setPaletteOpen(false)} fullWidth maxWidth="sm">
        <DialogContent sx={{ p: 2.5 }}>
          <Stack spacing={1.5}>
            <TextField
              autoFocus
              placeholder="Search tasks, users, docs, orgs, or commands"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
            />
            <Typography variant="caption" sx={{ color: "rgba(226,232,240,0.55)" }}>Quick actions</Typography>
            <List sx={{ display: "grid", gap: 0.5 }}>
              {(searchResults.length ? searchResults : quickCommands).map((item) => (
                <ListItemButton
                  key={`${item.type}-${item.id}`}
                  onClick={() => {
                    setPaletteOpen(false);
                    navigate(item.path);
                    setSearchQuery("");
                  }}
                  sx={{ borderRadius: 3 }}
                >
                  <ListItemText primary={item.title} secondary={item.subtitle || item.type} />
                </ListItemButton>
              ))}
            </List>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default AppShell;
