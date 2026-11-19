import type { GraphQLClient } from "./graphql-client.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, client: GraphQLClient) => Promise<unknown>;
}

export const tools: ToolDefinition[] = [
  {
    name: "listWorkflows",
    description:
      "List workflow definitions for a project, optionally filtered to one site.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Project ID" },
        siteId: { type: "string", description: "Optional site ID filter" },
      },
      required: ["projectId"],
    },
    handler: async (args, client) => {
      const result = await client.query(`
        query ListWorkflows($projectId: ID!, $siteId: ID) {
          workflowDefinitions(projectId: $projectId, siteId: $siteId) {
            id projectId siteId name description targetCollectionId triggerType scheduleCron status
          }
        }
      `, { projectId: args.projectId, siteId: args.siteId });
      return result.data ?? result.errors;
    },
  },

  {
    name: "getWorkflow",
    description:
      "Get one workflow definition by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Workflow definition ID" },
      },
      required: ["id"],
    },
    handler: async (args, client) => {
      const result = await client.query(`
        query GetWorkflow($id: ID!) {
          workflowDefinition(id: $id) {
            id projectId siteId name description targetCollectionId triggerType scheduleCron status
          }
        }
      `, { id: args.id });
      return result.data ?? result.errors;
    },
  },

  {
    name: "createWorkflow",
    description:
      "Create a workflow definition (the step-based editor path). The API requires at least one step: pass steps as an array of { position, stepType, configJson, isEnabled? }. For graph-based workflows, create the definition here, then add nodes and edges with the graph tools.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Project ID" },
        siteId: { type: "string", description: "Site ID" },
        name: { type: "string", description: "Workflow name" },
        description: { type: "string", description: "Optional description" },
        targetCollectionId: { type: "string", description: "Target collection ID" },
        triggerType: {
          type: "string",
          description: "Trigger type (defaults to manual on the server)",
        },
        steps: {
          type: "array",
          description: "At least one step: { position, stepType, configJson, isEnabled? }",
          items: { type: "object" },
        },
      },
      required: ["projectId", "siteId", "name", "targetCollectionId", "steps"],
    },
    handler: async (args, client) => {
      const result = await client.query(`
        mutation CreateWorkflow($input: CreateWorkflowDefinitionInput!) {
          createWorkflowDefinition(input: $input) {
            id projectId siteId name targetCollectionId triggerType status
          }
        }
      `, {
        input: {
          projectId: args.projectId,
          siteId: args.siteId,
          name: args.name,
          description: args.description,
          targetCollectionId: args.targetCollectionId,
          triggerType: args.triggerType,
          steps: args.steps,
        },
      });
      return result.data ?? result.errors;
    },
  },

  {
    name: "runWorkflow",
    description: "Run a workflow in DRY_RUN or LIVE mode",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: { type: "string", description: "Workflow ID" },
        mode: { type: "string", enum: ["DRY_RUN", "LIVE"], description: "Run mode" },
        reviewRunId: { type: "string", description: "Review run ID for LIVE mode (optional)" },
      },
      required: ["workflowId", "mode"],
    },
    handler: async (args, client) => {
      const result = await client.query(`
        mutation RunWorkflow($workflowId: ID!, $mode: RunMode!, $reviewRunId: ID) {
          runWorkflow(workflowId: $workflowId, mode: $mode, reviewRunId: $reviewRunId) {
            id status runMode summaryJson errorLog
          }
        }
      `, {
        workflowId: args.workflowId,
        mode: args.mode,
        reviewRunId: args.reviewRunId,
      });
      return result.data ?? result.errors;
    },
  },

  {
    name: "getRunStatus",
    description: "Get the status and details of a workflow run",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "Run ID" },
      },
      required: ["runId"],
    },
    handler: async (args, client) => {
      const result = await client.query(`
        query RunDetail($runId: ID!) {
          workflowRunDetail(runId: $runId) {
            id status runMode summaryJson errorLog
          }
        }
      `, { runId: args.runId });
      return result.data ?? result.errors;
    },
  },

  {
    name: "listWorkflowNodes",
    description: "List all nodes in a workflow graph",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: { type: "string", description: "Workflow ID" },
      },
      required: ["workflowId"],
    },
    handler: async (args, client) => {
      const result = await client.query(`
        query Nodes($workflowId: ID!) {
          workflowNodes(workflowId: $workflowId) {
            id nodeType label config positionX positionY
          }
        }
      `, { workflowId: args.workflowId });
      return result.data ?? result.errors;
    },
  },

  {
    name: "createWorkflowNode",
    description: "Add a node to a workflow graph",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: { type: "string" },
        nodeType: { type: "string", description: "Node type (e.g. trigger.start, ai.fill, data.fetch)" },
        label: { type: "string" },
        config: { type: "object", description: "Node configuration" },
      },
      required: ["workflowId", "nodeType"],
    },
    handler: async (args, client) => {
      const result = await client.query(`
        mutation CreateNode($workflowId: ID!, $input: WorkflowNodeInput!) {
          createWorkflowNode(workflowId: $workflowId, input: $input) {
            id nodeType label config
          }
        }
      `, {
        workflowId: args.workflowId,
        input: {
          nodeType: args.nodeType,
          label: args.label,
          config: args.config ?? {},
        },
      });
      return result.data ?? result.errors;
    },
  },

  {
    name: "createWorkflowEdge",
    description: "Connect two nodes with an edge",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: { type: "string" },
        sourceNodeId: { type: "string" },
        targetNodeId: { type: "string" },
        condition: { type: "object", description: "Optional edge condition" },
      },
      required: ["workflowId", "sourceNodeId", "targetNodeId"],
    },
    handler: async (args, client) => {
      const result = await client.query(`
        mutation CreateEdge($input: WorkflowEdgeInput!) {
          createWorkflowEdge(input: $input) {
            id sourceNodeId targetNodeId
          }
        }
      `, {
        input: {
          workflowId: args.workflowId,
          sourceNodeId: args.sourceNodeId,
          targetNodeId: args.targetNodeId,
          condition: args.condition,
        },
      });
      return result.data ?? result.errors;
    },
  },

  {
    name: "getNodeRuns",
    description: "Get node-level run results for a workflow run",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "Run ID" },
      },
      required: ["runId"],
    },
    handler: async (args, client) => {
      const result = await client.query(`
        query NodeRuns($runId: ID!) {
          workflowNodeRuns(runId: $runId) {
            id nodeId status output error startedAt completedAt
          }
        }
      `, { runId: args.runId });
      return result.data ?? result.errors;
    },
  },

  {
    name: "listPendingReviews",
    description:
      "List workflow runs whose AI outputs are waiting for human review in the Safety Gate, with a pending count for each. Nothing in these runs has been published.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Project ID" },
      },
      required: ["projectId"],
    },
    handler: async (args, client) => {
      const result = await client.query(`
        query PendingGateReviews($projectId: ID!) {
          pendingGateReviews(projectId: $projectId) {
            runId workflowId workflowName createdAt pendingCount
          }
        }
      `, { projectId: args.projectId });
      return result.data ?? result.errors;
    },
  },

  {
    name: "getGateReview",
    description:
      "Get every AI output waiting in the Safety Gate for one run, field by field: the original value, the AI's proposed value, and its review status (pending, accepted, rejected, edited). This is the diff a human reviews before anything can go live.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "Run ID" },
      },
      required: ["runId"],
    },
    handler: async (args, client) => {
      const result = await client.query(`
        query GateReviewOutputs($runId: ID!) {
          aiRunOutputs(runId: $runId) {
            id runId connector siteId datasetId itemId fieldSlug originalValue aiValue status editedValue stepType createdAt
          }
        }
      `, { runId: args.runId });
      return result.data ?? result.errors;
    },
  },

  {
    name: "reviewOutput",
    description:
      "Record a human review decision for one AI output in the Safety Gate: accepted, rejected, or edited. When the action is edited, pass editedValue with the corrected value. Reviewing never publishes anything by itself; a run can only go LIVE after every output is reviewed.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "AI output ID" },
        action: {
          type: "string",
          enum: ["accepted", "rejected", "edited"],
          description: "Review decision",
        },
        editedValue: {
          type: "string",
          description: "Corrected value, required when action is edited",
        },
      },
      required: ["id", "action"],
    },
    handler: async (args, client) => {
      const result = await client.query(`
        mutation ReviewAIOutput($id: ID!, $action: AIOutputStatus!, $editedValue: String) {
          reviewAIOutput(id: $id, action: $action, editedValue: $editedValue) {
            id status editedValue
          }
        }
      `, {
        id: args.id,
        action: args.action,
        editedValue: args.editedValue,
      });
      return result.data ?? result.errors;
    },
  },

  {
    name: "bulkReviewOutputs",
    description:
      "Accept or reject every pending AI output in a run at once. Returns how many outputs were reviewed. Bulk review does not support edited; review edited outputs one at a time with reviewOutput.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "Run ID" },
        action: {
          type: "string",
          enum: ["accepted", "rejected"],
          description: "Review decision for all pending outputs",
        },
      },
      required: ["runId", "action"],
    },
    handler: async (args, client) => {
      const result = await client.query(`
        mutation BulkReviewAIOutputs($runId: ID!, $action: AIOutputStatus!) {
          bulkReviewAIOutputs(runId: $runId, action: $action)
        }
      `, {
        runId: args.runId,
        action: args.action,
      });
      return result.data ?? result.errors;
    },
  },

  {
    name: "publishReviewedRun",
    description:
      "Publish a reviewed run: runs the workflow LIVE using the outputs a human accepted or edited in the Safety Gate. The API refuses a LIVE run when any AI output is still pending or rejected, so an unreviewed change cannot be published through this tool.",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: { type: "string", description: "Workflow ID" },
        reviewRunId: {
          type: "string",
          description: "ID of the run whose outputs were reviewed in the Safety Gate",
        },
      },
      required: ["workflowId", "reviewRunId"],
    },
    handler: async (args, client) => {
      const result = await client.query(`
        mutation PublishReviewedRun($workflowId: ID!, $reviewRunId: ID) {
          runWorkflow(workflowId: $workflowId, mode: LIVE, reviewRunId: $reviewRunId) {
            id status runMode summaryJson errorLog
          }
        }
      `, {
        workflowId: args.workflowId,
        reviewRunId: args.reviewRunId,
      });
      return result.data ?? result.errors;
    },
  },

  {
    name: "rollbackRun",
    description: "Roll back a workflow run, reversing what it published.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "Run ID" },
      },
      required: ["runId"],
    },
    handler: async (args, client) => {
      const result = await client.query(`
        mutation RollbackWorkflowRun($runId: ID!) {
          rollbackWorkflowRun(runId: $runId) {
            id status runMode summaryJson errorLog
          }
        }
      `, { runId: args.runId });
      return result.data ?? result.errors;
    },
  },
];
