import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./layout/AppShell";
import AIAssistantPage from "./pages/AIAssistantPage";
import AutomationPage from "./pages/AutomationPage";
import DashboardPage from "./pages/DashboardPage";
import EmployeesPage from "./pages/EmployeesPage";
import GlobalControlCenterPage from "./pages/GlobalControlCenterPage";
import KnowledgePage from "./pages/KnowledgePage";
import LoginPage from "./pages/LoginPage";
import NotificationsPage from "./pages/NotificationsPage";
import SettingsPage from "./pages/SettingsPage";
import TasksPage from "./pages/TasksPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/knowledge" element={<KnowledgePage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/automation" element={<ProtectedRoute roles={["SUPER_ADMIN", "ADMIN", "MANAGER"]}><AutomationPage /></ProtectedRoute>} />
                <Route path="/employees" element={<ProtectedRoute roles={["SUPER_ADMIN", "ADMIN", "MANAGER"]}><EmployeesPage /></ProtectedRoute>} />
                <Route path="/ai" element={<AIAssistantPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/control-center" element={<ProtectedRoute roles={["SUPER_ADMIN"]}><GlobalControlCenterPage /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
