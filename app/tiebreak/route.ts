import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/app/lib/adminAuth";

// Tiebreak: a phone-first page where the two admins settle the order of
// coasters that share a score, live, together. Data and rules live in
// app/api/tiebreak; the app itself is public/tiebreak.js. Behind the admin
// cookie like the carousel tool; noindex.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const head = (title: string) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<meta name="robots" content="noindex,nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">
<meta name="theme-color" content="#0f172a">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
  :root{--accent:#e9820e;--accent-light:#f8941e;--bg:#0f172a;--el:#16223c;--el2:#1d2b4a;--line:rgba(255,255,255,.1);--muted:rgba(255,255,255,.55);--good:#22c55e;--bad:#ef4444}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  html,body{margin:0;background:var(--bg);color:#e2e8f0;font:15px/1.4 Roboto,sans-serif;min-height:100%}
  body{padding-bottom:calc(140px + env(safe-area-inset-bottom))}
  a{color:inherit}
  button{font:700 14px Roboto,sans-serif;padding:12px 18px;border-radius:100px;border:none;background:var(--accent);color:#0c0c0c;cursor:pointer}
  button:disabled{opacity:.4}
  button.sec{background:transparent;border:1.5px solid rgba(255,255,255,.3);color:rgba(255,255,255,.9)}
  button.danger{background:transparent;border:1.5px solid rgba(248,113,113,.5);color:#f87171}
  button.sm{padding:7px 12px;font-size:12px}
  input{width:100%;font:16px Roboto,sans-serif;padding:12px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:var(--el);color:#fff}
  .top{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:10px;padding:calc(10px + env(safe-area-inset-top)) 14px 10px;background:rgba(10,15,26,.96);border-bottom:1px solid var(--line);backdrop-filter:blur(8px)}
  .top .back{font-size:22px;line-height:1;padding:2px 6px;color:#fff;text-decoration:none}
  .top .ttl{font-weight:900;font-size:15px;letter-spacing:.5px;color:#fff;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .top .ttl span{color:var(--accent)}
  .who{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
  .who .me{font-weight:700;color:#fff}
  .dot{width:8px;height:8px;border-radius:50%;background:#555;display:inline-block}
  .dot.on{background:var(--good)}
  .wrap{padding:14px 14px 0;max-width:640px;margin:0 auto}
  h2{font-size:11px;font-weight:900;letter-spacing:1.8px;text-transform:uppercase;color:var(--muted);margin:22px 0 10px}
  .card{background:var(--el);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
  .login{max-width:360px;margin:60px auto}
  .login h1{font-size:16px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 6px;color:#fff}
  .login h1 span{color:var(--accent)}
  .login p{color:var(--muted);margin:0 0 14px}
  .names{display:flex;flex-direction:column;gap:10px}
  .names button{font-size:20px;padding:18px}
  .other{margin-top:14px;color:var(--muted);font-size:13px}
  .other summary{cursor:pointer;padding:6px 0}
  .other input{margin-top:8px}
  .err{color:#f87171;font-size:12px;min-height:18px;margin-top:8px}
  /* home: groups */
  .grp{display:flex;align-items:center;gap:14px;padding:14px 16px;background:var(--el);border:1px solid var(--line);border-radius:14px;margin-bottom:10px;text-decoration:none}
  .grp .sc{font-size:28px;font-weight:900;letter-spacing:-1px;color:var(--accent);width:64px;flex:0 0 auto}
  .grp .nm{flex:1;min-width:0}
  .grp .nm b{display:block;color:#fff}
  .grp .nm small{color:var(--muted);font-size:12px}
  .grp .bar{height:4px;border-radius:2px;background:rgba(255,255,255,.1);margin-top:8px;overflow:hidden}
  .grp .bar i{display:block;height:100%;background:var(--good)}
  .grp.done .sc{color:var(--good)}
  .grp .chev{color:var(--muted);font-size:20px}
  /* group screen */
  .hdr{display:flex;align-items:baseline;gap:12px;margin:4px 0 6px}
  .hdr .sc{font-size:44px;font-weight:900;letter-spacing:-2px;color:var(--accent);line-height:1}
  .hdr .sub{color:var(--muted);font-size:13px}
  .round{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;color:var(--muted);margin-bottom:10px}
  .round b{color:#fff}
  .chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:100px;background:var(--el);border:1px solid var(--line);font-size:12px;color:#fff}
  .chip.ok{border-color:rgba(34,197,94,.5)}
  .chip.ok::before{content:'✓';color:var(--good);font-weight:900}
  .chip.wait::before{content:'…';color:var(--muted)}
  .list{display:flex;flex-direction:column;gap:8px}
  .cand{display:flex;align-items:center;gap:12px;padding:10px;background:var(--el);border:2px solid transparent;border-radius:14px;cursor:pointer;user-select:none;position:relative}
  .cand.mine{border-color:var(--accent);background:var(--el2)}
  .cand .th{width:60px;height:60px;border-radius:10px;background:#0b1222 center/cover no-repeat;flex:0 0 auto}
  .cand .tx{flex:1;min-width:0}
  .cand .tx b{display:block;color:#fff;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cand .tx small{display:block;color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cand .tx .st{color:rgba(255,255,255,.75);font-size:11px;margin-top:3px}
  .cand .info{flex:0 0 auto;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.08);color:#fff;font:700 16px Roboto,serif;display:flex;align-items:center;justify-content:center}
  .cand .tick{position:absolute;left:-2px;top:-2px;background:var(--accent);color:#0c0c0c;font:900 10px Roboto,sans-serif;letter-spacing:1px;padding:3px 8px;border-radius:14px 0 10px 0}
  .cand .tick.rev-b{background:#60a5fa} .cand .tick.rev-ab{background:var(--good)}
  /* the shared list */
  .placed{display:flex;flex-direction:column;gap:6px}
  .pl{display:flex;align-items:center;gap:8px;padding:8px 6px 8px 10px;background:rgba(255,255,255,.04);border-radius:12px}
  .pl .rk{width:30px;font-weight:900;color:var(--accent);font-size:17px;text-align:right;flex:0 0 auto}
  .pl .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff;font-weight:700}
  .pl .nm small{display:block;color:var(--muted);font-weight:400;font-size:11px}
  .pl .mv{display:flex;flex-direction:column;gap:2px}
  .pl .mv button{padding:4px 10px;font-size:11px;border-radius:8px;background:rgba(255,255,255,.1);color:#fff;line-height:1}
  .pl .mv button:disabled{opacity:.2}
  .pl .x{background:transparent;border:0;color:var(--muted);font-size:18px;padding:6px 8px}
  .stats{display:flex;gap:8px;flex-wrap:wrap}
  .stat{flex:1;min-width:90px;background:var(--el);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
  .stat b{display:block;font-size:22px;font-weight:900;color:#fff;letter-spacing:-.5px}
  .stat small{color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase}
  /* sticky action bar */
  .act{position:fixed;left:0;right:0;bottom:0;z-index:30;padding:12px 14px calc(12px + env(safe-area-inset-bottom));background:rgba(10,15,26,.97);border-top:1px solid var(--line);backdrop-filter:blur(8px);max-height:70vh;overflow:auto}
  .act .in{max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:10px}
  .act .btns{display:flex;gap:8px}
  .act .btns button{flex:1}
  .verdict{text-align:center;font-weight:900;font-size:22px;letter-spacing:1px;padding:6px 0 2px}
  .verdict.match{color:var(--good)} .verdict.split{color:var(--accent-light)}
  .verdict.place{font-size:17px;letter-spacing:0;color:#fff} .verdict.place b{color:var(--accent-light)}
  .slots{display:flex;flex-direction:column;gap:6px}
  .slot{text-align:left;background:var(--el);color:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px;font-weight:700}
  .slot:active{background:var(--el2)}
  .slot b{color:var(--accent-light)} .slot small{display:block;font-weight:500;color:var(--muted);font-size:11px;margin-top:2px}
  .banner{display:flex;align-items:center;gap:12px;margin-top:10px;padding:12px 14px;border-radius:12px;font-size:13px;line-height:1.35}
  .banner.dirty{background:rgba(233,130,14,.12);border:1px solid rgba(233,130,14,.45);color:#fff}
  .banner.dirty b{color:var(--accent-light)} .banner.dirty>div{flex:1}
  .banner.dirty button{white-space:nowrap}
  .banner.ok{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.35);color:rgba(255,255,255,.8)} .banner.ok b{color:var(--good)}
  .picks{display:flex;gap:8px}
  .pk{flex:1;background:var(--el);border:1px solid var(--line);border-radius:12px;padding:10px 12px;min-width:0}
  .pk small{display:block;color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase;margin-bottom:2px}
  .pk b{display:block;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pk.a{border-color:var(--accent)} .pk.b{border-color:#60a5fa}
  .hint{text-align:center;color:var(--muted);font-size:12px}
  /* the reveal */
  #overlay{position:fixed;inset:0;z-index:60;background:rgba(5,8,16,.96);display:none;align-items:center;justify-content:center;padding:24px}
  #overlay.on{display:flex}
  .ov-in{width:min(420px,100%);display:flex;flex-direction:column;gap:18px;align-items:center}
  .ov-t{font-size:14px;font-weight:900;letter-spacing:4px;text-transform:uppercase;color:var(--muted)}
  .ov-t .dots i{display:inline-block;font-style:normal;animation:blink 1.2s infinite}
  .ov-t .dots i:nth-child(2){animation-delay:.3s} .ov-t .dots i:nth-child(3){animation-delay:.6s}
  @keyframes blink{0%,80%,100%{opacity:.2}40%{opacity:1}}
  .ov-cards{display:flex;flex-direction:column;gap:12px;width:100%}
  .ov-card{background:var(--el);border:2px solid var(--accent);border-radius:16px;padding:16px 18px;transition:transform .45s cubic-bezier(.2,.9,.3,1.2),opacity .35s}
  .ov-card:nth-child(2){border-color:#60a5fa}
  .ov-card.hide{transform:translateY(30px) scale(.9);opacity:0}
  .ov-card small{display:block;color:var(--muted);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px}
  .ov-card b{display:block;color:#fff;font-size:24px;font-weight:900;letter-spacing:-.5px}
  .stamp{font-size:54px;font-weight:900;letter-spacing:4px;padding:6px 26px;border:5px solid currentColor;border-radius:14px;transform:rotate(-7deg) scale(1);transition:transform .35s cubic-bezier(.2,1.6,.4,1),opacity .2s}
  .stamp.hide{transform:rotate(-7deg) scale(3);opacity:0}
  .stamp.match{color:var(--good)} .stamp.split{color:var(--accent-light)}
  .ov-btn{margin-top:8px;padding:14px 38px;font-size:16px;transition:opacity .3s,transform .3s}
  .ov-btn.hide{opacity:0;transform:translateY(10px);pointer-events:none}
  /* bottom sheet: stats */
  .sheet-bg{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:40;display:none}
  .sheet{position:fixed;left:0;right:0;bottom:0;z-index:41;max-height:88vh;overflow:auto;background:#0b1222;border-radius:18px 18px 0 0;transform:translateY(100%);transition:transform .25s;padding-bottom:calc(20px + env(safe-area-inset-bottom))}
  .sheet.open{transform:none} .sheet-bg.open{display:block}
  .sheet .grab{position:sticky;top:0;z-index:2;width:44px;height:5px;border-radius:3px;background:rgba(255,255,255,.35);margin:8px auto -13px}
  .sheet .close{position:sticky;top:10px;z-index:3;float:right;margin:0 12px 0 0;width:44px;height:44px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;font-size:18px;padding:0;border:1px solid rgba(255,255,255,.25)}
  .sheet .ph{height:220px;background:#000 center/cover no-repeat;border-radius:18px 18px 0 0;clear:both;margin-top:-54px}
  .sheet .bd{padding:14px 18px}
  .sheet .bd h3{margin:0;font-size:24px;font-weight:900;letter-spacing:-.6px;color:#fff}
  .sheet .bd .sub{color:var(--muted);font-size:13px;margin-top:2px}
  .sheet .sc{position:absolute;right:16px;top:180px;background:var(--accent);color:#0c0c0c;font-weight:900;font-size:24px;padding:6px 14px;border-radius:12px;letter-spacing:-.5px}
  .specs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}
  .spec{background:var(--el);border-radius:10px;padding:8px 10px}
  .spec b{display:block;color:#fff;font-size:17px;font-weight:900;letter-spacing:-.4px}
  .spec small{color:var(--muted);font-size:10px;letter-spacing:1px;text-transform:uppercase}
  .rev h4{margin:14px 0 4px;font-size:15px;color:#fff}
  .rev p{margin:0 0 10px;color:rgba(255,255,255,.85);font-size:14px;line-height:1.5}
  .rev .spoil{filter:blur(6px);cursor:pointer}
  .rev .spoil.show{filter:none}
  .sheet .links{display:flex;gap:8px;margin-top:14px}
  .toast{position:fixed;left:50%;top:70px;transform:translateX(-50%);background:#fff;color:#0c0c0c;font-weight:700;padding:10px 16px;border-radius:100px;z-index:50;opacity:0;transition:opacity .2s;pointer-events:none}
  .toast.on{opacity:1}
  .log{font-size:12px;color:var(--muted);display:flex;flex-direction:column;gap:4px}
  .log b{color:#fff}
</style></head><body>`;

const loginPage = head("Parkrating tiebreak") + `
<div class="wrap"><form class="card login" onsubmit="return login(event)">
  <h1><span>Parkrating</span> tiebreak</h1>
  <p>Enter the admin password to continue.</p>
  <input type="password" id="pw" placeholder="Admin password" autofocus autocomplete="current-password">
  <button type="submit" style="width:100%;margin-top:12px">Open</button>
  <div class="err" id="err"></div>
</form></div>
<script>
  async function login(e){e.preventDefault();const err=document.getElementById('err');err.textContent='';
    const r=await fetch('/api/authenticate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.getElementById('pw').value})});
    if(r.ok){location.reload();}else{err.textContent='Wrong password';}return false;}
</script></body></html>`;

const appPage = head("Parkrating tiebreak") + `
<div id="app"></div>
<div id="overlay"></div>
<div class="sheet-bg" id="sheet-bg" onclick="closeSheet()"></div>
<div class="sheet" id="sheet"></div>
<div class="toast" id="toast"></div>
<script src="/tiebreak.js?v=3"></script>
</body></html>`;

export async function GET(req: NextRequest) {
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
  if (!(await isAdminRequest(req))) return new NextResponse(loginPage, { headers });
  return new NextResponse(appPage, { headers });
}
