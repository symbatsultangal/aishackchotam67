import type { Doc, Id } from "../convex/_generated/dataModel";

export type DemoRole =
  | "director"
  | "viceprincipal"
  | "teacher"
  | "admin"
  | "kitchen"
  | "facilities";

export type BackendRole =
  | "director"
  | "vice_principal"
  | "teacher"
  | "admin"
  | "kitchen"
  | "facilities";

export type CurrentUser = {
  email: string;
  role: DemoRole;
  backendRole: BackendRole;
  name: string;
  staffId: string;
};

export type StaffDoc = Doc<"staff">;
export type SchoolId = Id<"schools">;
export type StaffId = Id<"staff">;
export type ClassId = Id<"classes">;
export type TaskDoc = Doc<"tasks">;
export type IncidentDoc = Doc<"incidents">;
export type SubstitutionRequestDoc = Doc<"substitutionRequests">;
export type AttendanceFactDoc = Doc<"attendanceFacts">;
