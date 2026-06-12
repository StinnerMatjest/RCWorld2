// Stateless admin session: a successful /api/authenticate sets an httpOnly
// cookie holding HMAC("parkrating-admin", ACCESS_PASSWORD). The middleware
// recomputes the same value to verify mutating API requests, so changing
// ACCESS_PASSWORD invalidates all existing sessions.
// Uses Web Crypto so it runs in both the Node and Edge (middleware) runtimes.

export const ADMIN_COOKIE = "pr_admin";

export async function adminToken(secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("parkrating-admin"));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function isAdminRequest(req: {
  cookies: { get(name: string): { value: string } | undefined };
}): Promise<boolean> {
  const secret = process.env.ACCESS_PASSWORD;
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!secret || !token) return false;
  const expected = await adminToken(secret);
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
