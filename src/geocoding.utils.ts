/**
 * Geocoding utilities using the Malaysia Transit Middleware's geocoding endpoint
 * The middleware has Google Maps API configured, so we delegate geocoding to it
 * Falls back to Nominatim if middleware geocoding fails
 */

import axios from 'axios';

// Get middleware URL from environment
const getMiddlewareUrl = (): string => {
  return process.env.MIDDLEWARE_URL || 'https://malaysiatransit.techmavie.digital';
};

// Nominatim API endpoint (fallback)
const NOMINATIM_API = 'https://nominatim.openstreetmap.org';

// User agent for Nominatim (required by usage policy)
const USER_AGENT = 'MalaysiaTransitMCP/1.0';

// MCP Client Identification Header
const MCP_CLIENT_HEADERS = {
  'X-App-Name': 'Malaysia-Transit-MCP',
};

// Mapping of Malaysian states/regions to transit service areas
const STATE_TO_AREA_MAP: Record<string, string> = {
  // Kedah
  'kedah': 'alor-setar',
  'alor setar': 'alor-setar',
  'alor star': 'alor-setar',
  
  // Perlis
  'perlis': 'kangar',
  'kangar': 'kangar',
  
  // Penang
  'penang': 'penang',
  'pulau pinang': 'penang',
  'george town': 'penang',
  'georgetown': 'penang',
  'butterworth': 'penang',
  'bayan lepas': 'penang',
  
  // Perak (Ipoh)
  'perak': 'ipoh',
  'ipoh': 'ipoh',
  'bercham': 'ipoh',
  'tanjung rambutan': 'ipoh',
  'medan kidd': 'ipoh',
  
  // Kelantan
  'kelantan': 'kota-bharu',
  'kota bharu': 'kota-bharu',
  'kota bahru': 'kota-bharu',
  
  // Terengganu
  'terengganu': 'kuala-terengganu',
  'kuala terengganu': 'kuala-terengganu',
  
  // Pahang
  'pahang': 'kuantan',
  'kuantan': 'kuantan',
  
  // Negeri Sembilan (Seremban)
  'negeri sembilan': 'seremban',
  'seremban': 'seremban',
  'nilai': 'seremban',
  'port dickson': 'seremban',
  
  // Selangor / KL / Putrajaya (Klang Valley)
  'selangor': 'klang-valley',
  'kuala lumpur': 'klang-valley',
  'kl': 'klang-valley',
  'putrajaya': 'klang-valley',
  'petaling jaya': 'klang-valley',
  'shah alam': 'klang-valley',
  'klang': 'klang-valley',
  'subang jaya': 'klang-valley',
  'cyberjaya': 'klang-valley',
  'ampang': 'klang-valley',
  'cheras': 'klang-valley',
  'kajang': 'klang-valley',
  'bangi': 'klang-valley',
  'rawang': 'klang-valley',
  'gombak': 'klang-valley',
  
  // Melaka
  'melaka': 'melaka',
  'malacca': 'melaka',
  
  // Johor
  'johor': 'johor',
  'johor bahru': 'johor',
  'johor baharu': 'johor',
  'jb': 'johor',
  'iskandar puteri': 'johor',
  
  // Sarawak
  'sarawak': 'kuching',
  'kuching': 'kuching',
};

// City/location to area direct mapping (for common queries)
const LOCATION_TO_AREA_MAP: Record<string, string> = {
  // Penang
  'komtar': 'penang',
  'bayan lepas': 'penang',
  'butterworth': 'penang',
  'penang sentral': 'penang',
  'gurney': 'penang',
  'queensbay': 'penang',
  
  // Klang Valley
  'klcc': 'klang-valley',
  'klia': 'klang-valley',
  'klia2': 'klang-valley',
  'mid valley': 'klang-valley',
  'pavilion': 'klang-valley',
  'sunway': 'klang-valley',
  '1 utama': 'klang-valley',
  'kl sentral': 'klang-valley',
  'bukit bintang': 'klang-valley',
  'bangsar': 'klang-valley',
  'mont kiara': 'klang-valley',
  'ioi city': 'klang-valley',
  'tbs': 'klang-valley',
  'terminal bersepadu selatan': 'klang-valley',
  
  // Ipoh
  'medan kidd': 'ipoh',
  'terminal amanjaya': 'ipoh',
  'ipoh parade': 'ipoh',
  
  // Seremban
  'terminal one seremban': 'seremban',
  'seremban 2': 'seremban',
  
  // Melaka
  'melaka sentral': 'melaka',
  'jonker street': 'melaka',
  'a famosa': 'melaka',
  
  // Johor
  'jb sentral': 'johor',
  'larkin': 'johor',
  'legoland': 'johor',
  
  // Kuching
  'kuching sentral': 'kuching',
};

export interface GeocodingResult {
  area: string;
  confidence: 'high' | 'medium' | 'low';
  location: {
    name: string;
    state?: string;
    country?: string;
    lat: number;
    lon: number;
  };
  source: 'direct_match' | 'state_mapping' | 'geocoding';
}

/**
 * Detect the transit service area from a location query
 * IMPORTANT: This function now ALWAYS attempts to geocode to get real coordinates,
 * even when the area is detected via direct_match or state_mapping.
 * This ensures AI models can use the coordinates for nearby stop searches.
 */
export async function detectAreaFromLocation(query: string): Promise<GeocodingResult | null> {
  const normalizedQuery = query.toLowerCase().trim();
  
  let detectedArea: string | null = null;
  let detectedState: string | null = null;
  let matchSource: 'direct_match' | 'state_mapping' | 'geocoding' = 'geocoding';
  
  // 1. Check direct location mapping first (fastest for area detection)
  for (const [location, area] of Object.entries(LOCATION_TO_AREA_MAP)) {
    if (normalizedQuery.includes(location)) {
      detectedArea = area;
      matchSource = 'direct_match';
      break;
    }
  }
  
  // 2. Check state mapping if no direct match
  if (!detectedArea) {
    for (const [state, area] of Object.entries(STATE_TO_AREA_MAP)) {
      if (normalizedQuery.includes(state)) {
        detectedArea = area;
        detectedState = state;
        matchSource = 'state_mapping';
        break;
      }
    }
  }
  
  // 3. ALWAYS try to geocode to get real coordinates
  // This is critical for AI models that need coordinates for nearby stop searches
  try {
    const geocodingResult = await geocodeLocation(query);
    if (geocodingResult) {
      // If we already detected an area via mapping, use that area but with geocoded coordinates
      if (detectedArea) {
        return {
          area: detectedArea,
          confidence: 'high',
          location: geocodingResult.location,
          source: matchSource,
        };
      }
      // If geocoding returned an area (even 'unknown'), use the geocoded coordinates
      // but try to use the geocoding result's area if it's valid
      if (geocodingResult.area && geocodingResult.area !== 'unknown') {
        return geocodingResult;
      }
      // Geocoding worked but couldn't determine area - still return with coordinates
      // so AI can use find_nearby_stops_with_arrivals with the coordinates
      return {
        area: geocodingResult.area || 'unknown',
        confidence: 'low',
        location: geocodingResult.location,
        source: 'geocoding',
      };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  
  // 4. If geocoding failed but we have an area from mapping, return with zero coordinates
  // (AI should use the 'location' parameter in nearby tools instead of coordinates)
  if (detectedArea) {
    return {
      area: detectedArea,
      confidence: 'medium', // Lower confidence since we couldn't geocode
      location: {
        name: query,
        state: detectedState || undefined,
        lat: 0,
        lon: 0,
      },
      source: matchSource,
    };
  }
  
  return null;
}

/**
 * Geocode a location using the middleware's /api/geocode endpoint (primary) or Nominatim (fallback)
 * The middleware has Google Maps API configured, so we delegate geocoding to it
 */
async function geocodeLocation(query: string): Promise<GeocodingResult | null> {
  // Try middleware geocoding first (uses Google Maps API)
  try {
    const result = await geocodeWithMiddleware(query);
    if (result) return result;
  } catch (error: any) {
    console.error('Middleware geocoding failed, falling back to Nominatim:', error.message);
  }
  
  // Fallback to Nominatim
  return await geocodeWithNominatim(query);
}

/**
 * Geocode using the Malaysia Transit Middleware's /api/geocode endpoint
 * This endpoint uses Google Maps API which is already configured on the middleware
 */
async function geocodeWithMiddleware(query: string): Promise<GeocodingResult | null> {
  try {
    const response = await axios.get(`${getMiddlewareUrl()}/api/geocode`, {
      params: {
        place: query,
      },
      headers: MCP_CLIENT_HEADERS,
      timeout: 10000,
    });
    
    if (response.data && response.data.lat && response.data.lon) {
      const result = response.data;
      
      // Extract state from formatted address for area mapping
      const formattedAddress = (result.formattedAddress || '').toLowerCase();
      let area: string | null = null;
      let state = '';
      
      // Try to map from formatted address to area
      for (const [key, value] of Object.entries(STATE_TO_AREA_MAP)) {
        if (formattedAddress.includes(key)) {
          area = value;
          state = key;
          break;
        }
      }
      
      if (area) {
        return {
          area,
          confidence: 'high', // Middleware uses Google Maps which is accurate
          location: {
            name: result.formattedAddress || query,
            state: state,
            country: 'Malaysia',
            lat: result.lat,
            lon: result.lon,
          },
          source: 'geocoding',
        };
      }
      
      // Even if we can't determine the area, return the coordinates
      // The caller can still use these coordinates for nearby searches
      return {
        area: 'unknown',
        confidence: 'low',
        location: {
          name: result.formattedAddress || query,
          country: 'Malaysia',
          lat: result.lat,
          lon: result.lon,
        },
        source: 'geocoding',
      };
    }
  } catch (error: any) {
    console.error('Middleware geocoding error:', error.message);
    throw error;
  }
  
  return null;
}

/**
 * Geocode using Nominatim API (fallback)
 */
async function geocodeWithNominatim(query: string): Promise<GeocodingResult | null> {
  try {
    // Add "Malaysia" to the query if not already present
    const searchQuery = query.toLowerCase().includes('malaysia') 
      ? query 
      : `${query}, Malaysia`;
    
    const response = await axios.get(`${NOMINATIM_API}/search`, {
      params: {
        q: searchQuery,
        format: 'json',
        addressdetails: 1,
        limit: 1,
        countrycodes: 'my', // Restrict to Malaysia
      },
      headers: {
        'User-Agent': USER_AGENT,
      },
      timeout: 5000,
    });
    
    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      const address = result.address || {};
      
      // Extract state information
      const state = address.state?.toLowerCase() || '';
      const city = address.city?.toLowerCase() || address.town?.toLowerCase() || '';
      
      // Try to map state to area
      let area = STATE_TO_AREA_MAP[state];
      
      // If no state match, try city
      if (!area && city) {
        area = STATE_TO_AREA_MAP[city];
      }
      
      if (area) {
        return {
          area,
          confidence: 'medium',
          location: {
            name: result.display_name,
            state: address.state,
            country: address.country,
            lat: parseFloat(result.lat),
            lon: parseFloat(result.lon),
          },
          source: 'geocoding',
        };
      }
    }
  } catch (error: any) {
    console.error('Nominatim geocoding failed:', error.message);
  }
  
  return null;
}

/**
 * Get all available service areas with their states
 */
export function getAreaStateMapping(): Record<string, string[]> {
  return {
    'alor-setar': ['Kedah'],
    'kangar': ['Perlis'],
    'penang': ['Penang', 'Pulau Pinang'],
    'ipoh': ['Perak'],
    'kota-bharu': ['Kelantan'],
    'kuala-terengganu': ['Terengganu'],
    'kuantan': ['Pahang'],
    'seremban': ['Negeri Sembilan'],
    'klang-valley': ['Selangor', 'Kuala Lumpur', 'Putrajaya'],
    'melaka': ['Melaka', 'Malacca'],
    'johor': ['Johor'],
    'kuching': ['Sarawak'],
  };
}
