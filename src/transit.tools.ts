/**
 * Malaysia Transit Tools
 * Tools for accessing real-time bus and train information
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import axios from 'axios';
import { detectAreaFromLocation, getAreaStateMapping } from './geocoding.utils.js';

// Get middleware URL from environment
const getMiddlewareUrl = (): string => {
  return process.env.MIDDLEWARE_URL || 'http://localhost:3000';
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
        const response = await axios.get(`${getMiddlewareUrl()}/api/areas`);
        
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
        const response = await axios.get(`${getMiddlewareUrl()}/api/areas/${areaId}`);
        
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
        const response = await axios.get(`${getMiddlewareUrl()}/api/stops/search`, {
          params: { area, q: query },
        });
        
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
        const response = await axios.get(`${getMiddlewareUrl()}/api/stops/${stopId}`, {
          params: { area },
        });
        
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
        const response = await axios.get(`${getMiddlewareUrl()}/api/stops/${stopId}/arrivals`, {
          params: { area },
        });
        
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
        const response = await axios.get(`${getMiddlewareUrl()}/api/stops/nearby`, {
          params: { area, lat, lon, radius },
        });
        
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
        const response = await axios.get(`${getMiddlewareUrl()}/api/routes`, {
          params: { area },
        });
        
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
        const response = await axios.get(`${getMiddlewareUrl()}/api/routes/${routeId}`, {
          params: { area },
        });
        
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
        const response = await axios.get(`${getMiddlewareUrl()}/api/routes/${routeId}/geometry`, {
          params: { area },
        });
        
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
        
        const response = await axios.get(`${getMiddlewareUrl()}/api/realtime`, {
          params,
        });
        
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
        const response = await axios.get(`${getMiddlewareUrl()}/api/areas/${area}/providers/status`);
        
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

  server.tool(
    'get_route_departures',
    'Get the next N departures for a specific route (both directions). Useful for showing upcoming bus/train times.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "ipoh", "seremban", "penang")'),
      routeId: z.coerce.string().describe('Route ID from list_routes'),
      count: z.coerce.number().optional().default(5).describe('Number of departures to return (default: 5)'),
    },
    async ({ area, routeId, count }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/schedules/routes/${routeId}/departures`, {
          params: { area, count },
        });
        
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
    'Get the single next departure for a route in a specific direction. Quick way to find when the next bus/train leaves.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "ipoh", "seremban", "penang")'),
      routeId: z.coerce.string().describe('Route ID from list_routes'),
      direction: z.enum(['outbound', 'inbound', 'loop']).optional().describe('Direction of travel (optional)'),
    },
    async ({ area, routeId, direction }) => {
      try {
        const params: any = { area };
        if (direction) {
          params.direction = direction;
        }
        
        const response = await axios.get(`${getMiddlewareUrl()}/api/schedules/routes/${routeId}/next`, {
          params,
        });
        
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
    'Get all routes serving a specific stop with their next departures. Shows which buses/trains stop here and when.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "ipoh", "seremban", "penang")'),
      stopId: z.coerce.string().describe('Stop ID from search_stops'),
      count: z.coerce.number().optional().default(3).describe('Number of departures per route (default: 3)'),
    },
    async ({ area, stopId, count }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/schedules/stops/${stopId}/routes`, {
          params: { area, count },
        });
        
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
    'Get the complete daily schedule for a route. Shows all departure times throughout the day.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "ipoh", "seremban", "penang")'),
      routeId: z.coerce.string().describe('Route ID from list_routes'),
    },
    async ({ area, routeId }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/schedules/routes/${routeId}/full`, {
          params: { area },
        });
        
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
    'Get the origin stop name for a route in a specific direction. Useful for showing where the bus/train starts.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "ipoh", "seremban", "penang")'),
      routeId: z.coerce.string().describe('Route ID from list_routes'),
      direction: z.enum(['outbound', 'inbound']).optional().describe('Direction of travel (optional)'),
    },
    async ({ area, routeId, direction }) => {
      try {
        const params: any = { area };
        if (direction) {
          params.direction = direction;
        }
        
        const response = await axios.get(`${getMiddlewareUrl()}/api/schedules/routes/${routeId}/origin`, {
          params,
        });
        
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
    'Check if a route is currently operating based on its schedule. Shows if buses/trains are running now.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "ipoh", "seremban", "penang")'),
      routeId: z.coerce.string().describe('Route ID from list_routes'),
    },
    async ({ area, routeId }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/schedules/routes/${routeId}/status`, {
          params: { area },
        });
        
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
    'Get all routes available for fare calculation in a specific area. Currently supports BAS.MY areas (Ipoh, Seremban, Kangar, etc.) and Rapid Penang.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "ipoh", "seremban", "penang", "kangar")'),
    },
    async ({ area }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/fare/${area}/routes`);
        
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
    'Get all stops on a route with their distances for fare calculation. Use this to find stop IDs for calculate_fare.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "ipoh", "seremban", "penang")'),
      routeId: z.coerce.string().describe('Route ID from get_fare_routes'),
    },
    async ({ area, routeId }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/fare/${area}/route/${routeId}/stops`);
        
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
    'Calculate the bus fare between two stops on a route. Returns adult, concession, and child fares in MYR.',
    {
      area: z.coerce.string().describe('Service area ID (e.g., "ipoh", "seremban", "penang")'),
      routeId: z.coerce.string().describe('Route ID from get_fare_routes'),
      fromStop: z.coerce.string().describe('Origin stop ID from get_route_stops_for_fare'),
      toStop: z.coerce.string().describe('Destination stop ID from get_route_stops_for_fare'),
    },
    async ({ area, routeId, fromStop, toStop }) => {
      try {
        const response = await axios.get(`${getMiddlewareUrl()}/api/fare/${area}/calculate`, {
          params: { routeId, fromStop, toStop },
        });
        
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
        const response = await axios.get(`${getMiddlewareUrl()}/api/fare/${area}/calculate-journey`, {
          params: { legs: JSON.stringify(legs) },
        });
        
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
        const response = await axios.get(`${getMiddlewareUrl()}/health`);
        
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
        const response = await axios.get(`${getMiddlewareUrl()}/api/debug`);
        
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
}
