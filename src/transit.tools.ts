/**
 * Malaysia Transit Tools
 * Tools for accessing real-time bus and train information
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import axios, { AxiosRequestConfig } from 'axios';
import { detectAreaFromLocation, getAreaStateMapping } from './geocoding.utils.js';

// MCP Client Identification Header
// This identifies requests from Malaysia Transit MCP to the middleware analytics
const MCP_CLIENT_HEADERS = {
  'X-App-Name': 'Malaysia-Transit-MCP',
};

// Get middleware URL from environment
const getMiddlewareUrl = (): string => {
  return process.env.MIDDLEWARE_URL || 'http://localhost:3000';
};

// Create axios instance with MCP client identification
const createApiConfig = (params?: Record<string, any>): AxiosRequestConfig => {
  return {
    headers: MCP_CLIENT_HEADERS,
    params,
  };
};

/**
 * Register all transit-related tools
 */
export function registerTransitTools(server: McpServer): void {
  
  // ============================================================================
  // SERVICE AREA TOOLS
  // ============================================================================
  
  server.tool(
    'list_service_areas',
    'List all available transit service areas in Malaysia (e.g., Klang Valley, Penang, Kuantan)',
    {},
    async () => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/areas`, createApiConfig());
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Failed to fetch service areas',
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'detect_location_area',
    'Automatically detect which transit service area a location belongs to using geocoding. Use this when the user mentions a place name without specifying the area (e.g., "KTM Alor Setar", "Komtar", "KLCC")',
    {
      location: z.coerce.string().describe('Location name or place (e.g., "KTM Alor Setar", "Komtar", "Pavilion KL")'),
    },
    async ({ location }) => {
      try {
        const result = await detectAreaFromLocation(location);
        
        if (result) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  area: result.area,
                  confidence: result.confidence,
                  location: result.location,
                  source: result.source,
                  message: `Location "${location}" detected in service area: ${result.area}`,
                }, null, 2),
              },
            ],
          };
        } else {
          // Return available areas if detection fails
          const areaMapping = getAreaStateMapping();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  message: `Could not automatically detect service area for "${location}". Please specify the area manually.`,
                  availableAreas: areaMapping,
                }, null, 2),
              },
            ],
          };
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Failed to detect location area',
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'get_area_info',
    'Get detailed information about a specific transit service area',
    {
      areaId: z.coerce.string().describe('Service area ID (e.g., "penang", "klang-valley", "kuantan")'),
    },
    async ({ areaId }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/areas/${areaId}`, createApiConfig());
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Failed to fetch area info for ${areaId}`,
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ============================================================================
  // STOP TOOLS
  // ============================================================================

  server.tool(
    'search_stops',
    'Search for bus or train stops by name in a specific area. IMPORTANT: If you are unsure which area a location belongs to, use detect_location_area first to automatically determine the correct area.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "penang", "klang-valley"). Use detect_location_area if unsure.'),
      query: z.coerce.string().describe('Search query (e.g., "Komtar", "KLCC")'),
    },
    async ({ area, query }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/stops/search`, createApiConfig({ area, q: query }));
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Failed to search stops in ${area}`,
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'get_stop_details',
    'Get detailed information about a specific bus or train stop',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "penang", "klang-valley")'),
      stopId: z.coerce.string().describe('Stop ID from search results'),
    },
    async ({ area, stopId }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/stops/${stopId}`, createApiConfig({ area }));
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Failed to fetch stop details for ${stopId}`,
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'get_stop_arrivals',
    'Get real-time arrival predictions for buses/trains at a specific stop',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "penang", "klang-valley")'),
      stopId: z.coerce.string().describe('Stop ID from search results'),
    },
    async ({ area, stopId }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/stops/${stopId}/arrivals`, createApiConfig({ area }));
        
        // Prepare disclaimer message
        const disclaimer = `
📊 ABOUT THESE ARRIVAL PREDICTIONS:

Our middleware calculates bus arrival times using custom-made algorithms:

1. Shape-Based Distance (Preferred):
   • Uses actual route geometry from GTFS data
   • Follows the real road path with curves and turns
   • Accuracy: ±2-4 minutes compared to Google Maps/Moovit
   • Indicated by: "calculationMethod": "shape-based", "confidence": "high" or "medium"

2. Straight-Line Distance (Fallback):
   • Used when shape data unavailable or vehicle position uncertain
   • Applies 1.4x multiplier to account for road curves
   • More conservative (may show longer ETAs)
   • Indicated by: "calculationMethod": "straight-line", "confidence": "low"

Key Features:
✅ GPS Speed Validation: Rejects unrealistic speeds (>40 km/h for city buses)
✅ Time-of-Day Adjustments: Rush hour predictions are 40-45% longer
✅ Stop Dwell Time: Adds ~30 seconds per intermediate stop
✅ Ghost Bus Filtering: Removes vehicles that have passed the stop

Confidence Levels:
• High: Shape-based, vehicle within 50m of route
• Medium: Shape-based, vehicle 50-200m from route
• Low: Straight-line fallback (no shape data available)

Important Notes:
⚠️ Predictions are conservative - buses may arrive earlier than estimated
⚠️ Real-time traffic conditions (accidents, roadworks) are not factored in
⚠️ Operator-provided predictions (TripUpdates) are not yet available from Malaysia's GTFS API (planned for 2026)

Accuracy Comparison:
• Our predictions: Within 2-4 minutes of Google Maps/Moovit
• Conservative bias: Better to arrive early than miss the bus!

---

ARRIVAL DATA:
`;
        
        return {
          content: [
            {
              type: 'text',
              text: disclaimer + JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Failed to fetch arrivals for stop ${stopId}`,
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'find_nearby_stops',
    'Find bus or train stops near a specific location',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "penang", "klang-valley")'),
      lat: z.coerce.number().describe('Latitude coordinate'),
      lon: z.coerce.number().describe('Longitude coordinate'),
      radius: z.coerce.number().optional().default(500).describe('Search radius in meters (default: 500)'),
    },
    async ({ area, lat, lon, radius }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/stops/nearby`, createApiConfig({ area, lat, lon, radius }));
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Failed to find nearby stops`,
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ============================================================================
  // ROUTE TOOLS
  // ============================================================================

  server.tool(
    'list_routes',
    'List all available bus or train routes in a specific area',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "penang", "klang-valley")'),
    },
    async ({ area }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/routes`, createApiConfig({ area }));
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Failed to fetch routes for ${area}`,
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'get_route_details',
    'Get detailed information about a specific route including stops and geometry',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "penang", "klang-valley")'),
      routeId: z.coerce.string().describe('Route ID from list_routes'),
    },
    async ({ area, routeId }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/routes/${routeId}`, createApiConfig({ area }));
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Failed to fetch route details for ${routeId}`,
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'get_route_geometry',
    'Get the geographic path and stops for a specific route (for map visualization)',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "penang", "klang-valley")'),
      routeId: z.coerce.string().describe('Route ID from list_routes'),
    },
    async ({ area, routeId }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/routes/${routeId}/geometry`, createApiConfig({ area }));
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Failed to fetch route geometry for ${routeId}`,
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ============================================================================
  // REAL-TIME DATA TOOLS
  // ============================================================================

  server.tool(
    'get_live_vehicles',
    'Get real-time positions of all buses and trains in a specific area',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "penang", "klang-valley")'),
      type: z.enum(['bus', 'rail']).optional().describe('Filter by transit type (optional)'),
    },
    async ({ area, type }) => {
      try {
        const params: any = { area };
        if (type) {
          params.type = type;
        }
        
        const response = await axios.get(`${getMiddlewareUrl()}/api/realtime`, createApiConfig(params));
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Failed to fetch live vehicles for ${area}`,
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'get_provider_status',
    'Check the operational status of transit providers in a specific area',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "penang", "klang-valley")'),
    },
    async ({ area }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/areas/${area}/providers/status`, createApiConfig());
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Failed to fetch provider status for ${area}`,
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ============================================================================
  // SCHEDULE TOOLS (NEW)
  // ============================================================================

  // BAS.MY areas that support schedule data
  const SCHEDULE_SUPPORTED_AREAS = ['ipoh', 'seremban', 'kangar', 'alor-setar', 'kota-bharu', 'kuala-terengganu', 'melaka', 'johor', 'kuching'];
  
  // Helper function to check if area supports schedules
  const isScheduleSupported = (area: string): boolean => {
    return SCHEDULE_SUPPORTED_AREAS.includes(area.toLowerCase());
  };
  
  // Helper function to return Penang schedule coming soon message
  const getPenangScheduleMessage = () => ({
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          error: 'Rapid Penang schedules are COMING SOON',
          message: 'Schedule data is not yet available for Penang (Rapid Penang). This feature is currently under development.',
          supportedAreas: SCHEDULE_SUPPORTED_AREAS,
          alternatives: [
            'Use get_live_vehicles to see real-time bus positions in Penang',
            'Use get_stop_arrivals to see estimated arrival times based on live GPS data',
            'Use get_fare_routes and calculate_fare for Penang fare calculations (available now)'
          ]
        }, null, 2),
      },
    ],
    isError: true,
  });

  server.tool(
    'get_route_departures',
    'Get the next N departures for a specific route (both directions). Useful for showing upcoming bus/train times. IMPORTANT: Use route_short_name (e.g., "K10", "A32", "R10") NOT the numeric route_id. Only works for BAS.MY areas: ipoh, seremban, kangar, alor-setar, kota-bharu, kuala-terengganu, melaka, johor, kuching. NOTE: Penang (Rapid Penang) schedules are COMING SOON - this tool does NOT work for Penang yet.',
    {
      area: z.coerce.string().describe('Service area ID - must be a BAS.MY area (e.g., "ipoh", "seremban", "alor-setar", "kangar")'),
      routeId: z.coerce.string().describe('Route SHORT NAME (e.g., "K10", "A32", "R10", "J100") - NOT the numeric route_id. Get this from list_routes route_short_name field.'),
      count: z.coerce.number().optional().default(5).describe('Number of departures to return (default: 5)'),
    },
    async ({ area, routeId, count }) => {
      // Check if Penang - return coming soon message
      if (area.toLowerCase() === 'penang') {
        return getPenangScheduleMessage();
      }
      
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/schedules/routes/${routeId}/departures`, createApiConfig({ area, count }));
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Failed to fetch departures for route ${routeId}`,
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'get_next_departure',
    'Get the single next departure for a route in a specific direction. Quick way to find when the next bus/train leaves. IMPORTANT: Use route_short_name (e.g., "K10", "A32") NOT numeric route_id. Only works for BAS.MY areas: ipoh, seremban, kangar, alor-setar, kota-bharu, kuala-terengganu, melaka, johor, kuching. NOTE: Penang (Rapid Penang) schedules are COMING SOON.',
    {
      area: z.coerce.string().describe('Service area ID - must be a BAS.MY area (e.g., "ipoh", "seremban", "alor-setar")'),
      routeId: z.coerce.string().describe('Route SHORT NAME (e.g., "K10", "A32", "R10") - NOT numeric route_id'),
      direction: z.enum(['outbound', 'inbound', 'loop']).optional().describe('Direction of travel (optional)'),
    },
    async ({ area, routeId, direction }) => {
      // Check if Penang - return coming soon message
      if (area.toLowerCase() === 'penang') {
        return getPenangScheduleMessage();
      }
      
      try {
        const params: any = { area };
        if (direction) {
          params.direction = direction;
        }
        
        const response = await axios.get(`${getMiddlewareUrl()}/api/schedules/routes/${routeId}/next`, createApiConfig(params));
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Failed to fetch next departure for route ${routeId}`,
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'get_stop_routes',
    'Get all routes serving a specific stop with their next departures. Shows which buses/trains stop here and when. Only works for BAS.MY areas: ipoh, seremban, kangar, alor-setar, kota-bharu, kuala-terengganu, melaka, johor, kuching. NOTE: Penang (Rapid Penang) schedules are COMING SOON - this tool does NOT work for Penang yet.',
    {
      area: z.coerce.string().describe('Service area ID - must be a BAS.MY area (e.g., "ipoh", "seremban", "alor-setar")'),
      stopId: z.coerce.string().describe('Stop ID from search_stops'),
      count: z.coerce.number().optional().default(3).describe('Number of departures per route (default: 3)'),
    },
    async ({ area, stopId, count }) => {
      // Check if Penang - return coming soon message
      if (area.toLowerCase() === 'penang') {
        return getPenangScheduleMessage();
      }
      
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/schedules/stops/${stopId}/routes`, createApiConfig({ area, count }));
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Failed to fetch routes for stop ${stopId}`,
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'get_route_schedule',
    'Get the complete daily schedule for a route. Shows all departure times throughout the day. IMPORTANT: Use route_short_name (e.g., "K10", "A32") NOT numeric route_id. Only works for BAS.MY areas: ipoh, seremban, kangar, alor-setar, kota-bharu, kuala-terengganu, melaka, johor, kuching. NOTE: Penang (Rapid Penang) schedules are COMING SOON.',
    {
      area: z.coerce.string().describe('Service area ID - must be a BAS.MY area (e.g., "ipoh", "seremban", "alor-setar")'),
      routeId: z.coerce.string().describe('Route SHORT NAME (e.g., "K10", "A32", "R10") - NOT numeric route_id'),
    },
    async ({ area, routeId }) => {
      // Check if Penang - return coming soon message
      if (area.toLowerCase() === 'penang') {
        return getPenangScheduleMessage();
      }
      
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/schedules/routes/${routeId}/full`, createApiConfig({ area }));
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Failed to fetch schedule for route ${routeId}`,
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'get_route_origin',
    'Get the origin stop name for a route in a specific direction. Useful for showing where the bus/train starts. IMPORTANT: Use route_short_name (e.g., "K10", "A32") NOT numeric route_id. Only works for BAS.MY areas. NOTE: Penang (Rapid Penang) schedules are COMING SOON.',
    {
      area: z.coerce.string().describe('Service area ID - must be a BAS.MY area (e.g., "ipoh", "seremban", "alor-setar")'),
      routeId: z.coerce.string().describe('Route SHORT NAME (e.g., "K10", "A32", "R10") - NOT numeric route_id'),
      direction: z.enum(['outbound', 'inbound']).optional().describe('Direction of travel (optional)'),
    },
    async ({ area, routeId, direction }) => {
      // Check if Penang - return coming soon message
      if (area.toLowerCase() === 'penang') {
        return getPenangScheduleMessage();
      }
      
      try {
        const params: any = { area };
        if (direction) {
          params.direction = direction;
        }
        
        const response = await axios.get(`${getMiddlewareUrl()}/api/schedules/routes/${routeId}/origin`, createApiConfig(params));
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Failed to fetch origin for route ${routeId}`,
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'get_route_status',
    'Check if a route is currently operating based on its schedule. Shows if buses/trains are running now. IMPORTANT: Use route_short_name (e.g., "K10", "A32") NOT numeric route_id. Only works for BAS.MY areas: ipoh, seremban, kangar, alor-setar, kota-bharu, kuala-terengganu, melaka, johor, kuching. NOTE: Penang (Rapid Penang) schedules are COMING SOON.',
    {
      area: z.coerce.string().describe('Service area ID - must be a BAS.MY area (e.g., "ipoh", "seremban", "alor-setar")'),
      routeId: z.coerce.string().describe('Route SHORT NAME (e.g., "K10", "A32", "R10") - NOT numeric route_id'),
    },
    async ({ area, routeId }) => {
      // Check if Penang - return coming soon message
      if (area.toLowerCase() === 'penang') {
        return getPenangScheduleMessage();
      }
      
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/schedules/routes/${routeId}/status`, createApiConfig({ area }));
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Failed to fetch status for route ${routeId}`,
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ============================================================================
  // FARE CALCULATOR TOOLS (NEW)
  // ============================================================================

  server.tool(
    'get_fare_routes',
    'Get all routes available for fare calculation in a specific area. MUST call this FIRST before calculate_fare to get valid route_id values. Supports: ipoh, seremban, kangar, alor-setar, kota-bharu, kuala-terengganu, melaka, johor, kuching, penang.',
    {
      area: z.coerce.string().describe('Service area ID - must be: ipoh, seremban, kangar, alor-setar, kota-bharu, kuala-terengganu, melaka, johor, kuching, or penang'),
    },
    async ({ area }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/fare/${area}/routes`, createApiConfig());
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Failed to fetch fare routes for ${area}`,
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'get_route_stops_for_fare',
    'Get all stops on a route with their distances for fare calculation. MUST call this SECOND (after get_fare_routes) to get valid stop_id values for calculate_fare. Returns stop IDs and names.',
    {
      area: z.coerce.string().describe('Service area ID - same as used in get_fare_routes'),
      routeId: z.coerce.string().describe('The route_id value from get_fare_routes response (e.g., "D62", "A32", "M15CWLMYMK")'),
    },
    async ({ area, routeId }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/fare/${area}/route/${routeId}/stops`, createApiConfig());
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Failed to fetch stops for route ${routeId}`,
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'calculate_fare',
    'Calculate the bus fare between two stops on a route. IMPORTANT: You MUST first call get_fare_routes to get route_id, then get_route_stops_for_fare to get valid stop_id values. Do NOT guess IDs.',
    {
      area: z.coerce.string().describe('Service area ID - same as used in previous calls'),
      routeId: z.coerce.string().describe('The exact route_id from get_fare_routes (NOT route_short_name)'),
      fromStop: z.coerce.string().describe('The exact stop_id from get_route_stops_for_fare response'),
      toStop: z.coerce.string().describe('The exact stop_id from get_route_stops_for_fare response'),
    },
    async ({ area, routeId, fromStop, toStop }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/fare/${area}/calculate`, createApiConfig({ routeId, fromStop, toStop }));
        
        // Add disclaimer about fare estimates
        const disclaimer = `
💰 FARE CALCULATION DISCLAIMER:
This fare is an ESTIMATE based on distance traveled along the route.
• BAS.MY uses distance-based fares (RM 0.05/km, min RM 0.40)
• Rapid Penang uses staged fare structure
• Actual fare may vary - please confirm with the bus driver

---

FARE DETAILS:
`;
        
        return {
          content: [
            {
              type: 'text',
              text: disclaimer + JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Failed to calculate fare`,
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'calculate_journey_fare',
    'Calculate the total fare for a multi-leg journey with bus transfers. Each leg is a separate fare since BAS.MY does not have integrated transfers.',
    {
      area: z.coerce.string().describe('Base service area ID (legs can specify different areas for inter-area journeys)'),
      legs: z.array(z.object({
        routeId: z.coerce.string().describe('Route ID for this leg'),
        fromStop: z.coerce.string().describe('Origin stop ID'),
        toStop: z.coerce.string().describe('Destination stop ID'),
        areaId: z.coerce.string().optional().describe('Area ID for this leg (optional, defaults to base area)'),
      })).describe('Array of journey legs (max 5)'),
    },
    async ({ area, legs }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/fare/${area}/calculate-journey`, createApiConfig({ legs: JSON.stringify(legs) }));
        
        // Add disclaimer about fare estimates
        const disclaimer = `
💰 MULTI-LEG JOURNEY FARE DISCLAIMER:
This fare is an ESTIMATE based on distance traveled.
• Each bus change requires a separate fare payment
• BAS.MY does not have integrated transfer discounts
• Actual fare may vary - please confirm with each bus driver

---

JOURNEY FARE DETAILS:
`;
        
        return {
          content: [
            {
              type: 'text',
              text: disclaimer + JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Failed to calculate journey fare`,
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ============================================================================
  // SYSTEM TOOLS
  // ============================================================================

  server.tool(
    'get_system_health',
    'Check the health status of the Malaysia Transit middleware service',
    {},
    async () => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/health`, createApiConfig());
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Failed to check system health',
                message: error.message,
                middlewareUrl: getMiddlewareUrl(),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'get_debug_info',
    'Get comprehensive debug information about the middleware service including memory usage and initialized areas',
    {},
    async () => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/debug`, createApiConfig());
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Failed to fetch debug info',
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ============================================================================
  // ANALYTICS TOOLS (NEW)
  // ============================================================================

  server.tool(
    'get_api_analytics',
    'Get API usage analytics and statistics from the middleware. Shows total requests, requests per hour, error rates, and usage by service area. Useful for monitoring API health and usage patterns.',
    {
      type: z.enum(['summary', 'endpoints', 'areas', 'cumulative', 'clients']).optional().default('summary').describe('Type of analytics: summary (overview), endpoints (per-endpoint stats), areas (per-area stats), cumulative (all-time totals), clients (app/website usage)'),
    },
    async ({ type }) => {
      try {
        let endpoint = '/api/analytics/summary';
        switch (type) {
          case 'endpoints':
            endpoint = '/api/analytics/endpoints';
            break;
          case 'areas':
            endpoint = '/api/analytics/areas';
            break;
          case 'cumulative':
            endpoint = '/api/analytics/cumulative';
            break;
          case 'clients':
            endpoint = '/api/analytics/clients';
            break;
          default:
            endpoint = '/api/analytics/summary';
        }
        
        const response = await axios.get(`${getMiddlewareUrl()}${endpoint}`, createApiConfig());
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Failed to fetch API analytics',
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'get_area_analytics',
    'Get detailed API usage analytics for a specific service area. Shows which endpoints are most used for that area.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "penang", "klang-valley", "ipoh")'),
    },
    async ({ area }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/analytics/areas/${area}`, createApiConfig());
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Failed to fetch analytics for area ${area}`,
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
