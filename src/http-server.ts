/**
 * Malaysia Transit MCP Server - Streamable HTTP Transport with Firebase Analytics
 * 
 * This file provides an HTTP server for self-hosting the MCP server on a VPS.
 * It uses the Streamable HTTP transport for MCP communication.
 * Analytics are stored in Firebase for persistence across restarts.
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

import { FirebaseAnalytics, Analytics } from './firebase-analytics.js';
import fs from 'fs';
import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerTransitTools } from './transit.tools.js';

// Configuration
const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const MIDDLEWARE_URL = process.env.MIDDLEWARE_URL || 'https://malaysiatransit.techmavie.digital';
const ANALYTICS_DATA_DIR = process.env.ANALYTICS_DATA_DIR || './data';
const ANALYTICS_FILE = path.join(ANALYTICS_DATA_DIR, 'analytics.json');
const SAVE_INTERVAL_MS = 60000; // Save every 60 seconds

// Set middleware URL in environment for transit tools
process.env.MIDDLEWARE_URL = MIDDLEWARE_URL;

// ============================================================================
// Firebase Analytics Setup
// ============================================================================
const firebaseAnalytics = new FirebaseAnalytics('mcp-malaysiatransit');

// Sanitize Firebase keys - replace invalid characters
function sanitizeKey(key: string): string {
  return key.replace(/[.#$/\[\]]/g, '_');
}

function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = sanitizeKey(key);
    sanitized[sanitizedKey] = sanitizeObject(value);
  }
  return sanitized;
}

// ============================================================================
// Analytics Tracking
// ============================================================================
interface ToolCall {
  tool: string;
  timestamp: string;
  clientIp: string;
  userAgent: string;
}

// Initialize with defaults, will be overwritten by loadAnalytics()
let analytics: Analytics = {
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

// ============================================================================
// Analytics Persistence - Dual Mode (Firebase + Local Backup)
// ============================================================================
function ensureDataDir(): void {
  if (!fs.existsSync(ANALYTICS_DATA_DIR)) {
    fs.mkdirSync(ANALYTICS_DATA_DIR, { recursive: true });
    console.log(`📁 Created analytics data directory: ${ANALYTICS_DATA_DIR}`);
  }
}

async function loadAnalytics(): Promise<void> {
  try {
    // Try Firebase first
    if (firebaseAnalytics.isInitialized()) {
      const firebaseData = await firebaseAnalytics.loadAnalytics();
      if (firebaseData) {
        analytics = firebaseData;
        console.log('📊 Loaded analytics from Firebase ✅');
        console.log(`   Total requests: ${analytics.totalRequests.toLocaleString()}, Tool calls: ${analytics.totalToolCalls}`);
        return;
      }
    }

    // Fallback to local file
    ensureDataDir();
    if (fs.existsSync(ANALYTICS_FILE)) {
      const data = fs.readFileSync(ANALYTICS_FILE, 'utf-8');
      const loaded = JSON.parse(data) as Analytics;
      
      analytics = {
        ...loaded,
        serverStartTime: loaded.serverStartTime || new Date().toISOString(),
      };
      
      console.log(`📊 Loaded analytics from local file`);
      console.log(`   Total requests: ${analytics.totalRequests.toLocaleString()}, Tool calls: ${analytics.totalToolCalls}`);
    } else {
      console.log(`📊 No existing analytics found, starting fresh`);
    }
  } catch (error) {
    console.error(`⚠️ Failed to load analytics:`, error);
    console.log(`📊 Starting with fresh analytics`);
  }
}

async function saveAnalytics(): Promise<void> {
  try {
    // Save to Firebase (primary)
    if (firebaseAnalytics.isInitialized()) {
      const sanitized = sanitizeObject(analytics);
      await firebaseAnalytics.saveAnalytics(sanitized);
    }

    // Also save locally as backup
    ensureDataDir();
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(analytics, null, 2));
    
    const storage = firebaseAnalytics.isInitialized() ? 'Firebase + local backup' : 'local file only';
    console.log(`💾 Saved analytics to ${storage}`);
  } catch (error) {
    console.error(`⚠️ Failed to save analytics:`, error);
  }
}

// Load analytics on startup
(async () => {
  await loadAnalytics();
})();

// Periodic save
const saveInterval = setInterval(() => {
  saveAnalytics();
}, SAVE_INTERVAL_MS);

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
  // Note: Icon URL for clients that support it
  // https://malaysiatransit.techmavie.digital/malaysiatransitlogo/Malaysia%20Transit%20Logo%20(Transparent).png
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
            firebase: firebaseAnalytics.isInitialized() ? 'enabled' : 'disabled',
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
    firebase: firebaseAnalytics.isInitialized() ? 'connected' : 'disabled',
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
    firebase: firebaseAnalytics.isInitialized() ? 'enabled' : 'disabled',
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

// Analytics endpoint - import/restore stats from backup
app.post('/analytics/import', async (req: Request, res: Response) => {
  const importKey = req.query.key;
  if (importKey !== process.env.ANALYTICS_IMPORT_KEY && importKey !== 'malaysia-transit-2024') {
    res.status(403).json({ error: 'Invalid import key' });
    return;
  }
  
  try {
    const importData = req.body;
    
    // Merge imported data with current analytics
    if (importData.summary) {
      analytics.totalRequests += importData.summary.totalRequests || 0;
      analytics.totalToolCalls += importData.summary.totalToolCalls || 0;
    }
    
    // Merge breakdown data
    if (importData.breakdown) {
      if (importData.breakdown.byMethod) {
        for (const [method, count] of Object.entries(importData.breakdown.byMethod)) {
          analytics.requestsByMethod[method] = (analytics.requestsByMethod[method] || 0) + (count as number);
        }
      }
      if (importData.breakdown.byEndpoint) {
        for (const [endpoint, count] of Object.entries(importData.breakdown.byEndpoint)) {
          analytics.requestsByEndpoint[endpoint] = (analytics.requestsByEndpoint[endpoint] || 0) + (count as number);
        }
      }
      if (importData.breakdown.byTool) {
        for (const [tool, count] of Object.entries(importData.breakdown.byTool)) {
          analytics.toolCalls[tool] = (analytics.toolCalls[tool] || 0) + (count as number);
        }
      }
    }
    
    // Merge client data
    if (importData.clients) {
      if (importData.clients.byIp) {
        for (const [ip, count] of Object.entries(importData.clients.byIp)) {
          analytics.clientsByIp[ip] = (analytics.clientsByIp[ip] || 0) + (count as number);
        }
      }
      if (importData.clients.byUserAgent) {
        for (const [ua, count] of Object.entries(importData.clients.byUserAgent)) {
          analytics.clientsByUserAgent[ua] = (analytics.clientsByUserAgent[ua] || 0) + (count as number);
        }
      }
    }
    
    // Merge hourly requests
    if (importData.hourlyRequests) {
      for (const [hour, count] of Object.entries(importData.hourlyRequests)) {
        analytics.hourlyRequests[hour] = (analytics.hourlyRequests[hour] || 0) + (count as number);
      }
    }
    
    // Keep original server start time if importing older data
    if (importData.serverStartTime) {
      const importedStart = new Date(importData.serverStartTime).getTime();
      const currentStart = new Date(analytics.serverStartTime).getTime();
      if (importedStart < currentStart) {
        analytics.serverStartTime = importData.serverStartTime;
      }
    }
    
    // Save immediately after import
    await saveAnalytics();
    
    res.json({ 
      message: 'Analytics imported successfully',
      currentStats: {
        totalRequests: analytics.totalRequests,
        totalToolCalls: analytics.totalToolCalls,
        serverStartTime: analytics.serverStartTime,
      }
    });
  } catch (error) {
    res.status(400).json({ error: 'Failed to import analytics', details: String(error) });
  }
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

// Analytics dashboard - visual HTML page
app.get('/analytics/dashboard', (req: Request, res: Response) => {
  trackRequest(req, '/analytics/dashboard');
  
  const firebaseStatus = firebaseAnalytics.isInitialized();
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Malaysia Transit MCP - Analytics Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #e4e4e7;
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    header {
      text-align: center;
      margin-bottom: 30px;
      padding: 20px;
      background: rgba(255,255,255,0.05);
      border-radius: 16px;
      backdrop-filter: blur(10px);
    }
    header h1 {
      font-size: 2rem;
      background: linear-gradient(90deg, #60a5fa, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    header p { color: #a1a1aa; }
    .firebase-badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-top: 12px;
      ${firebaseStatus 
        ? 'background: linear-gradient(90deg, #f59e0b, #f97316); color: white;' 
        : 'background: rgba(107, 114, 128, 0.3); color: #9ca3af;'}
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      border: 1px solid rgba(255,255,255,0.1);
      transition: transform 0.2s;
    }
    .stat-card:hover { transform: translateY(-4px); }
    .stat-value {
      font-size: 2.5rem;
      font-weight: 700;
      background: linear-gradient(90deg, #34d399, #60a5fa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .stat-label { color: #a1a1aa; margin-top: 8px; font-size: 0.9rem; }
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .chart-card {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 24px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .chart-card h3 {
      margin-bottom: 16px;
      color: #e4e4e7;
      font-size: 1.1rem;
    }
    .chart-container { position: relative; height: 300px; }
    .recent-calls {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 24px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .recent-calls h3 { margin-bottom: 16px; }
    .call-list { max-height: 400px; overflow-y: auto; }
    .call-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: rgba(255,255,255,0.03);
      border-radius: 8px;
      margin-bottom: 8px;
    }
    .call-tool {
      font-weight: 600;
      color: #60a5fa;
      font-family: monospace;
    }
    .call-time { color: #71717a; font-size: 0.85rem; }
    .call-client { color: #a1a1aa; font-size: 0.8rem; }
    .refresh-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(90deg, #3b82f6, #8b5cf6);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 50px;
      cursor: pointer;
      font-weight: 600;
      box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
      transition: transform 0.2s;
    }
    .refresh-btn:hover { transform: scale(1.05); }
    .uptime-badge {
      display: inline-block;
      background: rgba(52, 211, 153, 0.2);
      color: #34d399;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85rem;
      margin-top: 8px;
    }
    @media (max-width: 768px) {
      .charts-grid { grid-template-columns: 1fr; }
      .stat-value { font-size: 2rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🚌 Malaysia Transit MCP Analytics</h1>
      <p>Real-time usage statistics for the MCP server</p>
      <span class="uptime-badge" id="uptime">Loading...</span>
      <br>
      <span class="firebase-badge">
        ${firebaseStatus ? '🔥 Firebase Connected' : '💾 Local Storage Only'}
      </span>
    </header>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value" id="totalRequests">-</div>
        <div class="stat-label">Total Requests</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="totalToolCalls">-</div>
        <div class="stat-label">Tool Calls</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="uniqueClients">-</div>
        <div class="stat-label">Unique Clients</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="topTool">-</div>
        <div class="stat-label">Most Used Tool</div>
      </div>
    </div>
    
    <div class="charts-grid">
      <div class="chart-card">
        <h3>📊 Tool Usage Distribution</h3>
        <div class="chart-container">
          <canvas id="toolsChart"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <h3>📈 Hourly Requests (Last 24h)</h3>
        <div class="chart-container">
          <canvas id="hourlyChart"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <h3>🔧 Requests by Endpoint</h3>
        <div class="chart-container">
          <canvas id="endpointChart"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <h3>🌐 Top Clients by User Agent</h3>
        <div class="chart-container">
          <canvas id="clientsChart"></canvas>
        </div>
      </div>
    </div>
    
    <div class="recent-calls">
      <h3>🕐 Recent Tool Calls</h3>
      <div class="call-list" id="recentCalls">
        <p style="color: #71717a;">Loading...</p>
      </div>
    </div>
  </div>
  
  <button class="refresh-btn" onclick="loadData()">🔄 Refresh</button>
  
  <script>
    let toolsChart, hourlyChart, endpointChart, clientsChart;
    
    const chartColors = [
      '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
      '#06b6d4', '#f43f5e', '#84cc16', '#6366f1', '#14b8a6'
    ];
    
    async function loadData() {
      try {
        const res = await fetch('./');
        const data = await res.json();
        updateDashboard(data);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      }
    }
    
    function updateDashboard(data) {
      // Update stats
      document.getElementById('totalRequests').textContent = data.summary.totalRequests.toLocaleString();
      document.getElementById('totalToolCalls').textContent = data.summary.totalToolCalls.toLocaleString();
      document.getElementById('uniqueClients').textContent = data.summary.uniqueClients.toLocaleString();
      document.getElementById('uptime').textContent = '⏱️ Uptime: ' + data.uptime;
      
      // Top tool
      const tools = Object.entries(data.breakdown.byTool);
      if (tools.length > 0) {
        const topTool = tools.sort((a, b) => b[1] - a[1])[0][0];
        document.getElementById('topTool').textContent = topTool.replace(/_/g, ' ').substring(0, 12);
      }
      
      // Tools chart
      updateToolsChart(data.breakdown.byTool);
      
      // Hourly chart
      updateHourlyChart(data.hourlyRequests);
      
      // Endpoint chart
      updateEndpointChart(data.breakdown.byEndpoint);
      
      // Clients chart
      updateClientsChart(data.clients.byUserAgent);
      
      // Recent calls
      updateRecentCalls(data.recentToolCalls);
    }
    
    function updateToolsChart(toolData) {
      const labels = Object.keys(toolData).slice(0, 10);
      const values = Object.values(toolData).slice(0, 10);
      
      if (toolsChart) toolsChart.destroy();
      toolsChart = new Chart(document.getElementById('toolsChart'), {
        type: 'doughnut',
        data: {
          labels: labels.map(l => l.replace(/_/g, ' ')),
          datasets: [{
            data: values,
            backgroundColor: chartColors,
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right', labels: { color: '#a1a1aa', font: { size: 11 } } }
          }
        }
      });
    }
    
    function updateHourlyChart(hourlyData) {
      const labels = Object.keys(hourlyData).map(h => h.split('T')[1] + ':00');
      const values = Object.values(hourlyData);
      
      if (hourlyChart) hourlyChart.destroy();
      hourlyChart = new Chart(document.getElementById('hourlyChart'), {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Requests',
            data: values,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#71717a' }, grid: { color: 'rgba(255,255,255,0.05)' } },
            y: { ticks: { color: '#71717a' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
          }
        }
      });
    }
    
    function updateEndpointChart(endpointData) {
      const labels = Object.keys(endpointData);
      const values = Object.values(endpointData);
      
      if (endpointChart) endpointChart.destroy();
      endpointChart = new Chart(document.getElementById('endpointChart'), {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: chartColors,
            borderRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#71717a' }, grid: { display: false } },
            y: { ticks: { color: '#71717a' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
          }
        }
      });
    }
    
    function updateClientsChart(clientData) {
      const entries = Object.entries(clientData).slice(0, 5);
      const labels = entries.map(([k]) => k.substring(0, 30) + (k.length > 30 ? '...' : ''));
      const values = entries.map(([, v]) => v);
      
      if (clientsChart) clientsChart.destroy();
      clientsChart = new Chart(document.getElementById('clientsChart'), {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: chartColors.slice(0, 5),
            borderRadius: 8
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#71717a' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
            y: { ticks: { color: '#71717a', font: { size: 10 } }, grid: { display: false } }
          }
        }
      });
    }
    
    function updateRecentCalls(calls) {
      const container = document.getElementById('recentCalls');
      if (!calls || calls.length === 0) {
        container.innerHTML = '<p style="color: #71717a;">No tool calls yet</p>';
        return;
      }
      
      container.innerHTML = calls.slice(0, 20).map(call => \`
        <div class="call-item">
          <div>
            <span class="call-tool">\${call.tool}</span>
            <div class="call-client">\${call.userAgent}</div>
          </div>
          <span class="call-time">\${new Date(call.timestamp).toLocaleTimeString()}</span>
        </div>
      \`).join('');
    }
    
    // Load data on page load and auto-refresh every 30 seconds
    loadData();
    setInterval(loadData, 30000);
  </script>
</body>
</html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Analytics endpoint - reset (protected by query param)
app.post('/analytics/reset', async (req: Request, res: Response) => {
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
  
  await saveAnalytics();
  
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
    icon: 'https://malaysiatransit.techmavie.digital/malaysiatransitlogo/Malaysia%20Transit%20Logo%20(Transparent).png',
    transport: 'streamable-http',
    firebase: firebaseAnalytics.isInitialized() ? 'enabled' : 'disabled',
    endpoints: {
      mcp: '/mcp',
      health: '/health',
      analytics: '/analytics',
      analyticsTools: '/analytics/tools',
      analyticsDashboard: '/analytics/dashboard',
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
      console.log(`🔥 Firebase Analytics: ${firebaseAnalytics.isInitialized() ? 'Enabled ✅' : 'Disabled ⚠️'}`);
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

// Graceful shutdown with analytics save
async function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  clearInterval(saveInterval);
  await saveAnalytics();
  console.log('Analytics saved. Goodbye!');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));