import { useEffect, useMemo, useRef, useState } from "react";
import {
  Apartment,
  Archive,
  AutoAwesome,
  Campaign,
  FactCheck,
  Forum,
  GppGood,
  Hub,
  Insights,
  KeyboardCommandKey,
  Logout,
  MenuBook,
  Notifications,
  PersonSearch,
  People,
  QueryStats,
  RocketLaunch,
  RecordVoiceOver,
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
  Divider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../store/AuthContext";
import { useRealtime } from "../store/RealtimeContext";
import { useThemeMode } from "../store/ThemeModeContext";
import { workApi } from "../api/endpoints";

const drawerWidth = 292;

const compareNavLabel = (a, b) => a.label.localeCompare(b.label, "en", { numeric: true, sensitivity: "base" });

const NAV_SECTIONS = [
  {
    id: "home",
    items: [
      { label: "Global Dashboard", path: "/", icon: <SpaceDashboard />, roles: ["SUPER_ADMIN"] },
      { label: "Org Dashboard", path: "/", icon: <SpaceDashboard />, roles: ["ADMIN", "MANAGER"] },
      { label: "My Dashboard", path: "/", icon: <SpaceDashboard />, roles: ["USER"] },
    ],
  },
  {
    id: "work",
    items: [
      { label: "Approvals", path: "/approvals", icon: <FactCheck />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] },
      { label: "Automation", path: "/automation", icon: <Hub />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
      { label: "Meetings", path: "/meetings", icon: <RecordVoiceOver />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] },
      { label: "My Work", path: "/my-work", icon: <WorkOutline />, roles: ["USER"] },
      { label: "Planning", path: "/planning", icon: <Timeline />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
      { label: "Reports", path: "/reports", icon: <QueryStats />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
      { label: "Search", path: "/search", icon: <PersonSearch />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] },
      { label: "Task archive", path: "/task-archive", icon: <Archive />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] },
      { label: "Tasks", path: "/tasks", icon: <TaskAlt />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] },
    ],
  },
  {
    id: "collaboration",
    items: [
      { label: "Activity", path: "/activity", icon: <Insights />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] },
      { label: "Admin Messages", path: "/messages", icon: <Notifications />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] },
      { label: "AI", path: "/ai", icon: <AutoAwesome />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] },
      { label: "Announcements", path: "/announcements", icon: <Campaign />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] },
      { label: "Chat", path: "/chat", icon: <Forum />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] },
      { label: "Contacts", path: "/contacts", icon: <People />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] },
      { label: "Knowledge", path: "/knowledge", icon: <MenuBook />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] },
      { label: "Notifications", path: "/notifications", icon: <Notifications />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] },
    ],
  },
  {
    id: "administration",
    items: [
      { label: "Control Center", path: "/control-center", icon: <Shield />, roles: ["SUPER_ADMIN"] },
      { label: "Onboarding", path: "/onboarding", icon: <RocketLaunch />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] },
      { label: "Organizations", path: "/organizations", icon: <Apartment />, roles: ["SUPER_ADMIN"] },
      { label: "People Admin", path: "/employees", icon: <People />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
      { label: "Permissions", path: "/permissions", icon: <GppGood />, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] },
    ],
  },
];

function AppShell({ children }) {
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  // Closing the search dialog returns focus to the app bar field; MUI's focus restore would retrigger onFocus and reopen the palette.
  const suppressAppBarSearchFocusOpen = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, organizations, activeOrganizationId, scopedOrganization, setScopedOrganizationId } = useAuth();
  const { connectionState, versions } = useRealtime();
  const { themeMode, setThemeMode } = useThemeMode();

  const allowedNavSections = useMemo(() => {
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.id === "home" ? section.items.filter((item) => item.roles.includes(user.role)) : section.items.filter((item) => item.roles.includes(user.role)).sort(compareNavLabel),
    })).filter((section) => section.items.length > 0);
  }, [user.role]);

  const allowedNavItems = useMemo(
    () => allowedNavSections.flatMap((s) => s.items),
    [allowedNavSections]
  );

  const pageTitle = useMemo(() => {
    if (location.pathname === "/profile") return "Profile";
    if (location.pathname === "/settings") return "Settings";
    return allowedNavItems.find((item) => item.path === location.pathname)?.label || "CompHeart";
  }, [allowedNavItems, location.pathname]);

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
    const trimmedQuery = searchQuery.trim();
    let active = true;
    if (!paletteOpen || !trimmedQuery) {
      setSearchResults([]);
      return;
    }
    const timeout = window.setTimeout(() => {
      workApi.search({
        q: trimmedQuery,
        organization_id: user.role === "SUPER_ADMIN" ? activeOrganizationId || undefined : undefined,
      })
        .then((response) => {
          if (!active) return;
          setSearchResults(Array.isArray(response.data) ? response.data : []);
        })
        .catch(() => {
          if (!active) return;
          setSearchResults([]);
        });
    }, 150);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [activeOrganizationId, paletteOpen, searchQuery, user.role]);

  const quickCommands = useMemo(() => {
    const base = allowedNavItems.map((item) => ({ type: "command", title: `Open ${item.label}`, path: item.path, id: `${item.label}|${item.path}` }));
    return [
      ...base,
      { type: "command", title: "Open Profile", path: "/profile", id: "open-profile" },
      { type: "command", title: "Open Settings", path: "/settings", id: "open-settings" },
      { type: "command", title: "Create task", path: "/tasks", id: "create-task" },
      ...(user.role === "SUPER_ADMIN" ? [{ type: "command", title: "Open organizations", path: "/organizations", id: "orgs" }] : []),
    ];
  }, [allowedNavItems, user.role]);

  const handleAppBarSearchFocus = () => {
    if (suppressAppBarSearchFocusOpen.current) {
      suppressAppBarSearchFocusOpen.current = false;
      return;
    }
    setPaletteOpen(true);
  };

  const handleSearchDialogClose = () => {
    suppressAppBarSearchFocusOpen.current = true;
    setPaletteOpen(false);
    setSearchQuery("");
  };

  const drawerContent = (
    <Box
      sx={{
        p: 2.5,
        height: "100%",
        background: (theme) =>
          theme.palette.mode === "light" ? "rgba(244, 247, 252, 0.94)" : "rgba(5, 9, 16, 0.92)",
        display: "flex",
        flexDirection: "column",
      }}
    >
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
          <Typography variant="body2" color="text.secondary">
            Multi-org company operating system
          </Typography>
        </Box>
      </Stack>
      <Stack component="nav" spacing={0} sx={{ minHeight: 0 }}>
        {allowedNavSections.map((section, sectionIndex) => (
          <Box key={section.id}>
            {sectionIndex > 0 ? <Divider sx={{ my: 1.75, borderColor: (theme) => (theme.palette.mode === "light" ? "rgba(15, 23, 42, 0.12)" : "rgba(148, 163, 184, 0.2)") }} /> : null}
            <List disablePadding dense sx={{ display: "grid", gap: 1, py: 0.25 }}>
              {section.items.map((item) => (
                <ListItemButton
                  key={`${item.label}-${item.path}`}
                  component={NavLink}
                  to={item.path}
                  onClick={() => setOpen(false)}
                  sx={{
                    borderRadius: 2,
                    py: 1.2,
                    "&.active": {
                      background: (theme) =>
                        theme.palette.mode === "light"
                          ? "linear-gradient(90deg, rgba(37,99,235,0.1), rgba(109,74,255,0.08))"
                          : "linear-gradient(90deg, rgba(116,184,255,0.18), rgba(155,124,255,0.12))",
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 38, color: "inherit" }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              ))}
            </List>
          </Box>
        ))}
      </Stack>
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
          background: (theme) =>
            theme.palette.mode === "light" ? "rgba(237, 242, 248, 0.82)" : "rgba(7, 11, 20, 0.78)",
          backdropFilter: "blur(18px)",
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Toolbar sx={{ minHeight: "84px !important", gap: 2 }}>
          <IconButton color="inherit" edge="start" onClick={() => setOpen(true)} sx={{ display: { md: "none" } }}>
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {scopedOrganization ? scopedOrganization.name : "Global platform mode"}
            </Typography>
            <Typography variant="h6">{pageTitle}</Typography>
          </Box>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} alignItems={{ xs: "stretch", md: "center" }}>
            <TextField
              size="small"
              placeholder="Search or jump..."
              value={searchQuery}
              onClick={() => setPaletteOpen(true)}
              onFocus={handleAppBarSearchFocus}
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
            <ToggleButtonGroup
              size="small"
              exclusive
              value={themeMode}
              onChange={(_, value) => value && setThemeMode(value)}
              sx={{ display: { xs: "none", lg: "inline-flex" } }}
            >
              <ToggleButton value="light">Light</ToggleButton>
              <ToggleButton value="dark">Dark</ToggleButton>
              <ToggleButton value="system">System</ToggleButton>
            </ToggleButtonGroup>
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
            <Stack direction="row" spacing={0.5} alignItems="center">
              <IconButton color="inherit" onClick={() => navigate("/settings")} aria-label="Open settings" title="Settings" size="small" sx={{ p: 0.9 }}>
                <Settings fontSize="medium" />
              </IconButton>
              <IconButton
                color="inherit"
                onClick={() => navigate("/profile")}
                aria-label="Open profile"
                title="Profile"
                size="small"
                sx={{ p: 0.35 }}
              >
                <Avatar sx={{ bgcolor: "secondary.main", width: 36, height: 36, fontSize: 14 }}>
                  {user.full_name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                </Avatar>
              </IconButton>
              <IconButton color="inherit" onClick={logout} aria-label="Log out">
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
      <Dialog open={paletteOpen} onClose={handleSearchDialogClose} fullWidth maxWidth="sm">
        <DialogContent sx={{ p: 2.5 }}>
          <Stack spacing={1.5}>
            <TextField
              autoFocus
              placeholder="Search tasks, users, docs, orgs, or commands"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
            />
            <Typography variant="caption" color="text.secondary">Quick actions</Typography>
            <List sx={{ display: "grid", gap: 0.5 }}>
              {(searchResults.length ? searchResults : quickCommands).map((item) => (
                <ListItemButton
                  key={`${item.type}-${item.id}`}
                  onClick={() => {
                    suppressAppBarSearchFocusOpen.current = false;
                    setPaletteOpen(false);
                    if (item.path) navigate(item.path);
                    setSearchQuery("");
                  }}
                  sx={{ borderRadius: 2 }}
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
