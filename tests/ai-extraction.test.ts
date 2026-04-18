import { describe, expect, test, vi } from "vitest";

vi.mock("../convex/lib/ai/reasoning", () => ({
  runJsonReasoning: vi.fn(),
}));

import { runTeacherMessageExtraction } from "../convex/lib/ai/extraction";
import { runJsonReasoning } from "../convex/lib/ai/reasoning";

describe("runTeacherMessageExtraction", () => {
  test("throws validation issues for an invalid extraction payload", async () => {
    vi.mocked(runJsonReasoning).mockResolvedValue({
      provider: "openai",
      model: "gpt-test",
      json: {
        kind: "attendance",
        classCode: "",
        presentCount: 10,
        absentCount: 1,
        confidence: 0.8,
      },
      rawText: "{}",
    });

    await expect(runTeacherMessageExtraction("Class update")).rejects.toThrow(
      /classCode/i,
    );
  });
});
