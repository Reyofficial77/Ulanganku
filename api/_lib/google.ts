import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

function credentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET belum diatur.");
  }
  return { clientId, clientSecret };
}

export function buildAuthUrl(redirectUri: string, state: string) {
  const { clientId } = credentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCode(code: string, redirectUri: string) {
  const { clientId, clientSecret } = credentials();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw new Error("Gagal menukar kode Google.");
  const data = (await response.json()) as { id_token?: string };
  if (!data.id_token) throw new Error("Google tidak mengembalikan id_token.");

  const { payload } = await jwtVerify(data.id_token, JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });
  if (!payload.sub || !payload.email) throw new Error("Profil Google tidak lengkap.");
  if (payload.email_verified === false) throw new Error("Email Google belum terverifikasi.");

  return {
    id: String(payload.sub),
    email: String(payload.email),
    name: String(payload.name ?? payload.email),
    picture: payload.picture ? String(payload.picture) : null,
  };
}
