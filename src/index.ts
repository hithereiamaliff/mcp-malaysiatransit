/**
 * Malaysia Transit MCP Server
 * Provides tools to access real-time bus and train information across Malaysia
 * 
 * Data source: Malaysia Transit Middleware API
 */
import dotenv from 'dotenv';

// Initialize dotenv to load environment variables from .env file
dotenv.config();

/**
 * =====================================================================
 * IMPORTANT GUIDANCE FOR AI MODELS USING THIS MCP SERVER:
 * =====================================================================
 * 1. ALWAYS use 'list_service_areas' first to discover available transit areas
 * 
 * 2. Use 'detect_location_area' to auto-detect area from location names
 * 
 * 3. Use 'search_stops' to find bus/train stops by name
 * 
 * 4. Use 'get_stop_arrivals' to get real-time arrival information
 * 
 * 5. Use 'get_live_vehicles' to see real-time bus/train positions
 * 
 * 6. Use 'list_routes' to discover available routes in an area
 * 
 * 7. Use 'get_route_departures' for schedule information (BAS.MY areas only)
 * 
 * 8. Use 'calculate_fare' to calculate bus fares (BAS.MY & Penang)
 * 
 * 9. Use 'get_api_analytics' to view API usage statistics
 * 
 * 10. NEW KTM TOOLS:
 *     - 'get_ktm_komuter_stations' - Get all 23 KTM Komuter Utara stations
 *     - 'calculate_ktm_komuter_fare' - Calculate KTM Komuter fare between stations
 *     - 'get_ktm_station_departures' - Get departures for a KTM station
 *     - 'get_ktm_schedules' - Get full KTM schedule data
 *     - 'find_nearby_ktm_stations' - Find KTM stations near a location
 * 
 * 11. FERRY TOOLS:
 *     - 'get_penang_ferry_overview' - Penang Ferry service overview
 *     - 'get_penang_ferry_schedule' - Full ferry schedule
 *     - 'get_penang_ferry_next_departure' - Next departures
 *     - 'get_penang_ferry_terminals' - Terminal information
 *     - 'get_penang_ferry_fare' - Fare information
 * 
 * 12. All tools require an 'area' parameter (e.g., 'penang', 'klang-valley', 'ipoh')
 *     Exception: KTM and Ferry tools don't require area parameter
 * 
 * NOTE: This MCP identifies itself as 'Malaysia-Transit-MCP' to the middleware
 * for analytics tracking via the X-App-Name header.
 * =====================================================================
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Import transit tools
import { registerTransitTools } from './transit.tools.js';

// Define the config schema (empty - all config via environment variables)
export const configSchema = z.object({});

/**
 * Creates a stateless MCP server for Malaysia Transit API
 */
export default function createStatelessServer({
  config: _config,
}: {
  config: z.infer<typeof configSchema>;
}) {
  const server = new McpServer({
    name: 'Malaysia Transit MCP Server',
    version: '2.1.0',
  });

  // All configuration via environment variables
  const middlewareUrl = process.env.MIDDLEWARE_URL || 'https://malaysiatransit.techmavie.digital';
  process.env.MIDDLEWARE_URL = middlewareUrl;
  console.log(`Using middleware URL: ${middlewareUrl}`);
  
  // Set Google Maps API key from environment
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (apiKey) {
    console.log(`Google Maps API key configured for geocoding`);
  } else {
    console.log(`No Google Maps API key provided, will use Nominatim for geocoding`);
  }
  
  // Register transit tools
  registerTransitTools(server);

  // Register a simple hello tool for testing
  server.tool(
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
              middlewareUrl: process.env.MIDDLEWARE_URL || 'https://malaysiatransit.techmavie.digital',
            }, null, 2),
          },
        ],
      };
    }
  );

  return server.server;
}

