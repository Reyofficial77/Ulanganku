import { createHmac, timingSafeEqual } from 'node:crypto';
const secret = () => process.env.SESSION_SECRET || 'development-only-change-me';
export function sign(s) { const body = Buffer.from(JSON.stringify(s)).toString('base64url'); const sig = createHmac('sha256', secret()).update(body).digest('base64url'); return `${body}.${sig}`; }
export function read(req) { const raw = req.cookies.session; if (!raw)
    return null; const [body, sig] = raw.split('.'); if (!body || !sig)
    return null; const expected = createHmac('sha256', secret()).update(body).digest('base64url'); try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
        return null;
    return JSON.parse(Buffer.from(body, 'base64url').toString());
}
catch {
    return null;
} }
export function set(res, s) { res.setHeader('Set-Cookie', `session=${sign(s)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=604800`); }
export function clear(res) { res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0'); }
export function origin(req) { const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0]; return `${proto}://${req.headers.host}`; }
