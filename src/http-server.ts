/**
 * Malaysia Transit MCP Server - Streamable HTTP Transport
 * 
 * This file provides an HTTP server for self-hosting the MCP server on a VPS.
 * It uses the Streamable HTTP transport for MCP communication.
 * 
 * Usage:
 *   npm run build
 *   node dist/http-server.js
 * 
 * Or with environment variables:
 *   PORT=8080 MIDDLEWARE_URL=https://malaysiatransit.techmavie.digital node dist/http-server.js
 */

import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerTransitTools } from './transit.tools.js';

// Configuration
const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const MIDDLEWARE_URL = process.env.MIDDLEWARE_URL || 'https://malaysiatransit.techmavie.digital';

// Set middleware URL in environment for transit tools
process.env.MIDDLEWARE_URL = MIDDLEWARE_URL;

// Create MCP server
const mcpServer = new McpServer({
  name: 'Malaysia Transit MCP Server',
  version: '2.1.0',
});

// Register all transit tools
registerTransitTools(mcpServer);

// Register hello tool for testing
mcpServer.tool(
  'hello',
  'A simple test tool to verify that the MCP server is working correctly',
  {},
  async () => {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            message: 'Hello from Malaysia Transit MCP!',
            timestamp: new Date().toISOString(),
            middlewareUrl: MIDDLEWARE_URL,
            transport: 'streamable-http',
          }, null, 2),
        },
      ],
    };
  }
);

// Create Express app
const app = express();

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for MCP clients
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'Mcp-Session-Id'],
  exposedHeaders: ['Mcp-Session-Id'],
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    server: 'Malaysia Transit MCP',
    version: '2.1.0',
    transport: 'streamable-http',
    middlewareUrl: MIDDLEWARE_URL,
    timestamp: new Date().toISOString(),
  });
});

// Create Streamable HTTP transport (stateless)
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined, // Stateless transport
});

// MCP endpoint - handles POST (requests), GET (SSE), DELETE (session close)
app.all('/mcp', async (req: Request, res: Response) => {
  try {
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP request error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        jsonrpc: '2.0',
        error: { 
          code: -32603, 
          message: 'Internal server error' 
        },
        id: null,
      });
    }
  }
});

// Root endpoint with server info
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Malaysia Transit MCP Server',
    version: '2.1.0',
    description: 'MCP server for Malaysia public transit information',
    transport: 'streamable-http',
    endpoints: {
      mcp: '/mcp',
      health: '/health',
    },
    documentation: 'https://github.com/hithereiamaliff/mcp-malaysiatransit',
  });
});

// Connect server to transport and start listening
mcpServer.connect(transport)
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log('='.repeat(60));
      console.log('🚀 Malaysia Transit MCP Server (Streamable HTTP)');
      console.log('='.repeat(60));
      console.log(`📍 Server running on http://${HOST}:${PORT}`);
      console.log(`📡 MCP endpoint: http://${HOST}:${PORT}/mcp`);
      console.log(`❤️  Health check: http://${HOST}:${PORT}/health`);
      console.log(`🔗 Middleware URL: ${MIDDLEWARE_URL}`);
      console.log('='.repeat(60));
      console.log('');
      console.log('Test with MCP Inspector:');
      console.log(`  npx @modelcontextprotocol/inspector`);
      console.log(`  Select "Streamable HTTP" and enter: http://localhost:${PORT}/mcp`);
      console.log('');
    });
  })
  .catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});
