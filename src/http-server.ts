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

import express, { Request, Response, NextFunction } from 'express';
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

// ============================================================================
// Analytics Tracking
// ============================================================================
interface ToolCall {
  tool: string;
  timestamp: string;
  clientIp: string;
  userAgent: string;
}

interface Analytics {
  serverStartTime: string;
  totalRequests: number;
  totalToolCalls: number;
  requestsByMethod: Record<string, number>;
  requestsByEndpoint: Record<string, number>;
  toolCalls: Record<string, number>;
  recentToolCalls: ToolCall[];
  clientsByIp: Record<string, number>;
  clientsByUserAgent: Record<string, number>;
  hourlyRequests: Record<string, number>;
}

const analytics: Analytics = {
  serverStartTime: new Date().toISOString(),
  totalRequests: 0,
  totalToolCalls: 0,
  requestsByMethod: {},
  requestsByEndpoint: {},
  toolCalls: {},
  recentToolCalls: [],
  clientsByIp: {},
  clientsByUserAgent: {},
  hourlyRequests: {},
};

const MAX_RECENT_CALLS = 100;

function trackRequest(req: Request, endpoint: string) {
  analytics.totalRequests++;
  
  // Track by method
  const method = req.method;
  analytics.requestsByMethod[method] = (analytics.requestsByMethod[method] || 0) + 1;
  
  // Track by endpoint
  analytics.requestsByEndpoint[endpoint] = (analytics.requestsByEndpoint[endpoint] || 0) + 1;
  
  // Track by client IP
  const clientIp = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
  analytics.clientsByIp[clientIp] = (analytics.clientsByIp[clientIp] || 0) + 1;
  
  // Track by user agent
  const userAgent = req.headers['user-agent'] || 'unknown';
  const shortAgent = userAgent.substring(0, 50);
  analytics.clientsByUserAgent[shortAgent] = (analytics.clientsByUserAgent[shortAgent] || 0) + 1;
  
  // Track hourly
  const hour = new Date().toISOString().substring(0, 13); // YYYY-MM-DDTHH
  analytics.hourlyRequests[hour] = (analytics.hourlyRequests[hour] || 0) + 1;
}

function trackToolCall(toolName: string, req: Request) {
  analytics.totalToolCalls++;
  analytics.toolCalls[toolName] = (analytics.toolCalls[toolName] || 0) + 1;
  
  const toolCall: ToolCall = {
    tool: toolName,
    timestamp: new Date().toISOString(),
    clientIp: req.ip || req.headers['x-forwarded-for'] as string || 'unknown',
    userAgent: (req.headers['user-agent'] || 'unknown').substring(0, 50),
  };
  
  analytics.recentToolCalls.unshift(toolCall);
  if (analytics.recentToolCalls.length > MAX_RECENT_CALLS) {
    analytics.recentToolCalls.pop();
  }
}

function getUptime(): string {
  const start = new Date(analytics.serverStartTime).getTime();
  const now = Date.now();
  const diff = now - start;
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

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
app.get('/health', (req: Request, res: Response) => {
  trackRequest(req, '/health');
  res.json({
    status: 'healthy',
    server: 'Malaysia Transit MCP',
    version: '2.1.0',
    transport: 'streamable-http',
    middlewareUrl: MIDDLEWARE_URL,
    timestamp: new Date().toISOString(),
  });
});

// Analytics endpoint - summary
app.get('/analytics', (req: Request, res: Response) => {
  trackRequest(req, '/analytics');
  
  // Sort tool calls by count
  const sortedTools = Object.entries(analytics.toolCalls)
    .sort(([, a], [, b]) => b - a)
    .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
  
  // Sort clients by count
  const sortedClients = Object.entries(analytics.clientsByIp)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
  
  // Get last 24 hours of hourly data
  const last24Hours = Object.entries(analytics.hourlyRequests)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 24)
    .reverse()
    .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
  
  res.json({
    server: 'Malaysia Transit MCP',
    uptime: getUptime(),
    serverStartTime: analytics.serverStartTime,
    summary: {
      totalRequests: analytics.totalRequests,
      totalToolCalls: analytics.totalToolCalls,
      uniqueClients: Object.keys(analytics.clientsByIp).length,
    },
    breakdown: {
      byMethod: analytics.requestsByMethod,
      byEndpoint: analytics.requestsByEndpoint,
      byTool: sortedTools,
    },
    clients: {
      byIp: sortedClients,
      byUserAgent: analytics.clientsByUserAgent,
    },
    hourlyRequests: last24Hours,
    recentToolCalls: analytics.recentToolCalls.slice(0, 20),
  });
});

// Analytics endpoint - detailed tool stats
app.get('/analytics/tools', (req: Request, res: Response) => {
  trackRequest(req, '/analytics/tools');
  
  const sortedTools = Object.entries(analytics.toolCalls)
    .sort(([, a], [, b]) => b - a)
    .map(([tool, count]) => ({
      tool,
      count,
      percentage: analytics.totalToolCalls > 0 
        ? ((count / analytics.totalToolCalls) * 100).toFixed(1) + '%'
        : '0%',
    }));
  
  res.json({
    totalToolCalls: analytics.totalToolCalls,
    tools: sortedTools,
    recentCalls: analytics.recentToolCalls,
  });
});

// Analytics endpoint - reset (protected by query param)
app.post('/analytics/reset', (req: Request, res: Response) => {
  const resetKey = req.query.key;
  if (resetKey !== process.env.ANALYTICS_RESET_KEY && resetKey !== 'malaysia-transit-2024') {
    res.status(403).json({ error: 'Invalid reset key' });
    return;
  }
  
  analytics.totalRequests = 0;
  analytics.totalToolCalls = 0;
  analytics.requestsByMethod = {};
  analytics.requestsByEndpoint = {};
  analytics.toolCalls = {};
  analytics.recentToolCalls = [];
  analytics.clientsByIp = {};
  analytics.clientsByUserAgent = {};
  analytics.hourlyRequests = {};
  analytics.serverStartTime = new Date().toISOString();
  
  res.json({ message: 'Analytics reset successfully', timestamp: analytics.serverStartTime });
});

// Create Streamable HTTP transport (stateless)
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined, // Stateless transport
});

// MCP endpoint - handles POST (requests), GET (SSE), DELETE (session close)
app.all('/mcp', async (req: Request, res: Response) => {
  trackRequest(req, '/mcp');
  
  // Track tool calls from request body
  if (req.method === 'POST' && req.body) {
    const body = req.body;
    if (body.method === 'tools/call' && body.params?.name) {
      trackToolCall(body.params.name, req);
    }
  }
  
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
app.get('/', (req: Request, res: Response) => {
  trackRequest(req, '/');
  res.json({
    name: 'Malaysia Transit MCP Server',
    version: '2.1.0',
    description: 'MCP server for Malaysia public transit information',
    transport: 'streamable-http',
    endpoints: {
      mcp: '/mcp',
      health: '/health',
      analytics: '/analytics',
      analyticsTools: '/analytics/tools',
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
