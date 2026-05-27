import { NextRequest, NextResponse } from "next/server";

const REDIRECT_URI = "http://localhost:3000/api/setup/facebook/callback";

export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return new NextResponse("Missing code", { status: 400 });

  const APP_ID = process.env.META_APP_ID!;
  const APP_SECRET = process.env.META_APP_SECRET!;

  try {
    // 1. Short-lived user token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_secret=${APP_SECRET}&code=${code}`
    );
    const { access_token: shortToken } = await tokenRes.json();

    // 2. Long-lived user token (60 days)
    const longRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${shortToken}`
    );
    const { access_token: longToken } = await longRes.json();

    // 3. Page access tokens (permanent when derived from long-lived user token)
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${longToken}`
    );
    const { data: pages } = await pagesRes.json();

    // 3b. Check what permissions the token actually has
    const permsRes = await fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${longToken}`);
    const { data: perms } = await permsRes.json();

    // 4. For each page, try to get linked Instagram Business Account ID
    const results = await Promise.all(
      pages.map(async (page: { id: string; name: string; access_token: string }) => {
        const igRes = await fetch(
          `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
        );
        const igData = await igRes.json();
        return { ...page, instagram_id: igData.instagram_business_account?.id ?? null };
      })
    );

    const html = `<!DOCTYPE html>
<html>
<head><title>ParkRating Meta Setup</title>
<style>
  body { font-family: monospace; padding: 40px; background: #0f0f0f; color: #e0e0e0; }
  h1 { color: #f90; }
  .card { background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 20px; margin: 20px 0; }
  .label { color: #888; font-size: 12px; margin-bottom: 4px; }
  .value { color: #4fc; word-break: break-all; font-size: 13px; }
  .copy { background: #333; border: none; color: #fff; padding: 4px 10px; border-radius: 4px; cursor: pointer; margin-left: 8px; font-size: 11px; }
  .note { color: #f80; margin-top: 20px; padding: 12px; background: #2a1a00; border-radius: 6px; }
</style>
</head>
<body>
<h1>Meta OAuth Setup Complete</h1>
<p>Copy these values into your <code>.env.local</code> file:</p>

${results.map((page) => `
<div class="card">
  <h2 style="color:#fff;margin-top:0">${page.name}</h2>
  <div class="label">META_PAGE_ID</div>
  <div class="value">${page.id} <button class="copy" onclick="navigator.clipboard.writeText('${page.id}')">copy</button></div>
  <br/>
  <div class="label">META_PAGE_ACCESS_TOKEN (permanent)</div>
  <div class="value">${page.access_token} <button class="copy" onclick="navigator.clipboard.writeText('${page.access_token}')">copy</button></div>
  <br/>
  <div class="label">META_INSTAGRAM_ID ${page.instagram_id ? "✅" : "❌ not connected"}</div>
  <div class="value">${page.instagram_id ?? "No Instagram Business account linked to this page"} ${page.instagram_id ? `<button class="copy" onclick="navigator.clipboard.writeText('${page.instagram_id}')">copy</button>` : ""}</div>
</div>`).join("")}

<div class="note">
  <strong>Add to .env.local:</strong><br/><br/>
  ${results[0] ? `META_PAGE_ID=${results[0].id}<br/>
  META_PAGE_ACCESS_TOKEN=${results[0].access_token}<br/>
  META_INSTAGRAM_ID=${results[0].instagram_id ?? "NOT_CONNECTED"}` : "No pages found"}
</div>

<div class="card">
  <h2 style="color:#fff;margin-top:0">Granted Permissions</h2>
  <div class="value">${perms.map((p: {permission: string, status: string}) => `${p.permission}: ${p.status}`).join("<br/>")}</div>
</div>
<p style="color:#666;margin-top:30px">You can delete <code>app/api/setup/</code> after saving these values.</p>
</body>
</html>`;

    return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
  } catch (err) {
    return new NextResponse(`Error: ${err}`, { status: 500 });
  }
}
