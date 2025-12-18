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
  return process.env.MIDDLEWARE_URL || 'https://malaysiatransit.techmavie.digital';
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
    'Automatically detect which transit service area a location belongs to using geocoding. Use this when the user mentions a place name without specifying the area (e.g., "KTM Alor Setar", "Komtar", "KLCC"). IMPORTANT: After detecting the area, use find_nearby_stops_with_arrivals or find_nearby_stops with the location parameter - these tools handle geocoding automatically and are more reliable than using coordinates from this tool.',
    {
      location: z.coerce.string().describe('Location name or place (e.g., "KTM Alor Setar", "Komtar", "Pavilion KL")'),
    },
    async ({ location }) => {
      try {
        const result = await detectAreaFromLocation(location);
        
        if (result) {
          // Add guidance for AI models on next steps
          const guidance = result.location.lat === 0 || result.location.lon === 0
            ? 'NOTE: Geocoding did not return coordinates. Use find_nearby_stops_with_arrivals or find_nearby_stops with the "location" parameter instead of coordinates.'
            : 'TIP: You can use find_nearby_stops_with_arrivals with the "location" parameter for a simpler workflow.';
          
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
                  nextStepGuidance: guidance,
                  recommendedTools: [
                    'find_nearby_stops_with_arrivals - Find nearby stops AND get arrivals in one call',
                    'find_nearby_stops - Find nearby stops (supports location parameter)',
                    'search_stops - Search stops by name (auto-geocodes if no match)',
                  ],
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
    'Search for bus or train stops by name in a specific area. The middleware will automatically geocode place names (like "Ideal Foresta") and find nearby stops if no exact stop name match is found. IMPORTANT: If you are unsure which area a location belongs to, use detect_location_area first to automatically determine the correct area.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "penang", "klang-valley"). Use detect_location_area if unsure.'),
      query: z.coerce.string().describe('Search query - can be a stop name (e.g., "Komtar") OR a place name (e.g., "Ideal Foresta"). Place names will be auto-geocoded to find nearby stops.'),
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
    'Find bus or train stops near a specific location AND get all routes serving those stops. You can provide EITHER coordinates (lat/lon) OR a location name - the middleware will geocode place names automatically.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "penang", "klang-valley")'),
      lat: z.coerce.number().optional().describe('Latitude coordinate (optional if location is provided)'),
      lon: z.coerce.number().optional().describe('Longitude coordinate (optional if location is provided)'),
      location: z.coerce.string().optional().describe('Place name to geocode (e.g., "Ideal Foresta", "KLCC", "Komtar"). Use this instead of lat/lon for convenience.'),
      radius: z.coerce.number().optional().default(500).describe('Search radius in meters (default: 500)'),
    },
    async ({ area, lat, lon, location, radius }) => {
      try {
        const params: any = { area, radius };
        
        // If location is provided, use it for geocoding
        if (location) {
          params.location = location;
        } else if (lat !== undefined && lon !== undefined) {
          params.lat = lat;
          params.lon = lon;
        } else {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: 'Missing location parameters',
                  message: 'Please provide either a location name OR lat/lon coordinates',
                }, null, 2),
              },
            ],
            isError: true,
          };
        }
        
        // Use /api/stops/nearby/routes endpoint (not /api/stops/nearby which doesn't exist)
        const response = await axios.get(`${getMiddlewareUrl()}/api/stops/nearby/routes`, createApiConfig(params));
        
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

  server.tool(
    'find_nearby_stops_with_arrivals',
    'Find bus stops near a location AND get real-time arrival predictions in one call. RECOMMENDED: Use this tool when users ask about nearby bus stops and arrival times together. Accepts a place name (e.g., "Ideal Foresta") - the middleware handles geocoding automatically.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "penang", "klang-valley")'),
      location: z.coerce.string().optional().describe('Place name to geocode (e.g., "Ideal Foresta", "KLCC", "Komtar")'),
      lat: z.coerce.number().optional().describe('Latitude coordinate (optional if location is provided)'),
      lon: z.coerce.number().optional().describe('Longitude coordinate (optional if location is provided)'),
      radius: z.coerce.number().optional().default(500).describe('Search radius in meters (default: 500)'),
      routeFilter: z.coerce.string().optional().describe('Filter arrivals by route number (e.g., "302", "101")'),
    },
    async ({ area, location, lat, lon, radius, routeFilter }) => {
      try {
        const params: any = { area, radius };
        
        if (location) {
          params.location = location;
        } else if (lat !== undefined && lon !== undefined) {
          params.lat = lat;
          params.lon = lon;
        } else {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: 'Missing location parameters',
                  message: 'Please provide either a location name OR lat/lon coordinates',
                }, null, 2),
              },
            ],
            isError: true,
          };
        }
        
        if (routeFilter) {
          params.route = routeFilter;
        }
        
        const response = await axios.get(`${getMiddlewareUrl()}/api/stops/nearby/arrivals`, createApiConfig(params));
        
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
                error: `Failed to find nearby stops with arrivals`,
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
    'find_nearby_stops_with_routes',
    'Find bus stops near a location AND get all routes serving those stops in one call. Accepts a place name (e.g., "Ideal Foresta") - the middleware handles geocoding automatically.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "penang", "klang-valley")'),
      location: z.coerce.string().optional().describe('Place name to geocode (e.g., "Ideal Foresta", "KLCC", "Komtar")'),
      lat: z.coerce.number().optional().describe('Latitude coordinate (optional if location is provided)'),
      lon: z.coerce.number().optional().describe('Longitude coordinate (optional if location is provided)'),
      radius: z.coerce.number().optional().default(500).describe('Search radius in meters (default: 500)'),
    },
    async ({ area, location, lat, lon, radius }) => {
      try {
        const params: any = { area, radius };
        
        if (location) {
          params.location = location;
        } else if (lat !== undefined && lon !== undefined) {
          params.lat = lat;
          params.lon = lon;
        } else {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: 'Missing location parameters',
                  message: 'Please provide either a location name OR lat/lon coordinates',
                }, null, 2),
              },
            ],
            isError: true,
          };
        }
        
        const response = await axios.get(`${getMiddlewareUrl()}/api/stops/nearby/routes`, createApiConfig(params));
        
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
                error: `Failed to find nearby stops with routes`,
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
    'get_route_stops',
    'Get all stops on a specific route. Use this to find which stops a bus/train route serves. IMPORTANT: First call list_routes to get the correct route_id.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "penang", "klang-valley")'),
      routeId: z.coerce.string().describe('Route ID from list_routes (e.g., "302", "101")'),
    },
    async ({ area, routeId }) => {
      try {
        // Use geometry endpoint which includes stops
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
    'get_route_details',
    'Get detailed information about a specific route including stops and geometry. IMPORTANT: First call list_routes to get the correct route_id.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "penang", "klang-valley")'),
      routeId: z.coerce.string().describe('Route ID from list_routes (e.g., "302", "101")'),
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

  // Areas that support schedule data
  const SCHEDULE_SUPPORTED_AREAS = ['penang', 'ipoh', 'seremban', 'kangar', 'alor-setar', 'kota-bharu', 'kuala-terengganu', 'melaka', 'johor', 'kuching'];
  

  server.tool(
    'get_route_departures',
    'Get the next N departures for a specific route (both directions). Useful for showing upcoming bus/train times. IMPORTANT: Use route_short_name (e.g., "K10", "A32", "R10", "101") NOT the numeric route_id. Works for: penang, ipoh, seremban, kangar, alor-setar, kota-bharu, kuala-terengganu, melaka, johor, kuching.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "penang", "ipoh", "seremban", "alor-setar")'),
      routeId: z.coerce.string().describe('Route SHORT NAME (e.g., "101", "K10", "A32") - NOT the numeric route_id. Get this from list_routes route_short_name field.'),
      count: z.coerce.number().optional().default(5).describe('Number of departures to return (default: 5)'),
    },
    async ({ area, routeId, count }) => {
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
    'Get the single next departure for a route in a specific direction. Quick way to find when the next bus/train leaves. IMPORTANT: Use route_short_name (e.g., "101", "K10", "A32") NOT numeric route_id. Works for: penang, ipoh, seremban, kangar, alor-setar, kota-bharu, kuala-terengganu, melaka, johor, kuching.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "penang", "ipoh", "seremban", "alor-setar")'),
      routeId: z.coerce.string().describe('Route SHORT NAME (e.g., "101", "K10", "A32") - NOT numeric route_id'),
      direction: z.enum(['outbound', 'inbound', 'loop']).optional().describe('Direction of travel (optional)'),
    },
    async ({ area, routeId, direction }) => {
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
    'Get all routes serving a specific stop with their next departures. Shows which buses/trains stop here and when. Works for: penang, ipoh, seremban, kangar, alor-setar, kota-bharu, kuala-terengganu, melaka, johor, kuching.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "penang", "ipoh", "seremban", "alor-setar")'),
      stopId: z.coerce.string().describe('Stop ID from search_stops'),
      count: z.coerce.number().optional().default(3).describe('Number of departures per route (default: 3)'),
    },
    async ({ area, stopId, count }) => {
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
    'Get the complete daily schedule for a route. Shows all departure times throughout the day. IMPORTANT: Use route_short_name (e.g., "101", "K10", "A32") NOT numeric route_id. Works for: penang, ipoh, seremban, kangar, alor-setar, kota-bharu, kuala-terengganu, melaka, johor, kuching.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "penang", "ipoh", "seremban", "alor-setar")'),
      routeId: z.coerce.string().describe('Route SHORT NAME (e.g., "101", "K10", "A32") - NOT numeric route_id'),
    },
    async ({ area, routeId }) => {
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
    'Get the origin stop name for a route in a specific direction. Useful for showing where the bus/train starts. IMPORTANT: Use route_short_name (e.g., "101", "K10", "A32") NOT numeric route_id. Works for: penang, ipoh, seremban, kangar, alor-setar, kota-bharu, kuala-terengganu, melaka, johor, kuching.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "penang", "ipoh", "seremban", "alor-setar")'),
      routeId: z.coerce.string().describe('Route SHORT NAME (e.g., "101", "K10", "A32") - NOT numeric route_id'),
      direction: z.enum(['outbound', 'inbound']).optional().describe('Direction of travel (optional)'),
    },
    async ({ area, routeId, direction }) => {
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
    'Check if a route is currently operating based on its schedule. Shows if buses/trains are running now. IMPORTANT: Use route_short_name (e.g., "101", "K10", "A32") NOT numeric route_id. Works for: penang, ipoh, seremban, kangar, alor-setar, kota-bharu, kuala-terengganu, melaka, johor, kuching.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "penang", "ipoh", "seremban", "alor-setar")'),
      routeId: z.coerce.string().describe('Route SHORT NAME (e.g., "101", "K10", "A32") - NOT numeric route_id'),
    },
    async ({ area, routeId }) => {
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

  server.tool(
    'get_route_directions_for_fare',
    'Get available directions for a route when calculating fares. Use this to determine which direction (outbound/inbound) to use for fare calculation.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "penang", "ipoh")'),
      routeId: z.coerce.string().describe('Route ID from get_fare_routes'),
    },
    async ({ area, routeId }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/fare/${area}/route/${routeId}/directions`, createApiConfig());
        
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
                error: `Failed to fetch directions for route ${routeId}`,
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
  // KTM KOMUTER UTARA TOOLS (NEW)
  // ============================================================================

  server.tool(
    'get_ktm_komuter_stations',
    'Get all 23 KTM Komuter Utara stations (Padang Besar - Butterworth - Ipoh line). Returns station codes, names, and coordinates.',
    {},
    async () => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/ktm/komuter/stations`, createApiConfig());
        
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
                error: 'Failed to fetch KTM Komuter stations',
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
    'calculate_ktm_komuter_fare',
    'Calculate KTM Komuter Utara fare between two stations. Use station codes (e.g., "BU" for Butterworth, "IP" for Ipoh, "PB" for Padang Besar).',
    {
      from: z.coerce.string().describe('Origin station code (e.g., "BU", "IP", "PB")'),
      to: z.coerce.string().describe('Destination station code (e.g., "BU", "IP", "PB")'),
    },
    async ({ from, to }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/ktm/komuter/fare`, createApiConfig({ from, to }));
        
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
                error: 'Failed to calculate KTM Komuter fare',
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
    'get_ktm_komuter_fare_matrix',
    'Get the full KTM Komuter Utara fare matrix showing fares between all station pairs.',
    {},
    async () => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/ktm/komuter/fare-matrix`, createApiConfig());
        
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
                error: 'Failed to fetch KTM Komuter fare matrix',
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
    'get_ktm_station_departures',
    'Get departure times for a specific KTM station. Supports both KTM Komuter Utara and KTM Intercity schedules.',
    {
      stationName: z.coerce.string().describe('Station name (e.g., "Butterworth", "Ipoh", "Padang Besar", "Gemas")'),
      type: z.enum(['ktm-komuter-utara', 'ktm-intercity']).describe('Schedule type: ktm-komuter-utara (Padang Besar-Ipoh) or ktm-intercity (SH/ERT routes)'),
    },
    async ({ stationName, type }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/ktm/stations/${encodeURIComponent(stationName)}/departures`, createApiConfig({ type }));
        
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
                error: `Failed to fetch departures for station ${stationName}`,
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
    'get_ktm_stations',
    'Get all KTM stations for a specific schedule type (Komuter Utara or Intercity).',
    {
      type: z.enum(['ktm-komuter-utara', 'ktm-intercity']).describe('Schedule type: ktm-komuter-utara or ktm-intercity'),
    },
    async ({ type }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/ktm/stations`, createApiConfig({ type }));
        
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
                error: 'Failed to fetch KTM stations',
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
    'get_ktm_schedules',
    'Get full KTM schedule data for a specific schedule type. Returns complete timetable information.',
    {
      type: z.enum(['ktm-komuter-utara', 'ktm-intercity']).describe('Schedule type: ktm-komuter-utara or ktm-intercity'),
    },
    async ({ type }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/ktm/schedules`, createApiConfig({ type }));
        
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
                error: 'Failed to fetch KTM schedules',
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
    'find_nearby_ktm_stations',
    'Find KTM stations near a specific location. You can provide EITHER coordinates (lat/lon) OR a location name - the middleware will geocode place names automatically.',
    {
      location: z.coerce.string().optional().describe('Place name to geocode (e.g., "Butterworth", "Ipoh", "Padang Besar"). Use this instead of lat/lon for convenience.'),
      lat: z.coerce.number().optional().describe('Latitude coordinate (optional if location is provided)'),
      lon: z.coerce.number().optional().describe('Longitude coordinate (optional if location is provided)'),
      radius: z.coerce.number().optional().default(10).describe('Search radius in kilometers (default: 10)'),
      type: z.enum(['ktm-komuter-utara', 'ktm-intercity']).describe('Schedule type: ktm-komuter-utara or ktm-intercity'),
    },
    async ({ location, lat, lon, radius, type }) => {
      try {
        const params: any = { radius, type };
        
        if (location) {
          params.location = location;
        } else if (lat !== undefined && lon !== undefined) {
          params.lat = lat;
          params.lon = lon;
        } else {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: 'Missing location parameters',
                  message: 'Please provide either a location name OR lat/lon coordinates',
                }, null, 2),
              },
            ],
            isError: true,
          };
        }
        
        const response = await axios.get(`${getMiddlewareUrl()}/api/ktm/nearby`, createApiConfig(params));
        
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
                error: 'Failed to find nearby KTM stations',
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
  // PENANG FERRY TOOLS (NEW)
  // ============================================================================

  server.tool(
    'get_penang_ferry_overview',
    'Get Penang Ferry service overview including terminals, operating hours, frequency, and contact information. The ferry operates between Butterworth and George Town.',
    {},
    async () => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/ferry/penang`, createApiConfig());
        
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
                error: 'Failed to fetch Penang Ferry overview',
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
    'get_penang_ferry_schedule',
    'Get full Penang Ferry schedule with departure times. Supports filtering by direction and day type.',
    {
      direction: z.enum(['butterworth-georgetown', 'georgetown-butterworth']).optional().describe('Filter by direction (optional)'),
      day: z.enum(['weekday', 'weekend']).optional().describe('Filter by day type (optional)'),
    },
    async ({ direction, day }) => {
      try {
        const params: any = {};
        if (direction) params.direction = direction;
        if (day) params.day = day;
        
        const response = await axios.get(`${getMiddlewareUrl()}/api/ferry/penang/schedule`, createApiConfig(params));
        
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
                error: 'Failed to fetch Penang Ferry schedule',
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
    'get_penang_ferry_next_departure',
    'Get next ferry departures from both Butterworth and George Town terminals in real-time. Shows minutes until departure.',
    {},
    async () => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/ferry/penang/next`, createApiConfig());
        
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
                error: 'Failed to fetch next ferry departures',
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
    'get_penang_ferry_terminals',
    'Get detailed information about Penang Ferry terminals including facilities, connections, parking, and nearby attractions.',
    {},
    async () => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/ferry/penang/terminals`, createApiConfig());
        
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
                error: 'Failed to fetch ferry terminal information',
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
    'get_penang_ferry_fare',
    'Get Penang Ferry fare information, payment methods, and terminal coordinates.',
    {},
    async () => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/ferry/penang/fare`, createApiConfig());
        
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
                error: 'Failed to fetch Penang Ferry fare information',
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
