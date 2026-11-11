// Vercel Function: tells the browser whether the visitor's country gets the view-only interface.
import { geoResponse } from "../functions/_lib/geo";

export const config = { runtime: "nodejs", maxDuration: 5 };

const handler = {
  fetch(request: Request): Response {
    if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
    // Vercel sets x-vercel-ip-country at its edge from the connecting IP. No other country header is read here.
    const country = (request.headers.get("x-vercel-ip-country") ?? "").toUpperCase() || null;
    return geoResponse(country, { BLOCKED_COUNTRIES: process.env.BLOCKED_COUNTRIES }, "x-vercel-ip-country");
  },
};

export default handler;
