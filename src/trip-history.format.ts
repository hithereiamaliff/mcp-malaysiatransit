/**
 * Trip history answers, trimmed for an AI to read: the middleware's
 * /api/history rows (its lib/tripHistory/query.js) with what matters kept,
 * counts worked out, and where each row comes from spelled out.
 *
 * Two sources, which answers must keep apart:
 * - live (and study): recorded live by Malaysia Transit from the buses'
 *   positions, since 21 November 2026;
 * - kri: rebuilt from Khazanah Research Institute's archive of Rapid KL and
 *   MRT feeder positions (2025), for the days before that.
 */

type Row = Record<string, any>;

export const TRIP_HISTORY_PAGE =
  'https://malaysiatransit.techmavie.digital/trip-history.html';

export const KRI_CREDIT =
  'Gregory Ho Wai Son and Kelvin Ling Shyan Seng, "Greater Kuala Lumpur Mobilities", Khazanah Research Institute (2025), CC BY 3.0, https://www.krinstitute.org/publications/gklmob';

/** What each source means. */
export const SOURCE_NOTES: Record<string, string> = {
  live: "Recorded live by Malaysia Transit from the buses' own positions (data.gov.my GTFS Realtime, CC BY 4.0), since 21 November 2026.",
  study:
    'Recorded live by Malaysia Transit: positions it logged for its arrival-time study on 21 November 2026, 16:20 to 18:40, before the recorder started. Counts as recorded live.',
  kri: `NOT recorded by Malaysia Transit: rebuilt by Malaysia Transit from Khazanah Research Institute's archive of Rapid KL and MRT feeder bus positions (2025, every 15 s from 5:00 to 22:00), placed on today's routes, without timetabled times (so no delays). Credit: ${KRI_CREDIT}.`,
};

export const STATUS_NOTE =
  'status: complete (reached its last stop), partial (last seen before its last stop), running (on its way now).';

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** What to tell the AI before the data: where the rows come from, and how to credit them. */
export function preface(sources: Iterable<string>): string {
  const present = new Set(sources);
  const lines = [
    'TRIP HISTORY: what buses actually did, worked out by Malaysia Transit from where the buses were. Times are Malaysian (UTC+8).',
    'Every row has a "source". Keep what was recorded live apart from the archive in your answer:',
    '- live, study: recorded live by Malaysia Transit (since 21 November 2026).',
  ];
  if (present.has('kri')) {
    lines.push(
      `- kri: NOT recorded live by Malaysia Transit. Rebuilt from Khazanah Research Institute's 2025 archive of Rapid KL and MRT feeder positions, without timetabled times. Say so whenever you use these rows, and credit ${KRI_CREDIT}.`
    );
  }
  lines.push(
    "\"delayMinutes\" is against the trip's own timetable (negative: early). It's null where that timetable doesn't apply (see notes): never present a null as on time.",
    `The website shows the same: ${TRIP_HISTORY_PAGE}`
  );
  return `${lines.join('\n')}\n\n`;
}

/** Today's date in Malaysia. */
export function malaysianToday(now = Date.now()): string {
  return new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** "HH:MM:SS" from an ISO time with its +08:00 offset. */
const clock = (iso: string | null | undefined): string | null =>
  iso ? iso.slice(11, 19) : null;

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function median(values: number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : round1((sorted[mid - 1] + sorted[mid]) / 2);
}

/** "HH:MM" to minutes (up to 27:59: past midnight, as timetables write the small hours), or null. */
export function parseClock(value?: string | null): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(value.trim());
  if (!m || Number(m[1]) > 27) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

const formatClock = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Minutes from the service date's midnight (Malaysian): past 24:00 for its trips after midnight. */
export function serviceMinutes(iso: string, date: string): number {
  return (Date.parse(iso) - Date.parse(`${date}T00:00:00+08:00`)) / 60000;
}

/** Whether a time falls between from and to (minutes of the service day; to takes in its whole minute). */
export function inWindow(
  iso: string | null | undefined,
  date: string,
  from: number | null,
  to: number | null
): boolean {
  if (from === null && to === null) return true;
  if (!iso) return false;
  const m = serviceMinutes(iso, date);
  return (from === null || m >= from) && (to === null || m < to + 1);
}

/** A route given as its id or as its name ("T789", "D51"). */
export function matchesRoute(row: Row, route?: string | null): boolean {
  if (!route) return true;
  const want = route.trim().toLowerCase();
  return (
    String(row.routeId ?? '').toLowerCase() === want ||
    String(row.route ?? '').toLowerCase() === want
  );
}

export function countBy(rows: Row[], key: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const value = String(row[key] ?? 'unknown');
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

/** Against the timetable, where it applies: how many, the median, and how many early, on time and late. */
export function timeliness(rows: Row[]): Row | null {
  const delays = rows
    .map((r) => r.delayMinutes)
    .filter((v): v is number => typeof v === 'number');
  if (!delays.length) return null;
  return {
    compared: delays.length,
    medianDelayMinutes: median(delays),
    moreThanOneMinuteEarly: delays.filter((d) => d < -1).length,
    withinOneEarlyFiveLate: delays.filter((d) => d >= -1 && d <= 5).length,
    moreThanFiveMinutesLate: delays.filter((d) => d > 5).length,
  };
}

/** The API's notes (timetables that don't apply, matched trips, KRI's archive) and how to read status. */
export function notesOf(data: Row): string[] {
  return [
    data.timetableNote,
    data.matchNote,
    data.archiveNote,
    STATUS_NOTE,
  ].filter(Boolean);
}

/** What each source in these rows means. */
export function sourcesOf(rows: Row[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const source = row.source || 'live';
    if (!out[source]) out[source] = SOURCE_NOTES[source] || SOURCE_NOTES.live;
  }
  return out;
}

/** A trip its timetable doesn't have, placed by pattern or route (KRI's are all placed so: their note says it). */
const tripMatch = (row: Row): Row =>
  row.tripMatch && row.source !== 'kri' ? { tripMatch: row.tripMatch } : {};
const approximate = (row: Row): Row =>
  row.approximate ? { approximate: true } : {};

export function departureRow(d: Row): Row {
  return {
    time: d.time,
    route: d.route,
    headsign: d.headsign,
    from: d.firstStopName ?? d.firstStopId,
    to: d.lastStopName ?? d.lastStopId,
    vehicle: d.vehicle,
    scheduled: d.scheduled,
    delayMinutes: d.delayMinutes,
    status: d.status,
    reachedLastStopAt: clock(d.lastStopArrivedAt),
    stopsTimed: d.stopsTimed,
    stops: d.stops,
    source: d.source,
    ...tripMatch(d),
    routeId: d.routeId,
    runId: d.runId,
  };
}

/** Departures per route (id and name), most first. */
function departuresPerRoute(
  rows: Row[],
  max = 20
): { routes: Row[]; more: number } {
  const byRoute = new Map<string, Row>();
  for (const r of rows) {
    const key = `${r.provider}|${r.routeId}`;
    const entry = byRoute.get(key) || {
      route: r.route,
      routeId: r.routeId,
      departures: 0,
      delays: [] as number[],
    };
    entry.departures += 1;
    if (typeof r.delayMinutes === 'number') entry.delays.push(r.delayMinutes);
    byRoute.set(key, entry);
  }
  const all = [...byRoute.values()]
    .sort((a, b) => b.departures - a.departures)
    .map(({ delays, ...entry }) => ({
      ...entry,
      ...(delays.length ? { medianDelayMinutes: median(delays) } : {}),
    }));
  return { routes: all.slice(0, max), more: Math.max(0, all.length - max) };
}

export interface ListOptions {
  route?: string | null;
  from?: string | null;
  to?: string | null;
  limit: number;
  order?: 'latest' | 'earliest';
  now?: number;
}

function windowOf(options: ListOptions): Row | null {
  if (!options.from && !options.to) return null;
  return { from: options.from ?? null, to: options.to ?? null };
}

/** /api/history/departures, trimmed: the departures asked for, with counts over all of them. */
export function shapeDepartures(data: Row, options: ListOptions): Row {
  const date = String(data.date);
  const from = parseClock(options.from);
  const to = parseClock(options.to);
  const rows = (data.departures as Row[]).filter(
    (d) =>
      matchesRoute(d, options.route) && inWindow(d.departedAt, date, from, to)
  );
  const order =
    options.order ??
    (date === malaysianToday(options.now) ? 'latest' : 'earliest');
  const ordered = order === 'latest' ? [...rows].reverse() : rows;
  const shown = ordered.slice(0, options.limit).map(departureRow);
  const perRoute = options.route ? null : departuresPerRoute(rows);
  return {
    date,
    area: data.area,
    route: options.route || null,
    window: windowOf(options),
    departures: rows.length,
    firstDeparture: rows[0]?.time ?? null,
    lastDeparture: rows[rows.length - 1]?.time ?? null,
    bySource: countBy(rows, 'source'),
    byStatus: countBy(rows, 'status'),
    vsTimetable: timeliness(rows),
    ...(perRoute
      ? {
          perRoute: perRoute.routes,
          ...(perRoute.more ? { morePerRoute: perRoute.more } : {}),
        }
      : {}),
    order: order === 'latest' ? 'latest first' : 'earliest first',
    shown: shown.length,
    ...(rows.length > shown.length
      ? {
          notShown: rows.length - shown.length,
          toSeeMore:
            'Narrow with route or from/to, or raise limit (up to 200).',
        }
      : {}),
    rows: shown,
    notes: notesOf(data),
    sources: sourcesOf(rows),
    attribution: data.attribution,
  };
}

export function stopRow(a: Row): Row {
  return {
    time: a.time,
    kind: a.kind,
    route: a.route,
    headsign: a.headsign,
    vehicle: a.vehicle,
    scheduled: a.scheduled,
    delayMinutes: a.delayMinutes,
    ...approximate(a),
    status: a.status,
    source: a.source,
    ...tripMatch(a),
    routeId: a.routeId,
    runId: a.runId,
  };
}

/** Per route and way at a stop: how many buses came, the first and last, the usual gap between them. */
function busesPerRoute(rows: Row[]): Row[] {
  const byRoute = new Map<string, Row[]>();
  for (const r of rows) {
    const key = `${r.provider}|${r.routeId}|${r.headsign ?? ''}`;
    if (!byRoute.has(key)) byRoute.set(key, []);
    byRoute.get(key)!.push(r);
  }
  return [...byRoute.values()]
    .map((list) => {
      const times = list
        .map((r) => Date.parse(r.arrivedAt))
        .sort((a, b) => a - b);
      const gaps = times.slice(1).map((t, i) => (t - times[i]) / 60000);
      const delays = list
        .map((r) => r.delayMinutes)
        .filter((v): v is number => typeof v === 'number');
      return {
        route: list[0].route,
        headsign: list[0].headsign,
        routeId: list[0].routeId,
        buses: list.length,
        first: list[0].time,
        last: list[list.length - 1].time,
        medianGapMinutes: gaps.length ? median(gaps.map(round1)) : null,
        ...(delays.length ? { medianDelayMinutes: median(delays) } : {}),
      };
    })
    .sort((a, b) => b.buses - a.buses);
}

/** /api/history/stops/:stopId, trimmed. */
export function shapeStopArrivals(data: Row, options: ListOptions): Row {
  const date = String(data.date);
  const from = parseClock(options.from);
  const to = parseClock(options.to);
  const rows = (data.arrivals as Row[]).filter(
    (a) =>
      matchesRoute(a, options.route) && inWindow(a.arrivedAt, date, from, to)
  );
  const order =
    options.order ??
    (date === malaysianToday(options.now) ? 'latest' : 'earliest');
  const ordered = order === 'latest' ? [...rows].reverse() : rows;
  const shown = ordered.slice(0, options.limit).map(stopRow);
  return {
    date,
    area: data.area,
    stopId: data.stopId,
    route: options.route || null,
    window: windowOf(options),
    buses: rows.length,
    firstBus: rows[0]?.time ?? null,
    lastBus: rows[rows.length - 1]?.time ?? null,
    bySource: countBy(rows, 'source'),
    vsTimetable: timeliness(rows),
    perRoute: busesPerRoute(rows),
    order: order === 'latest' ? 'latest first' : 'earliest first',
    shown: shown.length,
    ...(rows.length > shown.length
      ? {
          notShown: rows.length - shown.length,
          toSeeMore:
            'Narrow with route or from/to, or raise limit (up to 200).',
        }
      : {}),
    rows: shown,
    kinds:
      'kind: departure (the trip starts here: the time it left), arrival, last-stop (the trip ends here).',
    notes: notesOf(data),
    sources: sourcesOf(rows),
    attribution: data.attribution,
  };
}

/** /api/history/stops/:stopId/around, trimmed. */
export function shapeAround(
  data: Row,
  options: { route?: string | null; perDay?: number } = {}
): Row {
  const perDay = options.perDay ?? 40;
  const days: Row[] = (data.days as Row[]).map((day) => ({
    ...day,
    arrivals: (day.arrivals as Row[]).filter((a) =>
      matchesRoute(a, options.route)
    ),
  }));
  const all = days.flatMap((day) => day.arrivals as Row[]);
  const routes = (data.routes as Row[]).filter((r) =>
    matchesRoute(r, options.route)
  );
  const dates = days.map((d) => d.date).sort();
  return {
    stopId: data.stopId,
    time: data.time,
    windowMinutes: data.windowMinutes,
    days:
      data.weekday === 'same'
        ? `the same weekday as ${data.until} (${WEEKDAYS[new Date(`${data.until}T00:00:00Z`).getUTCDay()]}), before it`
        : `every day before ${data.until}`,
    route: options.route || null,
    looked: {
      from: dates[0] ?? null,
      to: dates[dates.length - 1] ?? null,
      days: days.length,
    },
    daysWithBuses: days.filter((d) => d.arrivals.length).length,
    buses: all.length,
    perRoute: routes,
    vsTimetable: timeliness(all),
    bySource: countBy(all, 'source'),
    ...(all.length
      ? {}
      : {
          noBuses:
            "No buses were recorded at this stop around this time on these days. Live recording began on 21 November 2026, so past days fill in day by day. Rapid KL and MRT feeder stops (klang-valley) also have 2025 days from KRI's archive: set until to a date then (get_trip_history_summary gives the archive's first and last day).",
        }),
    byDay: days.map((day) => ({
      date: day.date,
      weekday: WEEKDAYS[day.weekday] ?? day.weekday,
      buses: day.arrivals.length,
      rows: (day.arrivals as Row[]).slice(0, perDay).map((a) => ({
        time: a.time,
        route: a.route,
        headsign: a.headsign,
        vehicle: a.vehicle,
        scheduled: a.scheduled,
        delayMinutes: a.delayMinutes,
        ...approximate(a),
        source: a.source,
        ...tripMatch(a),
        runId: a.runId,
      })),
    })),
    notes: notesOf(data),
    sources: sourcesOf(all),
    attribution: data.attribution,
  };
}

/** /api/history/runs/:runId, trimmed. */
export function shapeRun(data: Row): Row {
  const run = data.run as Row;
  const stops = run.stops as Row[];
  const timed = stops.filter((s) => s.arrivedAt);
  const start = run.departedAt ?? timed[0]?.arrivedAt ?? null;
  const end = timed[timed.length - 1]?.arrivedAt ?? null;
  return {
    route: run.route,
    headsign: run.headsign,
    vehicle: run.vehicle,
    serviceDate: run.serviceDate,
    status: run.status,
    source: run.source,
    ...tripMatch(run),
    waitingAtFirstStopSince: clock(run.waitingSince),
    departedAt: clock(run.departedAt),
    scheduledDeparture: run.scheduledDeparture,
    departureDelayMinutes: run.departureDelayMinutes,
    stopsTimed: timed.length,
    stopCount: stops.length,
    minutesToLastStopTimed:
      start && end && end !== start
        ? round1((Date.parse(end) - Date.parse(start)) / 60000)
        : null,
    vsTimetable: timeliness(stops),
    stops: stops.map((s) => ({
      sequence: s.sequence,
      stop: s.stopName ?? s.stopId,
      stopId: s.stopId,
      scheduled: s.scheduled,
      time: s.time,
      delayMinutes: s.delayMinutes,
      ...approximate(s),
    })),
    stopTimes:
      'time: when the bus reached the stop (null: not seen there; approximate: timed across a gap in its reports of over 5 minutes).',
    routeId: run.routeId,
    tripId: run.tripId,
    provider: run.provider,
    runId: run.runId,
    notes: notesOf(data),
    sources: sourcesOf([run]),
    attribution: data.attribution,
  };
}

const counts = (c: Row | null | undefined): Row | null =>
  c
    ? {
        trips: c.trips,
        departures: c.departures,
        complete: c.complete,
        stopTimes: c.stopTimes,
        positions: c.positions,
        days: c.days,
      }
    : null;

/** /api/history/summary, trimmed. */
export function shapeSummary(
  data: Row,
  { latest = 10 }: { latest?: number } = {}
): Row {
  const byHour: Record<string, number> = {};
  ((data.today?.departuresByHour as number[]) || []).forEach((n, hour) => {
    if (n) byHour[formatClock(hour * 60)] = n;
  });
  return {
    page: TRIP_HISTORY_PAGE,
    generatedAt: data.generatedAt,
    recording: data.recording,
    busesOnTheRoadNow: data.onTheRoad,
    allTime: {
      recordedLive: counts(data.totals?.live),
      fromKriArchive: counts(data.totals?.archive),
      combined: counts(data.totals),
      words:
        'trips: runs with a stop timed; departures: seen leaving their first stop; complete: reached their last stop; stopTimes: times a bus was timed at a stop; positions: bus positions read; days: days with trips.',
    },
    kriArchive: data.archive
      ? {
          firstDay: data.archive.first ?? null,
          lastDay: data.archive.last ?? null,
          days: data.archive.days ?? null,
          importingNow: data.archive.importing ?? null,
          what: SOURCE_NOTES.kri,
        }
      : null,
    today: {
      date: data.today?.date,
      trips: data.today?.trips,
      departures: data.today?.departures,
      complete: data.today?.complete,
      stopTimes: data.today?.stopTimes,
      positions: data.today?.positions,
      departuresByHour: byHour,
      services: ((data.today?.services as Row[]) || []).map((s) => ({
        service: s.name,
        area: s.areaName,
        areaId: s.areaId,
        trips: s.trips,
        departures: s.departures,
        complete: s.complete,
        onTheRoad: s.onTheRoad,
        vsTimetable: s.timetableApplies
          ? s.vsTimetable
          : "not compared: it has a timetable, but its live data doesn't reliably say which departure each bus is running",
      })),
    },
    latestDepartures: ((data.latest as Row[]) || [])
      .slice(0, latest)
      .map((d) => ({
        time: d.time,
        service: d.service,
        area: d.areaName,
        route: d.route,
        headsign: d.headsign,
        from: d.firstStopName ?? d.firstStopId,
        to: d.lastStopName ?? d.lastStopId,
        vehicle: d.vehicle,
        scheduled: d.scheduled,
        delayMinutes: d.delayMinutes,
        status: d.status,
        source: d.source,
        runId: d.runId,
      })),
    notes: notesOf(data),
    sources: SOURCE_NOTES,
    attribution: data.attribution,
  };
}

/**
 * JSON with short values on one line and each row of a list on its own line:
 * as easy to read as indented JSON, in far fewer tokens.
 */
export function toText(value: unknown, indent = ''): string {
  const flat = JSON.stringify(value);
  if (value === null || typeof value !== 'object' || flat.length <= 80)
    return flat ?? 'null';
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    const items = value.map((item) => {
      const one = JSON.stringify(item);
      return inner + (one.length <= 800 ? one : toText(item, inner));
    });
    return `[\n${items.join(',\n')}\n${indent}]`;
  }
  const entries = Object.entries(value as Row).filter(
    ([, v]) => v !== undefined
  );
  return `{\n${entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${toText(v, inner)}`).join(',\n')}\n${indent}}`;
}
