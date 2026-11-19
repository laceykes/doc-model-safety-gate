import { describe, it, expect } from "vitest";
import { tools } from "../src/tools.js";
import type { GraphQLClient } from "../src/graphql-client.js";

function mockClient(response: Record<string, unknown>): GraphQLClient {
  return {
    query: async () => ({ data: response }),
  } as unknown as GraphQLClient;
}

function findTool(name: string) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool ${name} not found`);
  return tool;
}

const GATE_TOOLS = [
  "listPendingReviews",
  "getGateReview",
  "reviewOutput",
  "bulkReviewOutputs",
  "publishReviewedRun",
  "rollbackRun",
];

describe("MCP Safety Gate tools", () => {
  it("exports all expected gate tools", () => {
    const names = tools.map((t) => t.name);
    for (const name of GATE_TOOLS) {
      expect(names).toContain(name);
    }
  });

  it("listPendingReviews calls query with projectId", async () => {
    const client = mockClient({
      pendingGateReviews: [{ runId: "r1", workflowId: "w1", pendingCount: 3 }],
    });
    const tool = findTool("listPendingReviews");
    const result = await tool.handler({ projectId: "p1" }, client);
    expect(result).toEqual({
      pendingGateReviews: [{ runId: "r1", workflowId: "w1", pendingCount: 3 }],
    });
  });

  it("getGateReview calls query with runId", async () => {
    const client = mockClient({
      aiRunOutputs: [{ id: "o1", fieldSlug: "title", status: "pending" }],
    });
    const tool = findTool("getGateReview");
    const result = await tool.handler({ runId: "r1" }, client);
    expect(result).toEqual({
      aiRunOutputs: [{ id: "o1", fieldSlug: "title", status: "pending" }],
    });
  });

  it("reviewOutput calls mutation with action", async () => {
    const client = mockClient({
      reviewAIOutput: { id: "o1", status: "accepted", editedValue: null },
    });
    const tool = findTool("reviewOutput");
    const result = await tool.handler({ id: "o1", action: "accepted" }, client);
    expect(result).toEqual({
      reviewAIOutput: { id: "o1", status: "accepted", editedValue: null },
    });
  });

  it("bulkReviewOutputs returns the reviewed count", async () => {
    const client = mockClient({ bulkReviewAIOutputs: 4 });
    const tool = findTool("bulkReviewOutputs");
    const result = await tool.handler({ runId: "r1", action: "accepted" }, client);
    expect(result).toEqual({ bulkReviewAIOutputs: 4 });
  });

  it("publishReviewedRun calls runWorkflow mutation", async () => {
    const client = mockClient({
      runWorkflow: { id: "r2", status: "completed", runMode: "LIVE" },
    });
    const tool = findTool("publishReviewedRun");
    const result = await tool.handler(
      { workflowId: "w1", reviewRunId: "r1" },
      client
    );
    expect(result).toEqual({
      runWorkflow: { id: "r2", status: "completed", runMode: "LIVE" },
    });
  });

  it("rollbackRun calls rollback mutation with runId", async () => {
    const client = mockClient({
      rollbackWorkflowRun: { id: "r1", status: "completed" },
    });
    const tool = findTool("rollbackRun");
    const result = await tool.handler({ runId: "r1" }, client);
    expect(result).toEqual({
      rollbackWorkflowRun: { id: "r1", status: "completed" },
    });
  });

  it("each gate tool has valid inputSchema", () => {
    for (const name of GATE_TOOLS) {
      const tool = findTool(name);
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.properties).toBeDefined();
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });
});
