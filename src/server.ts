/**
 * Standalone Streamable HTTP Server for MCP Inspector
 * This creates an actual HTTP server that MCP Inspector can connect to
 */

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import createStatelessServer from './index.js';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = parseInt(process.env.PORT || '3000');

// Enable CORS
app.use(cors());
app.use(express.json());

// Create the MCP server once (reused across requests, config via environment variables)
const server = createStatelessServer({
  config: {}
});

// Handle MCP requests
app.post('/mcp', async (req, res) => {
  try {
    // Create a new transport for each request (stateless mode)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    
    res.on('close', () => {
      transport.close();
    });
    
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null
      });
    }
  }
});

// Start HTTP server
app.listen(PORT, () => {
  console.log(`MCP Server running on http://localhost:${PORT}/mcp`);
  console.log(`Middleware URL: ${process.env.MIDDLEWARE_URL || 'http://localhost:3000'}`);
}).on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});
