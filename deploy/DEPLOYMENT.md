# VPS Deployment Guide for Malaysia Transit MCP

This guide explains how to deploy the Malaysia Transit MCP server on your VPS at `mcp.techmavie.digital/malaysiatransit`.

## Prerequisites

- VPS with Ubuntu/Debian (IP: 202.61.238.12)
- Docker and Docker Compose installed
- Nginx installed
- Domain `mcp.techmavie.digital` pointing to your VPS IP
- SSL certificate (via Certbot/Let's Encrypt)

## Architecture

```
Client (Claude, Cursor, etc.)
    ↓ HTTPS
https://mcp.techmavie.digital/malaysiatransit/mcp
    ↓
Nginx (SSL termination + reverse proxy)
    ↓ HTTP
Docker Container (port 8080)
    ↓
Malaysia Transit Middleware API
```

## Deployment Steps

### 1. SSH into your VPS

```bash
ssh root@202.61.238.12
```

### 2. Create directory for MCP servers

```bash
mkdir -p /opt/mcp-servers/malaysiatransit
cd /opt/mcp-servers/malaysiatransit
```

### 3. Clone the repository

```bash
git clone https://github.com/hithereiamaliff/mcp-malaysiatransit.git .
```

### 4. Build and start the Docker container

```bash
docker-compose up -d --build
```

### 5. Verify the container is running

```bash
docker-compose ps
docker-compose logs -f
```

### 6. Test the health endpoint

```bash
curl http://localhost:8080/health
```

### 7. Set up DNS

Add an A record for `mcp.techmavie.digital` pointing to `202.61.238.12`.

### 8. Set up SSL certificate

```bash
sudo certbot certonly --nginx -d mcp.techmavie.digital
```

### 9. Configure Nginx

```bash
# Copy the nginx config
sudo cp deploy/nginx-mcp.conf /etc/nginx/sites-available/mcp.techmavie.digital

# Enable the site
sudo ln -s /etc/nginx/sites-available/mcp.techmavie.digital /etc/nginx/sites-enabled/

# Test nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### 10. Test the MCP endpoint

```bash
# Test health endpoint through nginx
curl https://mcp.techmavie.digital/malaysiatransit/health

# Test MCP endpoint
curl -X POST https://mcp.techmavie.digital/malaysiatransit/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Client Configuration

### For Claude Desktop / Cursor / Windsurf

Add to your MCP configuration:

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

### For MCP Inspector

```bash
npx @modelcontextprotocol/inspector
# Select "Streamable HTTP"
# Enter URL: https://mcp.techmavie.digital/malaysiatransit/mcp
```

## Management Commands

### View logs

```bash
cd /opt/mcp-servers/malaysiatransit
docker-compose logs -f
```

### Restart the server

```bash
docker-compose restart
```

### Update to latest version

```bash
git pull origin main
docker-compose up -d --build
```

### Stop the server

```bash
docker-compose down
```

## Adding More MCP Servers

To add another MCP server (e.g., `mcp.techmavie.digital/another-mcp`):

1. Create a new directory: `/opt/mcp-servers/another-mcp`
2. Deploy the new MCP server on a different port (e.g., 8081)
3. Add a new location block in the nginx config:

```nginx
location /another-mcp/ {
    proxy_pass http://127.0.0.1:8081/;
    # ... same proxy settings
}
```

4. Reload nginx: `sudo systemctl reload nginx`

## Troubleshooting

### Container not starting

```bash
docker-compose logs mcp-malaysiatransit
```

### Nginx 502 Bad Gateway

- Check if container is running: `docker-compose ps`
- Check container logs: `docker-compose logs`
- Verify port binding: `docker port mcp-malaysiatransit`

### SSL certificate issues

```bash
sudo certbot renew --dry-run
```

### Test MCP connection

```bash
# List tools
curl -X POST https://mcp.techmavie.digital/malaysiatransit/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Call hello tool
curl -X POST https://mcp.techmavie.digital/malaysiatransit/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"hello","arguments":{}}}'
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8080 | HTTP server port |
| `HOST` | 0.0.0.0 | Bind address |
| `MIDDLEWARE_URL` | https://malaysiatransit.techmavie.digital | Malaysia Transit Middleware API |
| `GOOGLE_MAPS_API_KEY` | (optional) | For enhanced geocoding |

## Security Notes

- The MCP server runs behind nginx with SSL
- CORS is configured to allow all origins (required for MCP clients)
- No authentication is required (public transit data)
- Rate limiting can be added at nginx level if needed
