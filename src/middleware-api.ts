/**
 * Calling the Malaysia Transit middleware: its URL and the headers that
 * identify this MCP server (X-App-Name, for analytics) and let it past the API
 * key check (X-Internal-Auth, which must match the middleware's
 * INTERNAL_APP_AUTH_TOKEN).
 */
import { AxiosRequestConfig } from 'axios';

export const getMcpClientHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'X-App-Name': 'Malaysia-Transit-MCP',
  };

  const internalAuthToken = process.env.INTERNAL_AUTH_TOKEN;
  if (internalAuthToken) {
    headers['X-Internal-Auth'] = internalAuthToken;
  }

  return headers;
};

export const getMiddlewareUrl = (): string => {
  return (
    process.env.MIDDLEWARE_URL || 'https://malaysiatransit.techmavie.digital'
  );
};

export const createApiConfig = (
  params?: Record<string, any>
): AxiosRequestConfig => {
  return {
    headers: getMcpClientHeaders(),
    params,
    timeout: 15000, // 15 second timeout to prevent hanging requests
  };
};
