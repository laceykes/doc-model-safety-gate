export interface GraphQLIdentity {
  userId?: string;
  projectId?: string;
  role?: string;
}

export interface GraphQLClientConfig {
  endpoint: string;
  token: string;
  identity?: GraphQLIdentity;
}

export class GraphQLClient {
  private endpoint: string;
  private token: string;
  private identity?: GraphQLIdentity;

  constructor(config: GraphQLClientConfig) {
    this.endpoint = config.endpoint;
    this.token = config.token;
    this.identity = config.identity;
  }

  async query<T = Record<string, unknown>>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<{ data?: T; errors?: Array<{ message: string }> }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };
    // The operations API builds its actor from identity headers (a Bearer
    // token alone is ignored). Send them whenever an identity is configured.
    if (this.identity?.userId) headers["x-user-id"] = this.identity.userId;
    if (this.identity?.projectId) headers["x-project-id"] = this.identity.projectId;
    if (this.identity?.role) headers["x-user-role"] = this.identity.role;

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<{ data?: T; errors?: Array<{ message: string }> }>;
  }
}
