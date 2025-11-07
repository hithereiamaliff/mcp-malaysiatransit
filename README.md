# Malaysia Transit MCP

[![smithery badge](https://smithery.ai/badge/@hithereiamaliff/mcp-malaysiatransit)](https://smithery.ai/server/@hithereiamaliff/mcp-malaysiatransit)

MCP (Model Context Protocol) server for Malaysia's public transit system, providing real-time bus and train information across 10+ cities in Malaysia.

**Data Source:** [Malaysia Transit Middleware](https://github.com/hithereiamaliff/malaysiatransit-middleware)

## Features

- **10 Operational Service Areas** across Malaysia
  - Klang Valley (Rapid Rail KL, Rapid Bus KL, MRT Feeder)
  - Penang (Rapid Penang)
  - Kuantan (Rapid Kuantan)
  - Kangar, Alor Setar, Kota Bharu, Kuala Terengganu, Melaka, Johor, Kuching (BAS.MY)
- **Real-time Vehicle Tracking** - Live positions of buses and trains
- **Stop Search & Information** - Find stops by name or location
- **Route Discovery** - Browse available routes with destinations
- **Arrival Predictions** - Get real-time arrival times at stops
- **Multi-Modal Support** - Both bus and rail services
- **Provider Status Monitoring** - Check operational status of transit providers

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

## Documentation

- **[TOOLS.md](./TOOLS.md)** - Detailed information about available tools
- **[PROMPT.md](./PROMPT.md)** - AI integration guidelines and usage patterns

## Installation

```bash
npm install
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Malaysia Transit Middleware API URL
MIDDLEWARE_URL=http://localhost:3000
```

For production, set this to your deployed middleware URL (e.g., `https://your-middleware.onrender.com`).

## Development

To run the MCP server in development mode with Smithery playground:

```bash
npm run dev
```

This will start the Smithery CLI in development mode, allowing you to test the MCP server locally before deployment.

## Build

To build the MCP server for deployment:

```bash
npm run build
```

## Deployment to Smithery

This MCP is designed to be deployed to Smithery. Follow these steps:

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Deploy to Smithery:**
   ```bash
   npm run deploy
   ```

3. **Configure in Smithery:**
   - Set `middlewareUrl` to your Malaysia Transit Middleware API URL
   - Default: `http://localhost:3000` (for local testing)
   - Production: Your deployed middleware URL

## Available Tools

### Service Area Discovery

- **`list_service_areas`** - List all available transit areas in Malaysia
- **`get_area_info`** - Get detailed information about a specific area

### Stop Information

- **`search_stops`** - Search for stops by name
- **`get_stop_details`** - Get detailed information about a stop
- **`get_stop_arrivals`** - Get real-time arrival predictions ⭐
- **`find_nearby_stops`** - Find stops near a location (lat/lon)

### Route Information

- **`list_routes`** - List all routes in an area
- **`get_route_details`** - Get detailed route information
- **`get_route_geometry`** - Get route path for map visualization

### Real-time Data

- **`get_live_vehicles`** - Get real-time vehicle positions ⭐
- **`get_provider_status`** - Check provider operational status

### Testing

- **`hello`** - Simple test tool to verify server is working

## Usage Examples

### Find When Your Bus is Coming

```typescript
// 1. Search for your stop
const stops = await tools.search_stops({
  area: "penang",
  query: "Komtar"
});

// 2. Get real-time arrivals
const arrivals = await tools.get_stop_arrivals({
  area: "penang",
  stopId: stops[0].id
});
// Returns: "Bus T101 arrives in 5 minutes, Bus T201 in 12 minutes"
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

## AI Integration

When integrating with AI assistants:

1. **Always start with `list_service_areas`** to discover available areas
2. **Use `search_stops`** to find stops by name
3. **Use `get_stop_arrivals`** for the key use case: "When is my bus coming?"
4. **Use `get_live_vehicles`** to track buses/trains in real-time
5. **All tools require an `area` parameter** (e.g., 'penang', 'klang-valley')

Refer to [PROMPT.md](./PROMPT.md) for comprehensive AI integration guidelines.

## Supported Service Areas

| Area ID | Name | Providers | Transit Types |
|---------|------|-----------|---------------|
| `klang-valley` | Klang Valley | Rapid Rail KL, Rapid Bus KL, MRT Feeder | Bus, Rail |
| `penang` | Penang | Rapid Penang | Bus |
| `kuantan` | Kuantan | Rapid Kuantan | Bus |
| `kangar` | Kangar | BAS.MY Kangar | Bus |
| `alor-setar` | Alor Setar | BAS.MY Alor Setar | Bus |
| `kota-bharu` | Kota Bharu | BAS.MY Kota Bharu | Bus |
| `kuala-terengganu` | Kuala Terengganu | BAS.MY Kuala Terengganu | Bus |
| `melaka` | Melaka | BAS.MY Melaka | Bus |
| `johor` | Johor Bahru | BAS.MY Johor Bahru | Bus |
| `kuching` | Kuching | BAS.MY Kuching | Bus |

## Local Testing

To test locally before deploying:

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Then test in the Smithery playground interface that opens in your browser.

## Project Structure

```
malaysiatransit-mcp/
├── src/
│   ├── index.ts           # Main MCP server entry point
│   └── transit.tools.ts   # Transit tool implementations
├── package.json           # Project dependencies
├── tsconfig.json          # TypeScript configuration
├── smithery.yaml          # Smithery configuration
├── README.md              # This file
├── TOOLS.md               # Detailed tool documentation
├── PROMPT.md              # AI integration guide
└── LICENSE                # MIT License
```

## Troubleshooting

### Connection Issues

If you can't connect to the middleware:

1. Verify your `MIDDLEWARE_URL` is correct
2. Ensure the middleware is running and accessible
3. Check network connectivity

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

## Requirements

- **Node.js**: >= 18.0.0
- **Malaysia Transit Middleware**: Running instance (local or deployed)

## Related Projects

- **[Malaysia Transit Middleware](https://github.com/hithereiamaliff/malaysiatransit-middleware)** - The backend API this MCP connects to
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

---

Made with ❤️ by [Aliff](https://mynameisaliff.co.uk/)