import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Dedicated logout endpoint. Keep this handler independent from the shared API,
 * JWT verification, and database modules so logout still works during outages.
 */
export default function logoutHandler(req: VercelRequest, res: VercelResponse) {
  if ((req.method ?? "GET").toUpperCase() !== "POST") {
    res.setHeader("Allow", "POST");
    res.setHeader("Cache-Control", "no-store");
    return res.status(405).json({ error: "Metode tidak diizinkan." });
  }

  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const secure = forwardedProto === "https" || process.env.VERCEL === "1" || host.endsWith(".vercel.app");
  const secureFlag = secure ? "; Secure" : "";
  const expiredCookies = [
    `ulanganku_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureFlag}`,
    `ulanganku_oauth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureFlag}`,
  ];

  res.setHeader("Set-Cookie", expiredCookies);
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(200).json({ ok: true });
}
