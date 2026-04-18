// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { ContextualDelta } from "../src/components/shared/ContextualDelta";
import { StatusBadge } from "../src/components/shared/StatusBadge";
import { DEMO_ACCOUNTS, getCurrentUser, login, logout } from "../src/lib/auth";
import { backendRole, routeForRole } from "../src/lib/utils";

describe("localStorage auth", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("stores the matching demo account as the current user", () => {
    const account = DEMO_ACCOUNTS[0];
    const user = login(account.email, account.password);

    expect(user.email).toBe(account.email);
    expect(getCurrentUser()?.name).toBe(account.name);
  });

  test("clears the current user on logout", () => {
    const account = DEMO_ACCOUNTS[1];
    login(account.email, account.password);
    logout();

    expect(getCurrentUser()).toBeNull();
  });
});

describe("role helpers", () => {
  test("maps vice principal demo role to Convex staff role", () => {
    expect(backendRole("viceprincipal")).toBe("vice_principal");
  });

  test("routes every demo role to its entry page", () => {
    expect(routeForRole("director")).toBe("/dashboard");
    expect(routeForRole("viceprincipal")).toBe("/vp");
    expect(routeForRole("teacher")).toBe("/teacher");
    expect(routeForRole("admin")).toBe("/admin/staff");
    expect(routeForRole("kitchen")).toBe("/kitchen");
    expect(routeForRole("facilities")).toBe("/facilities");
  });
});

describe("shared UI helpers", () => {
  test("renders contextual delta text for unchanged values", () => {
    render(<ContextualDelta current={3} previous={3} />);
    expect(screen.getByText("без изменений")).toBeTruthy();
  });

  test("renders status labels in Russian", () => {
    render(<StatusBadge status="done" type="task" />);
    expect(screen.getByText("Готово")).toBeTruthy();
  });
});
