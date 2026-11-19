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

describe("MCP tools", () => {
  it("exports all expected tools", () => {
    const names = tools.map((t) => t.name);
    expect(names).toContain("listWorkflows");
    expect(names).toContain("getWorkflow");
    expect(names).toContain("createWorkflow");
    expect(names).toContain("runWorkflow");
    expect(names).toContain("getRunStatus");
    expect(names).toContain("listWorkflowNodes");
    expect(names).toContain("createWorkflowNode");
    expect(names).toContain("createWorkflowEdge");
    expect(names).toContain("getNodeRuns");
  });

  it("listWorkflows calls query with projectId", async () => {
    const client = mockClient({ workflows: [{ id: "w1", name: "Test" }] });
    const tool = findTool("listWorkflows");
    const result = await tool.handler({ projectId: "p1" }, client);
    expect(result).toEqual({ workflows: [{ id: "w1", name: "Test" }] });
  });

  it("getWorkflow calls query with id", async () => {
    const client = mockClient({ workflow: { id: "w1", name: "My WF" } });
    const tool = findTool("getWorkflow");
    const result = await tool.handler({ id: "w1" }, client);
    expect(result).toEqual({ workflow: { id: "w1", name: "My WF" } });
  });

  it("runWorkflow calls mutation with mode", async () => {
    const client = mockClient({ runWorkflow: { id: "r1", status: "completed" } });
    const tool = findTool("runWorkflow");
    const result = await tool.handler({ workflowId: "w1", mode: "DRY_RUN" }, client);
    expect(result).toEqual({ runWorkflow: { id: "r1", status: "completed" } });
  });

  it("createWorkflowNode calls mutation", async () => {
    const client = mockClient({ createWorkflowNode: { id: "n1", nodeType: "ai.fill" } });
    const tool = findTool("createWorkflowNode");
    const result = await tool.handler(
      { workflowId: "w1", nodeType: "ai.fill", label: "AI", config: {} },
      client
    );
    expect(result).toEqual({ createWorkflowNode: { id: "n1", nodeType: "ai.fill" } });
  });

  it("createWorkflowEdge calls mutation", async () => {
    const client = mockClient({ createWorkflowEdge: { id: "e1" } });
    const tool = findTool("createWorkflowEdge");
    const result = await tool.handler(
      { workflowId: "w1", sourceNodeId: "n1", targetNodeId: "n2" },
      client
    );
    expect(result).toEqual({ createWorkflowEdge: { id: "e1" } });
  });

  it("getNodeRuns calls query with runId", async () => {
    const client = mockClient({ workflowNodeRuns: [{ id: "nr1", status: "completed" }] });
    const tool = findTool("getNodeRuns");
    const result = await tool.handler({ runId: "r1" }, client);
    expect(result).toEqual({ workflowNodeRuns: [{ id: "nr1", status: "completed" }] });
  });

  it("returns errors when GraphQL returns errors", async () => {
    const client = {
      query: async () => ({ errors: [{ message: "Not found" }] }),
    } as unknown as GraphQLClient;
    const tool = findTool("getWorkflow");
    const result = await tool.handler({ id: "bad" }, client);
    expect(result).toEqual([{ message: "Not found" }]);
  });

  it("each tool has valid inputSchema", () => {
    for (const tool of tools) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.properties).toBeDefined();
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });
});
