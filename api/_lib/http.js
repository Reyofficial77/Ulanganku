export class HttpError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
export function json(res, status, data) {
    res.status(status);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(JSON.stringify(data));
}
/** Origin saat ini, mengikuti domain tempat aplikasi diakses. */
export function getOrigin(req) {
    const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim();
    const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "").split(",")[0].trim();
    const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
    const proto = forwardedProto || (isLocal ? "http" : "https");
    return `${proto}://${host}`;
}
export function getIp(req) {
    const forwarded = String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim();
    return forwarded || req.socket?.remoteAddress || "";
}
/** Samarkan IP: hanya dua blok terakhir yang terlihat. */
export function maskIp(ip) {
    if (!ip)
        return "•••";
    if (ip.includes(":")) {
        const parts = ip.split(":").filter(Boolean);
        return `•••:${parts.slice(-1)[0] ?? ""}`;
    }
    const parts = ip.split(".");
    if (parts.length !== 4)
        return "•••";
    return `•••.•••.${parts[2]}.${parts[3]}`;
}
export function parseCookies(req) {
    const header = req.headers.cookie;
    const out = {};
    if (!header)
        return out;
    for (const part of header.split(";")) {
        const index = part.indexOf("=");
        if (index < 0)
            continue;
        out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
    }
    return out;
}
export function serializeCookie(name, value, options) {
    const parts = [
        `${name}=${encodeURIComponent(value)}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
    ];
    if (options.maxAge !== undefined)
        parts.push(`Max-Age=${options.maxAge}`);
    if (options.secure)
        parts.push("Secure");
    return parts.join("; ");
}
/** Hanya izinkan redirect ke path internal. */
export function safeNext(value, fallback = "/dashboard") {
    if (typeof value !== "string")
        return fallback;
    if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\"))
        return fallback;
    return value;
}
