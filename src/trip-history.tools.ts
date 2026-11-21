/**
 * Trip history tools: what buses actually did, from the middleware's
 * /api/history (its lib/tripHistory/, the same data as
 * https://malaysiatransit.techmavie.digital/trip-history.html).
 *
 * Every answer starts with where its rows come from (trip-history.format.ts):
 * recorded live by Malaysia Transit since 21 November 2026, or rebuilt from
 * Khazanah Research Institute's 2025 archive of Rapid KL and MRT feeder
 * positions, which must be said and credited.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import axios from 'axios';
import { createApiConfig, getMiddlewareUrl } from './middleware-api.js';
import {
  preface,
  shapeAround,
  shapeDepartures,
  shapeRun,
  shapeStopArrivals,
  shapeSummary,
  toText,
} from './trip-history.format.js';

/** A past day of a busy area is a few megabytes: more time than the live tools need. */
const HISTORY_TIMEOUT_MS = 30000;

const historyConfig = (params?: Record<string, unknown>) => ({
  ...createApiConfig(params),
  timeout: HISTORY_TIMEOUT_MS,
});

const CLOCK = /^\d{1,2}:[0-5]\d$/;

const area = z
  .string()
  .describe(
    'Service area ID with live bus positions: klang-valley, penang, kota-bharu, kuala-terengganu, alor-setar, kangar, ipoh, seremban, melaka, johor or kuching (get_trip_history_summary lists every service recorded, with its areaId)'
  );
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
  .optional()
  .describe(
    "Malaysian service date, YYYY-MM-DD (default: today). Live recording began on 2026-11-21. Days before it have Rapid KL and MRT feeder buses only (area klang-valley), from KRI's 2025 archive (get_trip_history_summary gives its first and last day)."
  );
const route = z
  .string()
  .optional()
  .describe(
    'Keep one route: its name as riders know it ("T789", "D51", "302") or its routeId'
  );
const from = z
  .string()
  .regex(CLOCK, 'HH:MM')
  .optional()
  .describe('From this time, HH:MM (Malaysian)');
const to = z
  .string()
  .regex(CLOCK, 'HH:MM')
  .optional()
  .describe(
    'Up to this time, HH:MM (Malaysian; after midnight as 24:00 to 27:59, as timetables write it)'
  );
const order = z
  .enum(['latest', 'earliest'])
  .optional()
  .describe(
    'latest first (the default for today) or earliest first (the default for past days)'
  );
const limit = (fallback: number) =>
  z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe(
      `Rows to list (default ${fallback}, up to 200). Counts and per-route figures always cover them all.`
    );

const text = (body: string) => ({
  content: [{ type: 'text' as const, text: body }],
});

const answer = (shaped: Record<string, any>, sources: Iterable<string>) =>
  text(preface(sources) + toText(shaped));

function failed(what: string, error: any) {
  const status = error?.response?.status;
  const message =
    error?.response?.data?.error || error?.message || String(error);
  return {
    content: [
      {
        type: 'text' as const,
        text: toText({ error: what, ...(status ? { status } : {}), message }),
      },
    ],
    isError: true,
  };
}

const sourcesIn = (shaped: Record<string, any>): string[] =>
  Object.keys(shaped.sources || {});

export function registerTripHistoryTools(server: McpServer): void {
  server.tool(
    'get_trip_history_summary',
    "Malaysia Transit's trip history at a glance: what buses actually did, recorded live from their positions since 21 November 2026 for every bus service with a live feed, plus Rapid KL and MRT feeder days from 2025 rebuilt from Khazanah Research Institute's archive (counted apart). Gives all-time counts (recorded live and from the archive, separately), today's trips per service with how punctual departures were against the timetable, buses on the road now, departures per hour and the latest departures. Use it for 'how much has been recorded', 'how punctual are buses today', or to find which areas and days have history.",
    {},
    async () => {
      try {
        const response = await axios.get(
          `${getMiddlewareUrl()}/api/history/summary`,
          historyConfig()
        );
        return answer(shapeSummary(response.data), ['live', 'kri']);
      } catch (error: any) {
        return failed('Failed to fetch the trip history summary', error);
      }
    }
  );

  server.tool(
    'get_trip_departures',
    "Trip history: the departures buses actually made from their route's first stop on one day, in one area. Each row: when the bus left, the route and where it was going, its first and last stop, the vehicle, the timetabled time and minutes late (where the timetable applies), whether it reached its last stop and when, and a runId for get_trip_run. Also counts over all of them: per route, per source and against the timetable. Use for 'did the 7:30 D51 leave on time today', 'how many T789 buses ran yesterday', 'when did the last bus leave'. Today's are live (latest first). Days before 21 November 2026 have Rapid KL and MRT feeder buses only, rebuilt from KRI's archive (source kri): say so and credit it.",
    {
      area,
      date,
      route,
      from,
      to,
      order,
      limit: limit(50),
    },
    async (args) => {
      try {
        const response = await axios.get(
          `${getMiddlewareUrl()}/api/history/departures`,
          historyConfig({
            area: args.area,
            ...(args.date ? { date: args.date } : {}),
          })
        );
        const shaped = shapeDepartures(response.data, {
          ...args,
          limit: args.limit ?? 50,
        });
        return answer(shaped, sourcesIn(shaped));
      } catch (error: any) {
        return failed(
          `Failed to fetch trip departures for ${args.area}`,
          error
        );
      }
    }
  );

  server.tool(
    'get_stop_trip_history',
    "Trip history at one stop: the buses that actually came to it on one day. Each row: the time the bus reached the stop (or left it, where its trip starts there), the route and where it was going, the vehicle, the timetabled time and minutes late (where the timetable applies), and a runId for get_trip_run. Per route and way: how many came, the first and last, and the usual gap between them (how often they came). Get the stopId from search_stops or find_nearby_stops. Days before 21 November 2026 have Rapid KL and MRT feeder stops only, from KRI's archive (source kri): say so and credit it.",
    {
      area,
      stopId: z
        .string()
        .describe('Stop ID from search_stops or find_nearby_stops'),
      date,
      route,
      from,
      to,
      order,
      limit: limit(60),
    },
    async (args) => {
      try {
        const response = await axios.get(
          `${getMiddlewareUrl()}/api/history/stops/${encodeURIComponent(args.stopId)}`,
          historyConfig({
            area: args.area,
            ...(args.date ? { date: args.date } : {}),
          })
        );
        const shaped = shapeStopArrivals(response.data, {
          ...args,
          limit: args.limit ?? 60,
        });
        return answer(shaped, sourcesIn(shaped));
      } catch (error: any) {
        return failed(
          `Failed to fetch the trip history of stop ${args.stopId}`,
          error
        );
      }
    }
  );

  server.tool(
    'get_stop_history_around_time',
    "Trip history: what usually happens at a stop around a time of day. The buses that came within a window (default 30 minutes either side) of that time on past days: by default the same weekday over the last 4 weeks, or every day. Per day the buses with their times and minutes late; per route and way how many came, on how many days, and their median delay. Use for 'is the 7:30 bus usually late on Mondays', 'how many buses come around 8 am'. Live recording began on 21 November 2026, so past days fill in day by day. For Rapid KL and MRT feeder stops there are also 2025 days from KRI's archive (set until to a date then): say so and credit it.",
    {
      area,
      stopId: z
        .string()
        .describe('Stop ID from search_stops or find_nearby_stops'),
      time: z
        .string()
        .regex(CLOCK, 'HH:MM')
        .describe('Time of day, HH:MM (Malaysian), e.g. "07:30"'),
      weekday: z
        .enum(['same', 'all'])
        .optional()
        .describe(
          'same: only the weekday of `until` (default); all: every day'
        ),
      days: z.coerce
        .number()
        .int()
        .min(1)
        .max(56)
        .optional()
        .describe(
          'How many days back to look (default 28, up to 56; with weekday same, 28 days is 4 of that weekday)'
        ),
      window: z.coerce
        .number()
        .int()
        .min(5)
        .max(120)
        .optional()
        .describe('Minutes either side of the time (default 30)'),
      until: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
        .optional()
        .describe(
          "Look at the days before this date, YYYY-MM-DD (default: today). With weekday same, its weekday is the one matched: e.g. a Monday's date for Mondays."
        ),
      route,
    },
    async (args) => {
      try {
        const response = await axios.get(
          `${getMiddlewareUrl()}/api/history/stops/${encodeURIComponent(args.stopId)}/around`,
          historyConfig({
            area: args.area,
            time: args.time,
            ...(args.weekday ? { weekday: args.weekday } : {}),
            ...(args.days ? { days: args.days } : {}),
            ...(args.window ? { window: args.window } : {}),
            ...(args.until ? { until: args.until } : {}),
          })
        );
        const shaped = shapeAround(response.data, { route: args.route });
        return answer(shaped, sourcesIn(shaped));
      } catch (error: any) {
        return failed(
          `Failed to fetch the trip history of stop ${args.stopId} around ${args.time}`,
          error
        );
      }
    }
  );

  server.tool(
    'get_trip_run',
    "Trip history: one bus's trip stop by stop. When it was waiting at its first stop, when it left, and when it reached each stop, against the timetable where it applies, with how long the trip took. The runId comes from get_trip_departures, get_stop_trip_history, get_stop_history_around_time or get_trip_history_summary.",
    {
      runId: z
        .string()
        .describe(
          'runId from another trip history tool (provider|trip|date|vehicle)'
        ),
    },
    async ({ runId }) => {
      try {
        const response = await axios.get(
          `${getMiddlewareUrl()}/api/history/runs/${encodeURIComponent(runId)}`,
          historyConfig()
        );
        const shaped = shapeRun(response.data);
        return answer(shaped, sourcesIn(shaped));
      } catch (error: any) {
        return failed(`Failed to fetch run ${runId}`, error);
      }
    }
  );
}
