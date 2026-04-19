import { describe, expect, test } from "vitest";

import {
  stripJsonFences,
  parseLooseJson,
} from "../convex/lib/ai/reasoning";

describe("stripJsonFences", () => {
  test("strips ```json ... ``` wrappers", () => {
    const raw = '```json\n{"a": 1}\n```';
    expect(stripJsonFences(raw)).toBe('{"a": 1}');
  });

  test("strips plain ``` ... ``` wrappers", () => {
    const raw = '```\n{"b": 2}\n```';
    expect(stripJsonFences(raw)).toBe('{"b": 2}');
  });

  test("returns plain JSON unchanged", () => {
    const raw = '{"c": 3}';
    expect(stripJsonFences(raw)).toBe('{"c": 3}');
  });

  test("handles extra whitespace around fences", () => {
    const raw = '  ```json  \n  {"d": 4}  \n```  ';
    expect(stripJsonFences(raw)).toBe('{"d": 4}');
  });
});

describe("parseLooseJson", () => {
  test("parses valid JSON", () => {
    expect(parseLooseJson('{"a": 1}')).toEqual({ a: 1 });
  });

  test("strips fences before parsing", () => {
    expect(parseLooseJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  test("repairs trailing comma in object", () => {
    expect(parseLooseJson('{"a": 1,}')).toEqual({ a: 1 });
  });

  test("repairs trailing comma in array", () => {
    expect(parseLooseJson('[1, 2, 3,]')).toEqual([1, 2, 3]);
  });

  test("returns null on garbage input", () => {
    expect(parseLooseJson("not json at all")).toBeNull();
  });

  test("returns null on empty input", () => {
    expect(parseLooseJson("")).toBeNull();
  });

  test("handles nested fenced JSON with trailing comma", () => {
    const input = '```json\n{"tasks": [{"title": "test",}],}\n```';
    const result = parseLooseJson<{ tasks: Array<{ title: string }> }>(input);
    expect(result).toEqual({ tasks: [{ title: "test" }] });
  });
});
