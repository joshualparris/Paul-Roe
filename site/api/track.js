const crypto = require("crypto");

function deviceType(userAgent = "") {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|kindle|silk/.test(ua)) return "tablet";
  if (/mobi|android|iphone|ipod/.test(ua)) return "mobile";
  return "desktop";
}

function safeHostname(value) {
  if (!value) return "";
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");

  // Health/test request used only to verify the function is deployed.
  if (req.method === "GET") {
    if (req.query?.test === "1") {
      console.log("PAUL_ANALYTICS_TEST " + JSON.stringify({
        at: new Date().toISOString(),
        host: req.headers.host || ""
      }));
    }
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).end();
  }

  const body = typeof req.body === "string"
    ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })()
    : (req.body || {});

  const rawVisitor = typeof body.visitorId === "string" ? body.visitorId.slice(0, 128) : "";
  if (!rawVisitor) return res.status(204).end();

  const visitor = crypto
    .createHash("sha256")
    .update(rawVisitor)
    .digest("hex")
    .slice(0, 20);

  const event = {
    at: new Date().toISOString(),
    host: req.headers.host || "",
    path: typeof body.path === "string" ? body.path.slice(0, 200) : "/",
    visitor,
    referrer: safeHostname(typeof body.referrer === "string" ? body.referrer : ""),
    country: req.headers["x-vercel-ip-country"] || "",
    device: deviceType(req.headers["user-agent"] || "")
  };

  console.log("PAUL_ANALYTICS " + JSON.stringify(event));
  return res.status(204).end();
};
