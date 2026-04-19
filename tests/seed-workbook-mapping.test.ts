import { describe, expect, test } from "vitest";

import {
  assessAssessmentSheetMutation,
  assessRoomCatalogMutations,
  assessScheduleCellMutation,
  assessTimeSlotMutation,
  assessWorkloadRowMutations,
} from "../convex/lib/seedWorkbookMapping";

describe("seed workbook mutation mapping", () => {
  test("maps a simple weekly lesson cell to the flat schedule seed mutation", () => {
    expect(
      assessScheduleCellMutation({
        rawCellText: "Орыс тілі Гореева А.М.",
        rawRoomText: "303",
      }),
    ).toBe("modules/schoolCore/schedule:seed");
  });

  test("maps a composite weekly lesson cell to the composite schedule mutation", () => {
    expect(
      assessScheduleCellMutation({
        rawCellText:
          "Математика(ЖоламанМ, Даулетбаева С)/англ.яз(Таңатар М)/химия(Назаров Д)/құқық(Қангерей Қ)",
        rawRoomText: "204,109/305/201/310",
      }),
    ).toBe("modules/schoolCore/schedule:seedCompositeEntries");
  });

  test("maps a timetable lesson row to the time slot upsert mutation", () => {
    expect(
      assessTimeSlotMutation({
        lessonNumber: 1,
        timeLabel: "08.00–08.45",
      }),
    ).toBe("modules/schoolCore/timeSlots:upsertMany");
  });

  test("maps a basic room row to the base room upsert mutation", () => {
    expect(
      assessRoomCatalogMutations({
        code: "110",
        capacity: 22,
      }),
    ).toEqual(["modules/schoolCore/rooms:upsertMany"]);
  });

  test("maps a detailed room row to both room mutations", () => {
    expect(
      assessRoomCatalogMutations({
        code: "109",
        capacity: 22,
        floor: 1,
        managerName: "Жоламан Мейрамбек",
        description: "математика",
        homeClassCode: "11B",
      }),
    ).toEqual([
      "modules/schoolCore/rooms:upsertMany",
      "modules/schoolCore/rooms:upsertDetails",
    ]);
  });

  test("maps a workload teacher-start row to staff seed and optional load profiles", () => {
    expect(
      assessWorkloadRowMutations(
        {
          rowKind: "teacher_start",
          teacherName: "Нажмадинов Марат",
          subject: "алгебра",
          diplomaSpecialty: "математика",
          weeklyLoadTarget: 19,
        },
        { persistWorkbookFields: true },
      ),
    ).toEqual([
      "modules/schoolCore/staff:seed",
      "modules/schoolCore/staff:upsertLoadProfiles",
    ]);
  });

  test("maps a workload continuation row to load-profile persistence when workbook fields matter", () => {
    expect(
      assessWorkloadRowMutations(
        {
          rowKind: "teacher_subject_continuation",
          subject: "геометрия",
          weeklyLoadTarget: 19,
        },
        { persistWorkbookFields: true },
      ),
    ).toEqual(["modules/schoolCore/staff:upsertLoadProfiles"]);
  });

  test("maps a tjb or bjb sheet to the assessment mutation", () => {
    expect(assessAssessmentSheetMutation("ТЖБ 12.03-17.03")).toBe(
      "modules/schoolCore/assessments:upsertMany",
    );
    expect(assessAssessmentSheetMutation("БЖБ кестесі")).toBe(
      "modules/schoolCore/assessments:upsertMany",
    );
  });
});
