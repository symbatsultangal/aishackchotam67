import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { AppLoader } from "@/components/AppLoader";
import { useSchool } from "@/context/SchoolContext";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { routeForRole } from "@/lib/utils";
import { Login } from "@/pages/Login";
import { NotFound } from "@/pages/NotFound";
import {
  AnalyticsPage,
  AttendancePage,
  DirectorDashboard,
  DocumentsPage,
  FacilitiesPage,
  IncidentsPage,
  KitchenPage,
  ReviewQueuePage,
  SchedulePage,
  StaffPage,
  SubstitutionsPage,
  TasksPage,
  TeacherCabinet,
  VPDashboard,
  VoiceCommandPage,
} from "@/pages/OperationsPages";
import type { DemoRole } from "@/types";

function RoleRedirect() {
  const user = useCurrentUser();
  return <Navigate to={routeForRole(user?.role)} replace />;
}

function ProtectedLayout({ roles, simple = false }: { roles: DemoRole[]; simple?: boolean }) {
  const { loading } = useSchool();
  const { user } = useRoleGuard(roles);

  if (loading) {
    return <AppLoader />;
  }

  if (!user) {
    return null;
  }

  return <AppLayout simple={simple} />;
}

export function App() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<RoleRedirect />} />
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedLayout roles={["director"]} />}>
          <Route path="/dashboard" element={<DirectorDashboard />} />
          <Route path="/dashboard/attendance" element={<AttendancePage />} />
          <Route path="/dashboard/incidents" element={<IncidentsPage />} />
          <Route path="/dashboard/tasks" element={<TasksPage />} />
          <Route path="/dashboard/substitutions" element={<SubstitutionsPage />} />
          <Route path="/dashboard/documents" element={<DocumentsPage />} />
          <Route path="/dashboard/queue" element={<ReviewQueuePage />} />
          <Route path="/dashboard/voice" element={<VoiceCommandPage />} />
          <Route path="/dashboard/analytics" element={<AnalyticsPage />} />
        </Route>

        <Route element={<ProtectedLayout roles={["viceprincipal"]} />}>
          <Route path="/vp" element={<VPDashboard />} />
          <Route path="/vp/schedule" element={<SchedulePage />} />
          <Route path="/vp/substitutions" element={<SubstitutionsPage />} />
          <Route path="/vp/incidents" element={<IncidentsPage />} />
        </Route>

        <Route element={<ProtectedLayout roles={["teacher"]} />}>
          <Route path="/teacher" element={<TeacherCabinet />} />
          <Route path="/teacher/tasks" element={<TasksPage mine />} />
          <Route path="/teacher/schedule" element={<SchedulePage todayOnly />} />
        </Route>

        <Route element={<ProtectedLayout roles={["admin"]} />}>
          <Route path="/admin" element={<Navigate to="/admin/staff" replace />} />
          <Route path="/admin/staff" element={<StaffPage />} />
          <Route path="/admin/documents" element={<DocumentsPage adminOnly />} />
        </Route>

        <Route element={<ProtectedLayout roles={["kitchen"]} simple />}>
          <Route path="/kitchen" element={<KitchenPage />} />
        </Route>

        <Route element={<ProtectedLayout roles={["facilities"]} simple />}>
          <Route path="/facilities" element={<FacilitiesPage />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}
