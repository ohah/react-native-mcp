export class McpToolError extends Error {
  constructor(
    public readonly toolName: string,
    message: string
  ) {
    super(`${toolName}: ${message}`);
    this.name = 'McpToolError';
  }
}

export class ConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectionError';
  }
}
