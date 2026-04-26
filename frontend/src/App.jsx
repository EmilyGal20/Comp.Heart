import { Suspense, lazy } from "react";
import { CircularProgress, Stack } from "@mui/material";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./layout/AppShell";
const AIAssistantPage = lazy(() => import("./pages/AIAssistantPage"));
const ActivityPage = lazy(() => import("./pages/ActivityPage"));
const AnnouncementsPage = lazy(() => import("./pages/AnnouncementsPage"));
const ApprovalsPage = lazy(() => import("./pages/ApprovalsPage"));
const AutomationPage = lazy(() => import("./pages/AutomationPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const ContactsPage = lazy(() => import("./pages/ContactsPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const EmployeesPage = lazy(() => import("./pages/EmployeesPage"));
const GlobalControlCenterPage = lazy(() => import("./pages/GlobalControlCenterPage"));
const KnowledgePage = lazy(() => import("./pages/KnowledgePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const MyWorkPage = lazy(() => import("./pages/MyWorkPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const OrganizationsPage = lazy(() => import("./pages/OrganizationsPage"));
const PermissionsPage = lazy(() => import("./pages/PermissionsPage"));
const PlanningPage = lazy(() => import("./pages/PlanningPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const TasksPage = lazy(() => import("./pages/TasksPage"));
const TaskArchivePage = lazy(() => import("./pages/TaskArchivePage"));
const MeetingsPage = lazy(() => import("./pages/MeetingsPage"));
const EmployeeProfilePage = lazy(() => import("./pages/EmployeeProfilePage"));

function RouteLoader() {
  return (
    <Stack alignItems="center" justifyContent="center" sx={{ minHeight: "50vh" }}>
      <CircularProgress size={28} />
    </Stack>
  );
}

function App() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppShell>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/my-work" element={<ProtectedRoute roles={["USER"]}><MyWorkPage /></ProtectedRoute>} />
                  <Route path="/organizations" element={<ProtectedRoute roles={["SUPER_ADMIN"]}><OrganizationsPage /></ProtectedRoute>} />
                  <Route path="/planning" element={<ProtectedRoute roles={["SUPER_ADMIN", "ADMIN", "MANAGER"]}><PlanningPage /></ProtectedRoute>} />
                  <Route path="/approvals" element={<ApprovalsPage />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/knowledge" element={<KnowledgePage />} />
                  <Route path="/tasks" element={<TasksPage />} />
                  <Route path="/task-archive" element={<TaskArchivePage />} />
                  <Route path="/automation" element={<ProtectedRoute roles={["SUPER_ADMIN", "ADMIN", "MANAGER"]}><AutomationPage /></ProtectedRoute>} />
                  <Route path="/meetings/:meetingId" element={<MeetingsPage />} />
                  <Route path="/meetings" element={<MeetingsPage />} />
                  <Route path="/announcements" element={<AnnouncementsPage importantOnly={false} />} />
                  <Route path="/messages" element={<AnnouncementsPage importantOnly />} />
                  <Route path="/contacts" element={<ContactsPage />} />
                  <Route path="/employees" element={<ProtectedRoute roles={["SUPER_ADMIN", "ADMIN", "MANAGER"]}><EmployeesPage /></ProtectedRoute>} />
                  <Route path="/activity" element={<ActivityPage />} />
                  <Route path="/ai" element={<AIAssistantPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/onboarding" element={<OnboardingPage />} />
                  <Route path="/reports" element={<ProtectedRoute roles={["SUPER_ADMIN", "ADMIN", "MANAGER"]}><ReportsPage /></ProtectedRoute>} />
                  <Route path="/permissions" element={<PermissionsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/people/:userId" element={<EmployeeProfilePage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/control-center" element={<ProtectedRoute roles={["SUPER_ADMIN"]}><GlobalControlCenterPage /></ProtectedRoute>} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AppShell>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}

export default App;
