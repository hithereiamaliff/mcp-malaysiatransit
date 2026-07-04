[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/hithereiamaliff-mcp-malaysiatransit-badge.png)](https://mseep.ai/app/hithereiamaliff-mcp-malaysiatransit)

# Malaysia Transit MCP

MCP (Model Context Protocol) server for Malaysia's public transit system, providing real-time bus and train information across 10+ cities in Malaysia.

**MCP Endpoint:** `https://mcp.techmavie.digital/malaysiatransit/mcp`

**Analytics Dashboard:** [`https://mcp.techmavie.digital/malaysiatransit/analytics/dashboard`](https://mcp.techmavie.digital/malaysiatransit/analytics/dashboard)

**Data Source:** [Malaysia Transit Middleware](https://github.com/hithereiamaliff/malaysiatransit-middleware)

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Available Tools](#available-tools)
- [Usage Examples](#usage-examples)
- [AI Integration Guide](#ai-integration-guide)
- [Supported Service Areas](#supported-service-areas)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Features

- **11 Operational Service Areas + 1 Under Maintenance + 1 Coming Soon** across Malaysia
  - Klang Valley (Rapid Rail KL, Rapid Bus KL, MRT Feeder)
  - Penang (Rapid Penang, Penang Ferry, KTM Komuter Utara)
  - Ipoh (BAS.MY Ipoh, KTM Komuter Utara)
  - Seremban (BAS.MY Seremban, KTM Intercity)
  - Kangar (BAS.MY Kangar, KTM Komuter Utara)
  - Alor Setar (BAS.MY Alor Setar, KTM Komuter Utara)
  - Kota Bharu (BAS.MY Kota Bharu, KTM Intercity)
  - Kuala Terengganu, Melaka, Kuching (BAS.MY only)
  - Johor (BAS.MY Johor Bahru + Bas Muafakat Johor — 41 BMJ routes via PAJ adapter)
  - Kuantan (Under Maintenance)
  - Kota Kinabalu (Coming Soon)
- **Real-time Vehicle Tracking** - Live positions of buses and trains
- **Stop Search & Information** - Find stops by name or location
- **Route Discovery** - Browse available routes with destinations
- **Arrival Predictions** - Get real-time arrival times at stops (shape-based, 40-60% more accurate)
- **Schedule Information** - Get departure times, route schedules, and operating status
- **Fare Calculator** - Calculate bus fares for BAS.MY and Rapid Penang routes
- **Multi-Modal Support** - Bus, rail, and ferry services
- **Provider Status Monitoring** - Check operational status of transit providers
- **Location Detection** - Automatically detect service areas using geocoding
- **🆕 KTM Komuter Utara** - 23 stations from Padang Besar to Ipoh with fare calculation
- **🆕 KTM Intercity** - SH and ERT routes (Tumpat - Gemas - JB Sentral)
- **🆕 Penang Ferry** - Butterworth to George Town ferry information
- **🆕 API Analytics** - View API usage statistics, endpoint metrics, and client tracking
- **🆕 Analytics Dashboard** - Visual dashboard with charts for MCP server usage monitoring
- **🆕 Client Identification** - MCP identifies itself to middleware for analytics tracking
- **🆕 Auto-Deployment** - GitHub Actions workflow for automatic VPS deployment
- **🆕 Multi-Modal Journey Planner (Beta)** - `plan_journey` composes bus + rail + ferry + walking legs across Malaysia (Google Directions engine, locally-computed per-leg fares, AA1 cross-border, free CAT routes)
- **🆕 Server-side Places Autocomplete** - `places_autocomplete` + `place_details` for resolving Malaysian place names with transit-aware airport overrides
- **🆕 Fare Metadata** - `get_fare_structures` exposes BAS.MY / Penang / free CAT models so agents can explain how a fare is computed

## Architecture

This MCP server acts as a bridge between AI assistants and the Malaysia Transit Middleware API:

```
AI Assistant (Claude, GPT, etc.)
    ↓
Malaysia Transit MCP Server (identifies as "Malaysia-Transit-MCP")
    ↓
Malaysia Transit Middleware API (tracks usage via X-App-Name header)
    ↓
Malaysia Open Data Portal (GTFS Static & Realtime)
```

**Client Identification:** This MCP automatically sends an `X-App-Name: Malaysia-Transit-MCP` header with every API request, allowing the middleware to track usage from this MCP separately in its analytics dashboard.

## Quick Start

### Connect to the MCP Server

Add this configuration to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "malaysia-transit": {
      "transport": "streamable-http",
      "url": "https://mcp.techmavie.digital/malaysiatransit/mcp"
    }
  }
}
```

### Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector
# Select "Streamable HTTP"
# Enter URL: https://mcp.techmavie.digital/malaysiatransit/mcp
```

### Test with curl

```bash
# List all available tools
curl -X POST https://mcp.techmavie.digital/malaysiatransit/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Call the hello tool
curl -X POST https://mcp.techmavie.digital/malaysiatransit/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"hello","arguments":{}}}'
```

## Installation

```bash
npm install
```

## Configuration

### Environment Variables

The MCP server uses environment variables for configuration:

- **`MIDDLEWARE_URL`** (required): Malaysia Transit Middleware API URL
  - Default: `https://malaysiatransit.techmavie.digital`

- **`INTERNAL_AUTH_TOKEN`** (required for production): Shared secret for middleware API authentication
  - Must match `INTERNAL_APP_AUTH_TOKEN` in the middleware's environment
  - Generate with: `openssl rand -hex 32`

- **`GOOGLE_MAPS_API_KEY`** (optional): Google Maps API key for location detection
  - If not provided, falls back to Nominatim (free but less accurate)
  - Get your API key from [Google Cloud Console](https://console.cloud.google.com/)

- **`ANALYTICS_RESET_KEY`** (optional): Admin key for `POST /analytics/reset`
  - If not set, the reset endpoint is disabled (returns 403)

- **`ANALYTICS_IMPORT_KEY`** (optional): Admin key for `POST /analytics/import`
  - If not set, the import endpoint is disabled (returns 403)

### Development

To run the MCP server in development mode:

```bash
npm run dev
```

### Build

To build the MCP server for deployment:

```bash
npm run build
```

## Available Tools

### Service Area Discovery

#### `list_service_areas`
List all available transit areas in Malaysia.

**Parameters:** None

**Returns:** List of service areas with their IDs, names, and capabilities.

**Example:**
```typescript
const areas = await tools.list_service_areas();
```

#### `get_area_info`
Get detailed information about a specific area.

**Parameters:**
- `areaId` (string): Service area ID (e.g., "penang", "klang-valley")

**Example:**
```typescript
const info = await tools.get_area_info({ areaId: "penang" });
```

### Location Detection

#### `detect_location_area` ⭐
Automatically detect which transit service area a location belongs to using geocoding.

**Parameters:**
- `location` (string): Location name or place (e.g., "KTM Alor Setar", "Komtar", "KLCC")

**Returns:** Detected area ID, confidence level, and location details.

**Example:**
```typescript
const result = await tools.detect_location_area({ location: "KTM Alor Setar" });
// Returns: { area: "alor-setar", confidence: "high" }
```

### Stop Information

#### `search_stops`
Search for stops by name. Use `detect_location_area` first if unsure about the area.

**Parameters:**
- `area` (string): Service area ID
- `query` (string): Search query (e.g., "Komtar", "KLCC")

**Example:**
```typescript
const stops = await tools.search_stops({
  area: "penang",
  query: "Komtar"
});
```

#### `get_stop_details`
Get detailed information about a stop.

**Parameters:**
- `area` (string): Service area ID
- `stopId` (string): Stop ID from search results

#### `get_stop_arrivals` ⭐
Get real-time arrival predictions at a stop.

**Parameters:**
- `area` (string): Service area ID
- `stopId` (string): Stop ID from search results

**Returns:** Includes a comprehensive disclaimer about prediction methodology, followed by arrival data with:
- Calculation method (shape-based or straight-line)
- Confidence level (high, medium, or low)
- ETA in minutes
- Vehicle information

**Prediction Methodology:**
- **Shape-Based Distance** (Preferred): Uses actual route geometry, accurate within ±2-4 minutes
- **Straight-Line Distance** (Fallback): Conservative estimates with 1.4x multiplier
- Includes GPS speed validation, time-of-day adjustments, and stop dwell time
- Conservative bias: Better to arrive early than miss the bus

**Example:**
```typescript
const arrivals = await tools.get_stop_arrivals({
  area: "penang",
  stopId: "stop_123"
});
// Returns disclaimer + arrival data with confidence levels
```

#### `find_nearby_stops`
Find nearby stops and the routes that serve them.

**Parameters:**
- `area` (string): Service area ID
- `location` (string, optional): Place name to geocode (e.g., "KLCC", "Komtar")
- `lat` (number, optional): Latitude coordinate (required if `location` not provided)
- `lon` (number, optional): Longitude coordinate (required if `location` not provided)
- `radius` (number, optional): Search radius in meters (default: 500)

#### `find_nearby_stops_with_arrivals` ⭐
Find nearby stops and get real-time arrivals in one call.

**Parameters:**
- `area` (string): Service area ID
- `location` (string, optional): Place name to geocode
- `lat` (number, optional): Latitude coordinate (required if `location` not provided)
- `lon` (number, optional): Longitude coordinate (required if `location` not provided)
- `radius` (number, optional): Search radius in meters (default: 500)
- `routeFilter` (string, optional): Filter arrivals by route number (e.g., "302", "101")

#### `find_nearby_stops_with_routes`
Find nearby stops and get all routes serving those stops in one call.

**Parameters:**
- `area` (string): Service area ID
- `location` (string, optional): Place name to geocode
- `lat` (number, optional): Latitude coordinate (required if `location` not provided)
- `lon` (number, optional): Longitude coordinate (required if `location` not provided)
- `radius` (number, optional): Search radius in meters (default: 500)

### Route Information

#### `list_routes`
List all routes in an area.

**Parameters:**
- `area` (string): Service area ID

#### `get_route_stops`
Get all stops served by a specific route.

**Parameters:**
- `area` (string): Service area ID
- `routeId` (string): Route ID from `list_routes`

#### `get_route_details`
Get detailed route information.

**Parameters:**
- `area` (string): Service area ID
- `routeId` (string): Route ID from list_routes

#### `get_route_geometry`
Get route path for map visualization.

**Parameters:**
- `area` (string): Service area ID
- `routeId` (string): Route ID from list_routes

### Real-time Data

#### `get_live_vehicles` ⭐
Get real-time vehicle positions.

**Parameters:**
- `area` (string): Service area ID
- `type` (enum, optional): Filter by type ('bus' or 'rail')

**Example:**
```typescript
const vehicles = await tools.get_live_vehicles({ area: "penang" });
```

#### `get_provider_status`
Check provider operational status.

**Parameters:**
- `area` (string): Service area ID

### Schedule Information (NEW)

#### `get_route_departures`
Get the next N departures for a specific route (both directions).

**Parameters:**
- `area` (string): Service area ID (e.g., "ipoh", "seremban", "penang")
- `routeId` (string): Route ID from list_routes
- `count` (number, optional): Number of departures to return (default: 5)

**Example:**
```typescript
const departures = await tools.get_route_departures({
  area: "ipoh",
  routeId: "A32",
  count: 5
});
```

#### `get_next_departure`
Get the single next departure for a route in a specific direction.

**Parameters:**
- `area` (string): Service area ID
- `routeId` (string): Route ID from list_routes
- `direction` (enum, optional): 'outbound', 'inbound', or 'loop'

#### `get_stop_routes`
Get all routes serving a specific stop with their next departures.

**Parameters:**
- `area` (string): Service area ID
- `stopId` (string): Stop ID from search_stops
- `count` (number, optional): Number of departures per route (default: 3)

#### `get_route_schedule`
Get the complete daily schedule for a route.

**Parameters:**
- `area` (string): Service area ID
- `routeId` (string): Route ID from list_routes

#### `get_route_origin`
Get the origin stop name for a route in a specific direction.

**Parameters:**
- `area` (string): Service area ID
- `routeId` (string): Route ID from list_routes
- `direction` (enum, optional): 'outbound' or 'inbound'

#### `get_route_status`
Check if a route is currently operating based on its schedule.

**Parameters:**
- `area` (string): Service area ID
- `routeId` (string): Route ID from list_routes

### Fare Calculator (NEW)

#### `get_fare_routes`
Get all routes available for fare calculation in a specific area.

**Parameters:**
- `area` (string): Service area ID (e.g., "ipoh", "seremban", "penang", "kangar")

**Supported Areas:** BAS.MY areas (Ipoh, Seremban, Kangar, Alor Setar, Kota Bharu, Kuala Terengganu, Melaka, Johor, Kuching) and Rapid Penang.

#### `get_route_stops_for_fare`
Get all stops on a route with their distances for fare calculation.

**Parameters:**
- `area` (string): Service area ID
- `routeId` (string): Route ID from get_fare_routes

#### `calculate_fare` ⭐
Calculate the bus fare between two stops on a route.

**Parameters:**
- `area` (string): Service area ID
- `routeId` (string): Route ID from get_fare_routes
- `fromStop` (string): Origin stop ID
- `toStop` (string): Destination stop ID

**Returns:** Adult, concession, and child fares in MYR with disclaimer.

**Example:**
```typescript
const fare = await tools.calculate_fare({
  area: "ipoh",
  routeId: "A32",
  fromStop: "stop_001",
  toStop: "stop_015"
});
// Returns: { adult: "1.50", concession: "0.75", child: "FREE" }
```

#### `calculate_journey_fare`
Calculate the total fare for a multi-leg journey with bus transfers.

**Parameters:**
- `area` (string): Base service area ID
- `legs` (array): Array of journey legs (max 5), each with:
  - `routeId` (string): Route ID for this leg
  - `fromStop` (string): Origin stop ID
  - `toStop` (string): Destination stop ID
  - `areaId` (string, optional): Area ID for this leg (for inter-area journeys)

**Note:** Each bus change requires a separate fare payment (BAS.MY does not have integrated transfers).

#### `get_route_directions_for_fare`
Get available directions for a route when calculating fares.

**Parameters:**
- `area` (string): Service area ID
- `routeId` (string): Route ID from get_fare_routes

### KTM Komuter Utara Tools (NEW)

#### `get_ktm_komuter_stations`
Get all 23 KTM Komuter Utara stations (Padang Besar - Butterworth - Ipoh line).

**Parameters:** None

**Returns:** Station codes, names, and coordinates.

**Example:**
```typescript
const stations = await tools.get_ktm_komuter_stations();
// Returns: [{ code: "PB", name: "Padang Besar", ... }, ...]
```

#### `calculate_ktm_komuter_fare` ⭐
Calculate KTM Komuter Utara fare between two stations.

**Parameters:**
- `from` (string): Origin station code (e.g., "BU" for Butterworth)
- `to` (string): Destination station code (e.g., "IP" for Ipoh)

**Example:**
```typescript
const fare = await tools.calculate_ktm_komuter_fare({
  from: "BU",
  to: "IP"
});
// Returns: { adult: "12.00", child: "6.00", currency: "MYR" }
```

#### `get_ktm_komuter_fare_matrix`
Get the full KTM Komuter Utara fare matrix showing fares between all station pairs.

**Parameters:** None

#### `get_ktm_station_departures` ⭐
Get departure times for a specific KTM station.

**Parameters:**
- `stationName` (string): Station name (e.g., "Butterworth", "Ipoh")
- `type` (enum): Schedule type - `ktm-komuter-utara` or `ktm-intercity`

**Example:**
```typescript
const departures = await tools.get_ktm_station_departures({
  stationName: "Butterworth",
  type: "ktm-komuter-utara"
});
```

#### `get_ktm_stations`
Get all KTM stations for a specific schedule type.

**Parameters:**
- `type` (enum): `ktm-komuter-utara` or `ktm-intercity`

#### `get_ktm_schedules`
Get full KTM schedule data for a specific schedule type.

**Parameters:**
- `type` (enum): `ktm-komuter-utara` or `ktm-intercity`

#### `find_nearby_ktm_stations`
Find KTM stations near a specific location.

**Parameters:**
- `lat` (number): Latitude coordinate
- `lon` (number): Longitude coordinate
- `radius` (number, optional): Search radius in kilometers (default: 10)
- `type` (enum): `ktm-komuter-utara` or `ktm-intercity`

### Penang Ferry Tools (NEW)

#### `get_penang_ferry_overview` ⭐
Get Penang Ferry service overview including route, operator, and general info.

**Parameters:** None

#### `get_penang_ferry_schedule`
Get the full Penang Ferry schedule with operating hours and frequency.

**Parameters:** None

#### `get_penang_ferry_next_departure`
Get the next upcoming Penang Ferry departures from both terminals.

**Parameters:** None

#### `get_penang_ferry_terminals`
Get Penang Ferry terminal information including locations and facilities.

**Parameters:** None

#### `get_penang_ferry_fare`
Get Penang Ferry fare information and payment methods.

**Parameters:** None

**Example:**
```typescript
const fare = await tools.get_penang_ferry_fare();
// Returns: { adult: "1.40", child: "0.70", ... }
```

### System Tools

#### `get_system_health`
Check the health status of the Malaysia Transit middleware service.

**Parameters:** None

#### `get_debug_info`
Get comprehensive debug information about the middleware service.

**Parameters:** None

### Analytics Tools (NEW)

#### `get_api_analytics`
Get API usage analytics and statistics from the middleware.

**Parameters:**
- `type` (enum, optional): Type of analytics to retrieve:
  - `summary` (default): Overview with requests/hour, error rate, uptime
  - `endpoints`: Per-endpoint statistics
  - `areas`: Per-service-area statistics
  - `cumulative`: All-time totals
  - `clients`: App/website usage breakdown

**Example:**
```typescript
// Get summary analytics
const summary = await tools.get_api_analytics({ type: "summary" });

// Get client usage (see which apps use the API)
const clients = await tools.get_api_analytics({ type: "clients" });
```

#### `get_area_analytics`
Get detailed API usage analytics for a specific service area.

**Parameters:**
- `area` (string): Service area ID (e.g., "penang", "klang-valley")

**Example:**
```typescript
const penangStats = await tools.get_area_analytics({ area: "penang" });
```

### Journey Planner (NEW, BETA)

#### `plan_journey` ⭐
Plan a multi-modal public transport journey across Malaysia. Composes bus, rail, ferry, and walking legs via Google Directions in transit mode, then computes per-leg fares locally.

**Parameters:**
- `originText` (string, optional): Place name (e.g., "Komtar", "Penang Airport", "KL Sentral")
- `originLat` / `originLng` (number, optional): Coordinates (use either text OR lat+lng)
- `destinationText` / `destinationLat` / `destinationLng`: same shape as origin
- `modeBus` / `modeRail` / `modeFerry` (boolean, optional): Filter transport modes
- `language` (string, optional): `en`, `ms`, `th`

**Returns:** Array of journey alternatives, each with `summary` (duration, walking distance, transfer count, fare estimate with `hasMissingFare` flag), `legs[]` (mode, route, from/to stops, times, per-leg fare), and `walkOnly` flag.

**Errors:** `invalid-origin` (400), `invalid-destination` (400), `invalid-modes` (400), `unsupported-inter-area` (400), `area-out-of-coverage` (400), `engine-unavailable` (503), `routing-failed` (503). Surface these messages to the user directly; do not retry recursively.

**Example:**
```typescript
const plan = await tools.plan_journey({
  originText: "Penang Airport",
  destinationText: "Komtar",
});
```

**Beta caveats:** ETAs are scheduled times (use `get_stop_arrivals` for live ETA at boarding stops). Fares may be missing for some legs (`hasMissingFare: true`).

#### `get_journey_areas`
List service areas supported by the journey planner, plus engine name and walking/transit config.

**Parameters:** None

#### `places_autocomplete`
Server-side Google Places autocomplete proxy for Malaysian place names. Returns ranked suggestions including transit-aware overrides (airports snap to canonical bus stops).

**Parameters:**
- `input` (string, 2-120 chars): Search input
- `sessiontoken` (string, optional): Reuse the same token across autocomplete + details calls for Google Places billing
- `language` (string, optional): `en`, `ms`, `th`

**Use case:** When the user gives an ambiguous place name and you want them to disambiguate before calling `plan_journey`.

#### `place_details`
Resolve a `placeId` from `places_autocomplete` into coordinates and a formatted address.

**Parameters:**
- `placeId` (string): From `places_autocomplete` (Google place_id or `override:*` synthetic ID)
- `sessiontoken` (string, optional): Same session token used in autocomplete
- `language` (string, optional)

### Fare Metadata (NEW)

#### `get_fare_structures`
Get the fare structure definitions used by the middleware. Returns BAS.MY distance-based pricing, Rapid Penang staged zones, and free Penang CAT routes (CAT, CT13, C13A/B/C, CT14, CT15).

**Parameters:** None

**Use case:** Explain to a user *how* a fare is computed before calling `calculate_fare`.

#### `get_ktm_intercity_fare`
Look up KTM Intercity (SH and ERT routes) fare. **NOTE:** Currently returns HTTP 501 because Intercity fare data is not yet integrated. The response includes pointers to related endpoints and a link to the official KTMB website. Call this tool to surface the gap honestly to the user rather than guessing a fare.

**Parameters:** None

### Testing

#### `hello`
Simple test tool to verify server is working.

## Usage Examples

### Find When Your Bus is Coming

```typescript
// 1. Detect area from location
const areaResult = await tools.detect_location_area({
  location: "KTM Alor Setar"
});

// 2. Search for your stop
const stops = await tools.search_stops({
  area: areaResult.area,
  query: "KTM Alor Setar"
});

// 3. Get real-time arrivals
const arrivals = await tools.get_stop_arrivals({
  area: areaResult.area,
  stopId: stops[0].id
});
// Returns: "Bus K100(I) arrives in 1 minute, Bus K100(O) in 2 minutes"
```

### Track Live Buses

```typescript
// Get all live vehicles in Penang
const vehicles = await tools.get_live_vehicles({
  area: "penang"
});

// Filter by bus only
const buses = await tools.get_live_vehicles({
  area: "klang-valley",
  type: "bus"
});
```

### Discover Routes

```typescript
// List all routes in Klang Valley
const routes = await tools.list_routes({
  area: "klang-valley"
});

// Get detailed route information
const routeDetails = await tools.get_route_details({
  area: "klang-valley",
  routeId: "LRT-KJ"
});
```

## AI Integration Guide

### Key Use Cases

#### 1. "When is my bus coming?" ⭐

This is the PRIMARY use case. Users want to know when their next bus/train will arrive.

**Workflow:**
```
1. User asks: "When is the next bus at Komtar?"
2. AI uses: detect_location_area({ location: "Komtar" })
3. AI uses: search_stops({ area: "penang", query: "Komtar" })
4. AI uses: get_stop_arrivals({ area: "penang", stopId: "..." })
5. AI responds: "Bus T101 arrives in 5 minutes, Bus T201 in 12 minutes"
```

#### 2. "Where is my bus right now?"

Users want to track their bus in real-time.

**Workflow:**
```
1. User asks: "Where is bus T101 right now?"
2. AI uses: detect_location_area({ location: "Penang" })
3. AI uses: get_live_vehicles({ area: "penang" })
4. AI filters for route T101
5. AI responds: "Bus T101 is currently at [location], heading towards Airport"
```

### Tool Usage Patterns

#### Always Start with Location Detection

When a user mentions a location without specifying the area, use location detection:

```typescript
// User: "When is the next bus at KTM Alor Setar?"
const areaResult = await tools.detect_location_area({ 
  location: "KTM Alor Setar" 
});
// Returns: { area: "alor-setar", confidence: "high" }
```

#### Search Before Details

Always search for stops/routes before requesting details:

```typescript
// ✅ CORRECT
const stops = await tools.search_stops({ area: "penang", query: "Komtar" });
const arrivals = await tools.get_stop_arrivals({ 
  area: "penang", 
  stopId: stops[0].id 
});

// ❌ WRONG - Don't guess stop IDs
const arrivals = await tools.get_stop_arrivals({ 
  area: "penang", 
  stopId: "random_id" 
});
```

### Response Formatting

#### Arrival Times

Format arrival times in a user-friendly way:

```typescript
// ✅ GOOD
"Bus T101 arrives in 5 minutes"
"Train LRT-KJ arrives in 2 minutes"
"Next bus: T201 in 12 minutes"

// ❌ BAD
"Arrival time: 2025-01-07T14:30:00Z"
"ETA: 1736258400000"
```

#### Multiple Arrivals

Present multiple arrivals clearly:

```typescript
"Upcoming arrivals at Komtar:
• T101 → Airport: 5 minutes
• T201 → Bayan Lepas: 12 minutes
• T102 → Gurney: 18 minutes"
```

### Error Handling

#### Provider Unavailable

```typescript
try {
  const arrivals = await tools.get_stop_arrivals({ ... });
} catch (error) {
  // Check provider status
  const status = await tools.get_provider_status({ area: "penang" });
  
  if (status.providers[0].status !== "active") {
    "The transit provider is currently unavailable. 
     Please try again later or check the official transit app."
  }
}
```

### Best Practices

1. **Use location detection** when users mention place names
2. **Always specify area** for every tool (except `list_service_areas` and `detect_location_area`)
3. **Search before details** - don't guess IDs
4. **Handle errors gracefully** - providers may have temporary outages
5. **Format responses clearly** - use minutes, not timestamps
6. **Don't cache real-time data** - it updates every 30 seconds

## Supported Service Areas

| Area ID | Name | Providers | Transit Types | Fare Calculator |
|---------|------|-----------|---------------|------------------|
| `klang-valley` | Klang Valley | Rapid Rail KL, Rapid Bus KL, MRT Feeder | Bus, Rail | ❌ (Rapid KL fares not modelled) |
| `penang` | Penang | Rapid Penang (incl. free CAT routes — RM 0), Penang Ferry, KTM Komuter Utara | Bus, Ferry, Rail | ✅ |
| `kuantan` | Kuantan | Under Maintenance | Bus | ❌ |
| `ipoh` | Ipoh | BAS.MY Ipoh, KTM Komuter Utara | Bus, Rail | ✅ |
| `seremban` | Seremban | BAS.MY Seremban, KTM Intercity | Bus, Rail | ✅ |
| `kangar` | Kangar | BAS.MY Kangar, KTM Komuter Utara | Bus, Rail | ✅ |
| `alor-setar` | Alor Setar | BAS.MY Alor Setar, KTM Komuter Utara | Bus, Rail | ✅ |
| `kota-bharu` | Kota Bharu | BAS.MY Kota Bharu, KTM Intercity | Bus, Rail | ✅ |
| `kuala-terengganu` | Kuala Terengganu | BAS.MY Kuala Terengganu | Bus | ✅ |
| `melaka` | Melaka | BAS.MY Melaka | Bus | ✅ |
| `johor` | Johor Bahru | BAS.MY Johor Bahru + Bas Muafakat Johor (BMJ — 41 routes) | Bus | ✅ |
| `kuching` | Kuching | BAS.MY Kuching | Bus | ✅ |
| `kota-kinabalu` | Kota Kinabalu | Coming Soon | - | ❌ |

### KTM Services

| Service | Route | Stations | Fare Calculator |
|---------|-------|----------|------------------|
| KTM Komuter Utara | Padang Besar ↔ Butterworth ↔ Ipoh | 23 stations | ✅ |
| KTM Intercity (SH) | JB Sentral ↔ Gemas ↔ Tumpat | Multiple | ❌ (Coming Soon) |
| KTM Intercity (ERT) | JB Sentral ↔ Gemas ↔ Tumpat | Multiple | ❌ (Coming Soon) |

### Location to Area Mapping

The `detect_location_area` tool automatically maps common locations to service areas:

| User Says | Area ID |
|-----------|---------|
| Ipoh, Bercham, Tanjung Rambutan, Medan Kidd | `ipoh` |
| Seremban, Nilai, Port Dickson | `seremban` |
| George Town, Butterworth, Bayan Lepas, Penang Sentral | `penang` |
| KLCC, Shah Alam, Putrajaya | `klang-valley` |
| Kuantan, Pekan, Bandar Indera Mahkota | `kuantan` |
| Kangar, Arau, Kuala Perlis, Padang Besar | `kangar` |
| Alor Setar, Sungai Petani, Pendang, Jitra | `alor-setar` |
| Kota Bharu, Rantau Panjang, Bachok, Machang, Jeli | `kota-bharu` |
| Kuala Terengganu, Merang, Marang, Setiu | `kuala-terengganu` |
| Melaka, Tampin, Jasin, Masjid Tanah | `melaka` |
| Johor Bahru, Iskandar Puteri, Pasir Gudang, Kulai | `johor` |
| Kuching, Bau, Serian, Bako, Siniawan, Matang | `kuching` |

## Deployment

### Production Server

The MCP server is deployed at:
- **Endpoint:** `https://mcp.techmavie.digital/malaysiatransit/mcp`
- **Health Check:** `https://mcp.techmavie.digital/malaysiatransit/health`
- **Analytics Dashboard:** `https://mcp.techmavie.digital/malaysiatransit/analytics/dashboard`
- **Analytics API:** `https://mcp.techmavie.digital/malaysiatransit/analytics`
- **Transport:** Streamable HTTP

### Analytics Dashboard

The MCP server includes a built-in analytics dashboard that tracks:
- **Total requests and tool calls**
- **Tool usage distribution** (doughnut chart)
- **Hourly request trends** (last 24 hours)
- **Requests by endpoint** (bar chart)
- **Top clients by user agent**
- **Recent tool calls feed**

The dashboard auto-refreshes every 30 seconds.

### Self-Hosting

To deploy your own instance, see the [deployment guide](./deploy/DEPLOYMENT.md).

```bash
# Using Docker
docker compose up -d --build

# Or run directly
npm run build
npm run start:http
```

### Auto-Deployment

This repository includes a GitHub Actions workflow for automatic VPS deployment. When you push to `main`, the server automatically redeploys.

To set up auto-deployment, add these secrets to your GitHub repository:
- `VPS_HOST` - Your VPS IP address
- `VPS_USERNAME` - SSH username (e.g., `root`)
- `VPS_PORT` - SSH port (e.g., `22`)
- `VPS_SSH_KEY` - Private SSH key for authentication
- `GOOGLE_MAPS_API_KEY` - Google Maps API key for geocoding
- `INTERNAL_AUTH_TOKEN` - Shared auth token (must match middleware's `INTERNAL_APP_AUTH_TOKEN`)
- `ANALYTICS_RESET_KEY` (optional) - Enables `/analytics/reset` admin endpoint
- `ANALYTICS_IMPORT_KEY` (optional) - Enables `/analytics/import` admin endpoint

## Troubleshooting

### Connection Issues

If you can't connect to the middleware:

1. Verify your `MIDDLEWARE_URL` is correct
2. Ensure the middleware is running and accessible
3. Check network connectivity
4. Verify `INTERNAL_AUTH_TOKEN` matches middleware `INTERNAL_APP_AUTH_TOKEN` (if middleware auth is enabled)
5. Test middleware directly: `curl https://your-middleware-url/api/areas`

### No Data Returned

If tools return empty data:

1. Check if the service area is operational using `get_provider_status`
2. Verify the area ID is correct using `list_service_areas`
3. Check middleware logs for errors

### Real-time Data Unavailable

Real-time data depends on the upstream GTFS providers:

1. Use `get_provider_status` to check provider health
2. Some providers may have temporary outages
3. Check the middleware logs for API issues

### Location Detection Not Working

If location detection returns incorrect results:

1. Ensure `GOOGLE_MAPS_API_KEY` is set in environment variables
2. Check Google Cloud Console for API quota limits
3. Verify the API key has Geocoding API enabled
4. Falls back to Nominatim if Google Maps fails

## Requirements

- **Node.js**: >= 18.0.0
- **Malaysia Transit Middleware**: Running instance (local or deployed)
- **Google Maps API Key**: Optional, for enhanced location detection

## Project Structure

```
malaysiatransit-mcp/
├── src/
│   ├── index.ts              # Main MCP server entry point
│   ├── http-server.ts        # Streamable HTTP server with analytics
│   ├── transit.tools.ts      # Transit tool implementations
│   ├── geocoding.utils.ts    # Location detection utilities
│   ├── inspector.ts          # MCP Inspector entry point
│   └── server.ts             # HTTP server for testing
├── deploy/
│   ├── DEPLOYMENT.md         # VPS deployment guide
│   └── nginx-mcp.conf        # Nginx reverse proxy config
├── .github/
│   └── workflows/
│       └── deploy-vps.yml    # GitHub Actions auto-deploy
├── docker-compose.yml        # Docker deployment config
├── Dockerfile                # Container build config
├── package.json              # Project dependencies
├── tsconfig.json             # TypeScript configuration
├── .env.sample               # Environment variables template
├── README.md                 # This file
└── LICENSE                   # MIT License
```

## Related Projects

- **[Malaysia Open Data MCP](https://github.com/hithereiamaliff/mcp-datagovmy)** - MCP for Malaysia's open data portal

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues.

## License

MIT - See [LICENSE](./LICENSE) file for details.

## Acknowledgments

- [Malaysia Open Data Portal](https://data.gov.my/) for GTFS data
- [Prasarana Malaysia](https://www.prasarana.com.my/) for Rapid KL services
- [BAS.MY](https://bas.my/) for regional bus services
- [Model Context Protocol](https://modelcontextprotocol.io/) for the MCP framework
- [Google Maps Platform](https://developers.google.com/maps) for geocoding services
- [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/) for fallback geocoding

---

Made with ❤️ by [Aliff](https://mynameisaliff.co.uk/)
