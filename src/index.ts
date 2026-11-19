#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { GraphQLClient } from "./graphql-client.js";
import { tools } from "./tools.js";

const API_ENDPOINT = process.env.DOCMODEL_API_ENDPOINT ?? process.env.STRATA_API_ENDPOINT ?? "http://localhost:4000/graphql";
const API_TOKEN = process.env.DOCMODEL_API_TOKEN ?? process.env.STRATA_API_TOKEN ?? "";
const API_IDENTITY = {
  userId: process.env.DOCMODEL_USER_ID ?? process.env.STRATA_USER_ID,
  projectId: process.env.DOCMODEL_PROJECT_ID ?? process.env.STRATA_PROJECT_ID,
  role: process.env.DOCMODEL_USER_ROLE ?? process.env.STRATA_USER_ROLE,
};
const HAS_IDENTITY = Boolean(API_IDENTITY.userId ?? API_IDENTITY.projectId ?? API_IDENTITY.role);

export function createServer(endpoint?: string, token?: string): Server {
  const client = new GraphQLClient({
    endpoint: endpoint ?? API_ENDPOINT,
    token: token ?? API_TOKEN,
    identity: HAS_IDENTITY ? API_IDENTITY : undefined,
  });

  const server = new Server(
    { name: "doc-model-safety-gate", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.name === request.params.name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      };
    }

    try {
      const result = await tool.handler(
        (request.params.arguments ?? {}) as Record<string, unknown>,
        client
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  });

  return server;
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
