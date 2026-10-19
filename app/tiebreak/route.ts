import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/app/lib/adminAuth";

// Tiebreak: a phone-first page where the two admins settle the order of
// coasters that share a score, live, together. Data and rules live in
// app/api/tiebreak; the app itself is public/tiebreak.js. Behind the admin
// cookie like the carousel tool; noindex (meta, header and robots.txt).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const head = (title: string) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">
<meta name="theme-color" content="#0f172a">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
  :root{--accent:#e9820e;--accent-light:#f8941e;--bg:#0f172a;--el:#16223c;--el2:#1d2b4a;--line:rgba(255,255,255,.1);--muted:rgba(255,255,255,.55);--good:#22c55e;--bad:#ef4444;--blue:#60a5fa}
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
  /* top bar */
  .top{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:10px;padding:calc(10px + env(safe-area-inset-top)) 14px 10px;background:rgba(10,15,26,.96);border-bottom:1px solid var(--line);backdrop-filter:blur(8px)}
  .top .back{font-size:22px;line-height:1;padding:2px 6px;color:#fff;text-decoration:none}
  .top .ttl{font-weight:900;font-size:15px;letter-spacing:.5px;color:#fff;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .top .ttl span{color:var(--accent)}
  .who{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
  .who .me{font-weight:700;color:#fff}
  .dot{width:8px;height:8px;border-radius:50%;background:#555;display:inline-block}
  .dot.on{background:var(--good)}
  .wrap{padding:18px 16px 0;max-width:640px;margin:0 auto}
  /* house-style headline: black type with the orange bar */
  .hl{position:relative;font-size:30px;font-weight:900;letter-spacing:-.8px;line-height:1;color:#fff;padding-bottom:12px;margin:6px 0 18px}
  .hl::after{content:'';position:absolute;left:1px;bottom:0;width:34px;height:3px;background:var(--accent);border-radius:2px}
  .hl small{display:block;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
  h2{font-size:11px;font-weight:900;letter-spacing:1.8px;text-transform:uppercase;color:var(--muted);margin:24px 0 10px}
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
  /* home: the tied scores */
  .grp{display:block;position:relative;overflow:hidden;background:var(--el);border:1px solid var(--line);border-radius:16px;margin-bottom:10px;text-decoration:none;padding:14px 16px 14px 14px}
  .grp .row{display:flex;align-items:center;gap:14px}
  .grp .sc{font-size:46px;font-weight:900;letter-spacing:-2.5px;line-height:.9;width:92px;flex:0 0 auto;text-shadow:0 2px 14px rgba(0,0,0,.4)}
  .grp .nm{flex:1;min-width:0}
  .grp .nm b{display:block;color:#fff;font-size:17px;letter-spacing:-.2px}
  .grp .nm small{display:block;color:var(--muted);font-size:12px;margin-top:2px}
  .grp .thumbs{display:flex;margin-top:10px;padding-left:106px}
  .grp .thumbs i{width:34px;height:34px;border-radius:50%;background:#0b1222 center/cover no-repeat;border:2px solid var(--el);margin-left:-9px;flex:0 0 auto}
  .grp .thumbs i:first-child{margin-left:0}
  .grp .thumbs i.more{display:flex;align-items:center;justify-content:center;font:900 11px Roboto,sans-serif;color:var(--muted);background:var(--el2);font-style:normal}
  .grp .bar{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.06)}
  .grp .bar i{display:block;height:100%}
  .grp.done{opacity:.72}
  .grp.done .nm b::after{content:' ✓';color:var(--good)}
  .stats{display:flex;gap:8px;flex-wrap:wrap}
  .stat{flex:1;min-width:88px;background:var(--el);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
  .stat b{display:block;font-size:24px;font-weight:900;color:#fff;letter-spacing:-.6px;line-height:1.1}
  .stat small{display:block;color:var(--muted);font-size:10px;letter-spacing:1.2px;text-transform:uppercase;margin-top:3px}
  /* group screen */
  .ghead{display:flex;align-items:flex-end;gap:16px;margin:4px 0 18px}
  .ghead .sc{font-size:64px;font-weight:900;letter-spacing:-3.5px;line-height:.85;text-shadow:0 2px 16px rgba(0,0,0,.45)}
  .ghead .hl{margin:0;flex:1;font-size:24px}
  .ghead .hl small{margin-bottom:6px}
  .round{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;color:var(--muted);margin-bottom:10px}
  .round b{color:#fff;font-size:15px;margin-right:4px}
  .chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:100px;background:var(--el);border:1px solid var(--line);font-size:12px;color:#fff}
  .chip.ok{border-color:rgba(34,197,94,.5)}
  .chip.ok::before{content:'✓';color:var(--good);font-weight:900}
  .chip.wait::before{content:'…';color:var(--muted)}
  .list{display:flex;flex-direction:column;gap:10px}
  .cand{display:flex;gap:12px;padding:10px;background:var(--el);border:2px solid transparent;border-radius:16px;cursor:pointer;user-select:none;position:relative}
  .cand.mine{border-color:var(--accent);background:var(--el2)}
  .cand .th{width:84px;height:84px;border-radius:12px;background:#0b1222 center/cover no-repeat;flex:0 0 auto}
  .cand .tx{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:space-between;padding-right:34px}
  .cand .tx b{display:block;color:#fff;font-size:17px;font-weight:900;letter-spacing:-.3px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cand .tx small{display:block;color:var(--muted);font-size:12px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cand .tx small em{font-style:normal;color:rgba(255,255,255,.8)}
  .specs4{display:flex;gap:14px;margin-top:8px}
  .specs4 div{min-width:0}
  .specs4 b{display:block;font-size:16px;font-weight:900;color:#fff;letter-spacing:-.4px;line-height:1}
  .specs4 b i{font-style:normal;font-size:10px;font-weight:700;color:var(--muted);margin-left:2px;letter-spacing:0}
  .specs4 small{display:block;font-size:9px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:var(--muted);margin-top:3px}
  .cand .info{position:absolute;right:10px;top:10px;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.08);color:#fff;font:700 14px Roboto,serif;display:flex;align-items:center;justify-content:center}
  .cand .tick{position:absolute;left:-2px;top:-2px;background:var(--accent);color:#0c0c0c;font:900 10px Roboto,sans-serif;letter-spacing:1px;padding:3px 8px;border-radius:14px 0 10px 0}
  /* the draft list */
  .placed{display:flex;flex-direction:column;gap:6px}
  .pl{display:flex;align-items:center;gap:8px;padding:9px 6px 9px 12px;background:rgba(255,255,255,.04);border-radius:12px}
  .pl .rk{width:30px;font-weight:900;font-size:18px;text-align:right;flex:0 0 auto;letter-spacing:-.5px}
  .pl .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff;font-weight:700}
  .pl .nm small{display:block;color:var(--muted);font-weight:400;font-size:11px}
  .pl .mv{display:flex;flex-direction:column;gap:2px}
  .pl .mv button{padding:4px 10px;font-size:11px;border-radius:8px;background:rgba(255,255,255,.1);color:#fff;line-height:1}
  .pl .mv button:disabled{opacity:.2}
  .pl .x{background:transparent;border:0;color:var(--muted);font-size:18px;padding:6px 8px}
  /* the coaster being placed: a lifted, draggable row (like the park rank lane) */
  .pl.new{background:rgba(37,99,235,.9);border:1px solid #60a5fa;color:#fff;touch-action:none;cursor:grab;user-select:none;position:relative;z-index:5;transition:transform .12s}
  .pl.new .rk{color:#fff} .pl.new .nm small{color:rgba(255,255,255,.75)}
  .pl.new .grip{font-size:20px;letter-spacing:-6px;color:rgba(255,255,255,.85);padding:0 10px 0 4px}
  .pl.new.lift{transition:none;box-shadow:0 0 14px rgba(96,165,250,.7),0 10px 30px rgba(0,0,0,.5);cursor:grabbing}
  .placed .pl:not(.new){transition:transform .12s}
  .banner{display:flex;align-items:center;gap:12px;margin-top:10px;padding:12px 14px;border-radius:12px;font-size:14px;font-weight:700}
  .banner.dirty{background:rgba(233,130,14,.12);border:1px solid rgba(233,130,14,.45);color:var(--accent-light)}
  .banner.dirty>div{flex:1} .banner.dirty button{white-space:nowrap}
  .banner.ok{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.35);color:var(--good)}
  .banner.ok small{font-weight:400;color:var(--muted);margin-left:auto;font-size:12px}
  /* sticky action bar */
  .act{position:fixed;left:0;right:0;bottom:0;z-index:30;padding:12px 14px calc(12px + env(safe-area-inset-bottom));background:rgba(10,15,26,.97);border-top:1px solid var(--line);backdrop-filter:blur(8px);max-height:70vh;overflow:auto}
  .act .in{max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:10px}
  .act .btns{display:flex;gap:8px}
  .act .btns button{flex:1}
  .verdict{text-align:center;font-weight:900;font-size:22px;letter-spacing:1px;padding:6px 0 2px}
  .verdict.match{color:var(--good)} .verdict.split{color:var(--accent-light)}
  .verdict.place{font-size:17px;letter-spacing:0;color:#fff} .verdict.place b{color:var(--blue)}
  .verdict.round{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);padding:0}
  .slots{display:flex;flex-direction:column;gap:6px}
  .slot{text-align:left;background:var(--el);color:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px;font-weight:700}
  .slot:active{background:var(--el2)}
  .slot b{color:var(--accent-light)} .slot small{display:block;font-weight:500;color:var(--muted);font-size:11px;margin-top:2px}
  .picks{display:flex;gap:8px}
  .pk{flex:1;background:var(--el);border:1px solid var(--line);border-radius:12px;padding:10px 12px;min-width:0}
  .pk small{display:block;color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase;margin-bottom:2px}
  .pk b{display:block;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pk.a{border-color:var(--accent)} .pk.b{border-color:var(--blue)}
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
  .ov-card:nth-child(2){border-color:var(--blue)}
  .ov-card.hide{transform:translateY(30px) scale(.9);opacity:0}
  .ov-card small{display:block;color:var(--muted);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px}
  .ov-card b{display:block;color:#fff;font-size:24px;font-weight:900;letter-spacing:-.5px}
  .stamp{font-size:54px;font-weight:900;letter-spacing:4px;padding:6px 26px;border:5px solid currentColor;border-radius:14px;transform:rotate(-7deg) scale(1);transition:transform .35s cubic-bezier(.2,1.6,.4,1),opacity .2s;white-space:nowrap}
  .stamp.hide{transform:rotate(-7deg) scale(3);opacity:0}
  .stamp.match{color:var(--good)} .stamp.split{color:var(--accent-light);font-size:44px}
  .ov-skip{position:absolute;top:calc(14px + env(safe-area-inset-top));right:16px;background:transparent;border:1.5px solid rgba(255,255,255,.3);color:rgba(255,255,255,.8);padding:8px 16px;font-size:13px}
  .ov-skip.hide{display:none}
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
  .sheet .bd h3{margin:0;font-size:26px;font-weight:900;letter-spacing:-.6px;color:#fff}
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
<script src="/tiebreak.js?v=5"></script>
</body></html>`;

export async function GET(req: NextRequest) {
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" };
  if (!(await isAdminRequest(req))) return new NextResponse(loginPage, { headers });
  return new NextResponse(appPage, { headers });
}
