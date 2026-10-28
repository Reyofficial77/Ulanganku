import { SignJWT, jwtVerify } from "jose";
import { HttpError, parseCookies, serializeCookie } from "./http.js";
export const SESSION_COOKIE = "ulanganku_session";
export const STATE_COOKIE = "ulanganku_oauth";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
function secretKey() {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error("SESSION_SECRET belum diatur (minimal 32 karakter).");
    }
    return new TextEncoder().encode(secret);
}
export async function createSessionCookie(user, secure) {
    const token = await new SignJWT({
        email: user.email,
        name: user.name,
        picture: user.picture,
    })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(user.id)
        .setIssuedAt()
        .setExpirationTime(`${SESSION_SECONDS}s`)
        .sign(secretKey());
    return serializeCookie(SESSION_COOKIE, token, { maxAge: SESSION_SECONDS, secure });
}
export function clearSessionCookie(secure) {
    return serializeCookie(SESSION_COOKIE, "", { maxAge: 0, secure });
}
export async function getSession(req) {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (!token)
        return null;
    try {
        const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
        if (!payload.sub)
            return null;
        return {
            id: payload.sub,
            email: String(payload.email ?? ""),
            name: String(payload.name ?? ""),
            picture: payload.picture ? String(payload.picture) : null,
        };
    }
    catch {
        return null;
    }
}
export async function requireUser(req) {
    const user = await getSession(req);
    if (!user)
        throw new HttpError(401, "Silakan masuk terlebih dahulu.");
    return user;
}
/** Tolak request mutasi dari origin lain (perlindungan CSRF tambahan). */
export function assertSameOrigin(req) {
    const method = (req.method ?? "GET").toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS")
        return;
    const origin = req.headers.origin;
    if (!origin)
        return;
    const allowedHosts = [req.headers["x-forwarded-host"], req.headers.host]
        .flatMap((value) => String(value ?? "").split(","))
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
    try {
        const originHost = new URL(String(origin)).host.toLowerCase();
        if (!allowedHosts.includes(originHost))
            throw new Error();
    }
    catch {
        throw new HttpError(403, "Origin tidak diizinkan.");
    }
}
export function setCookie(res, ...cookies) {
    res.setHeader("Set-Cookie", cookies);
}
