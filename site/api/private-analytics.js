const PROJECT_ID = "prj_0YSwPgZbbeP1tltcA6bJ8Cmna3vK";
const TEAM_ID = "team_jhrKVI18IfbwO9ChetbSH01p";
const TIME_ZONE = "Australia/Sydney";

function getLocalDateParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function zonedMidnightUtc({ year, month, day }) {
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(guess));
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  const representedAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return new Date(guess - (representedAsUtc - guess));
}

async function analyticsRequest(path, params, token) {
  const url = new URL("https://api.vercel.com" + path);
  url.searchParams.set("projectId", PROJECT_ID);
  url.searchParams.set("teamId", TEAM_ID);
  for (const [key, value] of Object.entries(params || {})) {
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item);
    } else if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
  });

  const body = await response.text();
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    data = { raw: body };
  }

  if (!response.ok) {
    const error = new Error("Vercel Analytics API request failed");
    error.status = response.status;
    error.detail = data;
    throw error;
  }
  return data;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");

  const configuredKey = process.env.PRIVATE_ANALYTICS_KEY;
  const apiToken = process.env.VERCEL_ANALYTICS_TOKEN;

  if (!configuredKey || !apiToken) {
    return res.status(503).json({ error: "Private analytics is not configured." });
  }

  const providedKey = Array.isArray(req.query?.key) ? req.query.key[0] : req.query?.key;
  if (!providedKey || providedKey !== configuredKey) {
    return res.status(404).json({ error: "Not found." });
  }

  try {
    const now = new Date();
    const todayParts = getLocalDateParts(now);
    const todayStart = zonedMidnightUtc(todayParts);
    const tomorrowParts = getLocalDateParts(new Date(todayStart.getTime() + 36 * 60 * 60 * 1000));
    const tomorrowStart = zonedMidnightUtc(tomorrowParts);
    const yesterdayParts = getLocalDateParts(new Date(todayStart.getTime() - 12 * 60 * 60 * 1000));
    const yesterdayStart = zonedMidnightUtc(yesterdayParts);

    const todayUntil = now.toISOString();
    const todaySince = todayStart.toISOString();
    const yesterdaySince = yesterdayStart.toISOString();
    const yesterdayUntil = new Date(todayStart.getTime() - 1).toISOString();

    const [today, yesterday, referrers, countries, devices] = await Promise.all([
      analyticsRequest("/v1/query/web-analytics/visits/count", {
        since: todaySince,
        until: todayUntil,
      }, apiToken),
      analyticsRequest("/v1/query/web-analytics/visits/count", {
        since: yesterdaySince,
        until: yesterdayUntil,
      }, apiToken),
      analyticsRequest("/v1/query/web-analytics/visits/aggregate", {
        since: todaySince,
        until: todayUntil,
        by: ["referrer"],
        limit: 10,
      }, apiToken).catch(() => null),
      analyticsRequest("/v1/query/web-analytics/visits/aggregate", {
        since: todaySince,
        until: todayUntil,
        by: ["country"],
        limit: 10,
      }, apiToken).catch(() => null),
      analyticsRequest("/v1/query/web-analytics/visits/aggregate", {
        since: todaySince,
        until: todayUntil,
        by: ["deviceType"],
        limit: 10,
      }, apiToken).catch(() => null),
    ]);

    return res.status(200).json({
      generatedAt: now.toISOString(),
      timeZone: TIME_ZONE,
      today: {
        since: todaySince,
        until: todayUntil,
        pageviews: today?.data?.pageviews ?? null,
        visitors: today?.data?.visitors ?? null,
      },
      yesterday: {
        since: yesterdaySince,
        until: yesterdayUntil,
        pageviews: yesterday?.data?.pageviews ?? null,
        visitors: yesterday?.data?.visitors ?? null,
      },
      referrers: referrers?.data ?? null,
      countries: countries?.data ?? null,
      devices: devices?.data ?? null,
    });
  } catch (error) {
    return res.status(502).json({
      error: "Unable to retrieve analytics.",
      status: error?.status ?? null,
    });
  }
};
