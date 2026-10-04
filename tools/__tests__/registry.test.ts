/**
 * tools/__tests__/registry.test.ts
 *
 * Unit tests for the tool registry — no real DB calls needed for the
 * registry security tests (we mock the tools).
 */

import { executeTool, getRegisteredToolNames } from "../registry";

describe("Tool Registry", () => {
  it("returns the list of registered tool names", () => {
    const names = getRegisteredToolNames();
    expect(names).toContain("check_device");
    expect(names).toContain("check_asset");
    expect(names).toContain("check_employee_access");
    expect(names).toContain("search_policy");
    expect(names).toContain("get_employee");
    expect(names).toContain("get_previous_tickets");
    expect(names).toContain("create_ticket");
    expect(names).toContain("assign_ticket");
    expect(names).toContain("update_ticket");
    expect(names).toContain("log_agent_action");
    expect(names).toHaveLength(10);
  });

  it("rejects unknown tool names", async () => {
    await expect(
      executeTool("drop_table", { table: "employees" })
    ).rejects.toThrow(/Unknown tool: "drop_table"/);
  });

  it("rejects eval-like tool names", async () => {
    await expect(executeTool("eval", { code: "process.exit(1)" })).rejects.toThrow(
      /Unknown tool/
    );
  });

  it("rejects empty tool name", async () => {
    await expect(executeTool("", {})).rejects.toThrow(/Unknown tool/);
  });

  it("rejects arbitrary JavaScript injection attempts", async () => {
    await expect(
      executeTool("__proto__", { pollute: true })
    ).rejects.toThrow(/Unknown tool/);
  });
});
