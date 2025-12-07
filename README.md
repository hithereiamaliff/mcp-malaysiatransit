# Malaysia Transit MCP

[![smithery badge](https://smithery.ai/badge/@hithereiamaliff/mcp-malaysiatransit)](https://smithery.ai/server/@hithereiamaliff/mcp-malaysiatransit)

MCP (Model Context Protocol) server for Malaysia's public transit system, providing real-time bus and train information across 10+ cities in Malaysia.

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

- **12 Operational Service Areas** across Malaysia
  - Klang Valley (Rapid Rail KL, Rapid Bus KL, MRT Feeder)
  - Penang (Rapid Penang)
  - Kuantan (Rapid Kuantan)
  - Ipoh, Seremban, Kangar, Alor Setar, Kota Bharu, Kuala Terengganu, Melaka, Johor, Kuching (BAS.MY)
- **Real-time Vehicle Tracking** - Live positions of buses and trains
- **Stop Search & Information** - Find stops by name or location
- **Route Discovery** - Browse available routes with destinations
- **Arrival Predictions** - Get real-time arrival times at stops (shape-based, 40-60% more accurate)
- **🆕 Schedule Information** - Get departure times, route schedules, and operating status
- **🆕 Fare Calculator** - Calculate bus fares for BAS.MY and Rapid Penang routes
- **Multi-Modal Support** - Both bus and rail services
- **Provider Status Monitoring** - Check operational status of transit providers
- **Location Detection** - Automatically detect service areas using geocoding

## Architecture

This MCP server acts as a bridge between AI assistants and the Malaysia Transit Middleware API:

```
AI Assistant (Claude, GPT, etc.)
    ↓
Malaysia Transit MCP Server
    ↓
Malaysia Transit Middleware API
    ↓
Malaysia Open Data Portal (GTFS Static & Realtime)
```

## Quick Start

### Local Testing with Smithery Playground

#### Step 1: Start Your Middleware

First, ensure your Malaysia Transit Middleware is running:

```bash
cd path/to/malaysiatransit-middleware
npm run dev
```

The middleware should be running on `http://localhost:3000`.

#### Step 2: Configure Environment

Create a `.env` file in the MCP project root:

```bash
cd malaysiatransit-mcp
cp .env.sample .env
```

Edit `.env`:
```env
MIDDLEWARE_URL=http://localhost:3000
GOOGLE_MAPS_API_KEY=your_api_key_here  # Optional, for location detection
```

#### Step 3: Start Smithery Dev Server

```bash
npm install
npm run dev
```

This will:
1. Build your MCP server
2. Start the Smithery CLI in development mode
3. Open the Smithery playground in your browser

#### Step 4: Test in Smithery Playground

In the Smithery playground interface:

1. **Test the hello tool:**
   ```
   Call: hello
   ```
   Expected: Returns server info and middleware URL

2. **List service areas:**
   ```
   Call: list_service_areas
   ```
   Expected: Returns all available transit areas

3. **Search for stops:**
   ```
   Call: search_stops
   Parameters:
     area: "penang"
     query: "Komtar"
   ```
   Expected: Returns matching stops

4. **Get real-time arrivals:**
   ```
   Call: get_stop_arrivals
   Parameters:
     area: "penang"
     stopId: "<stop_id_from_search>"
   ```
   Expected: Returns upcoming bus arrivals

## Installation

```bash
npm install
```

## Configuration

### Environment Variables

The MCP server uses environment variables for configuration. When deployed to Smithery, set these in the deployment settings:

- **`MIDDLEWARE_URL`** (required): Malaysia Transit Middleware API URL
  - Local: `http://localhost:3000`
  - Production: Your deployed middleware URL (e.g., `https://malaysiatransit.techmavie.digital`)

- **`GOOGLE_MAPS_API_KEY`** (optional): Google Maps API key for location detection
  - If not provided, falls back to Nominatim (free but less accurate)
  - Get your API key from [Google Cloud Console](https://console.cloud.google.com/)

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
Find stops near a location.

**Parameters:**
- `area` (string): Service area ID
- `lat` (number): Latitude coordinate
- `lon` (number): Longitude coordinate
- `radius` (number, optional): Search radius in meters (default: 500)

### Route Information

#### `list_routes`
List all routes in an area.

**Parameters:**
- `area` (string): Service area ID

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

### System Tools

#### `get_system_health`
Check the health status of the Malaysia Transit middleware service.

**Parameters:** None

#### `get_debug_info`
Get comprehensive debug information about the middleware service.

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
| `klang-valley` | Klang Valley | Rapid Rail KL, Rapid Bus KL, MRT Feeder | Bus, Rail | ❌ |
| `penang` | Penang | Rapid Penang | Bus | ✅ |
| `kuantan` | Kuantan | Rapid Kuantan | Bus | ❌ |
| `ipoh` | Ipoh | BAS.MY Ipoh | Bus | ✅ |
| `seremban` | Seremban | BAS.MY Seremban | Bus | ✅ |
| `kangar` | Kangar | BAS.MY Kangar | Bus | ✅ |
| `alor-setar` | Alor Setar | BAS.MY Alor Setar | Bus | ✅ |
| `kota-bharu` | Kota Bharu | BAS.MY Kota Bharu | Bus | ✅ |
| `kuala-terengganu` | Kuala Terengganu | BAS.MY Kuala Terengganu | Bus | ✅ |
| `melaka` | Melaka | BAS.MY Melaka | Bus | ✅ |
| `johor` | Johor Bahru | BAS.MY Johor Bahru | Bus | ✅ |
| `kuching` | Kuching | BAS.MY Kuching | Bus | ✅ |

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

### Deploy to Smithery

This MCP is designed to be deployed to Smithery:

1. **Push to GitHub:**
   ```bash
   git push origin main
   ```

2. **Smithery will auto-deploy** from your GitHub repository

3. **Configure Environment Variables in Smithery:**
   - Go to Settings → Environment
   - Add `MIDDLEWARE_URL`: Your deployed middleware URL
   - Add `GOOGLE_MAPS_API_KEY`: Your Google Maps API key (optional)

### Environment Configuration

Set these environment variables in Smithery deployment settings:

```
MIDDLEWARE_URL=https://malaysiatransit.techmavie.digital
GOOGLE_MAPS_API_KEY=your_api_key_here
```

## Troubleshooting

### Connection Issues

If you can't connect to the middleware:

1. Verify your `MIDDLEWARE_URL` is correct
2. Ensure the middleware is running and accessible
3. Check network connectivity
4. Test middleware directly: `curl https://your-middleware-url/api/areas`

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
│   ├── transit.tools.ts      # Transit tool implementations
│   ├── geocoding.utils.ts    # Location detection utilities
│   ├── inspector.ts          # MCP Inspector entry point
│   └── server.ts             # HTTP server for testing
├── package.json              # Project dependencies
├── tsconfig.json             # TypeScript configuration
├── smithery.yaml             # Smithery configuration
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
- [Smithery](https://smithery.ai/) for the MCP framework
- [Google Maps Platform](https://developers.google.com/maps) for geocoding services
- [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/) for fallback geocoding

---

Made with ❤️ by [Aliff](https://mynameisaliff.co.uk/)
