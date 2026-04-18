import { createContext, useContext, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { CurrentUser } from "@/types";

type SchoolContextValue = {
  currentUser: CurrentUser | null;
  schoolId: Id<"schools"> | null;
  school: Doc<"schools"> | null;
  currentStaff: Doc<"staff"> | null;
  staff: Doc<"staff">[];
  classes: Doc<"classes">[];
  staffById: Map<Id<"staff">, Doc<"staff">>;
  classById: Map<Id<"classes">, Doc<"classes">>;
  loading: boolean;
};

const SchoolContext = createContext<SchoolContextValue | null>(null);

function normalizeName(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function SchoolProvider({ children }: { children: React.ReactNode }) {
  const currentUser = useCurrentUser();
  const schools = useQuery(api["modules/schoolCore/schools"].list, {});
  const school = schools?.[0] ?? null;
  const schoolId = school?._id ?? null;
  const staff =
    useQuery(
      api["modules/schoolCore/staff"].listBySchool,
      schoolId ? { schoolId, activeOnly: true } : "skip",
    ) ?? [];
  const classes =
    useQuery(api["modules/schoolCore/classes"].listActive, schoolId ? { schoolId } : "skip") ?? [];

  const currentStaff = useMemo(() => {
    if (!currentUser) return null;
    const byName = staff.find(
      (member) =>
        normalizeName(member.displayName) === normalizeName(currentUser.name) ||
        normalizeName(member.fullName) === normalizeName(currentUser.name),
    );
    if (byName) return byName;
    return staff.find((member) => member.roles.includes(currentUser.backendRole)) ?? null;
  }, [currentUser, staff]);

  const value = useMemo<SchoolContextValue>(
    () => ({
      currentUser,
      schoolId,
      school,
      currentStaff,
      staff,
      classes,
      staffById: new Map(staff.map((member) => [member._id, member])),
      classById: new Map(classes.map((classDoc) => [classDoc._id, classDoc])),
      loading: schools === undefined,
    }),
    [classes, currentStaff, currentUser, school, schoolId, schools, staff],
  );

  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>;
}

export function useSchool() {
  const value = useContext(SchoolContext);
  if (!value) {
    throw new Error("useSchool must be used inside SchoolProvider");
  }
  return value;
}
