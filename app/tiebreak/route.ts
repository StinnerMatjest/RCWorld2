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
  .top{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:10px;padding:calc(10px + env(safe-area-inset-top)) 14px 10px;background:#0a0f1a;border-bottom:1px solid var(--line);}
  .top .back{font-size:22px;line-height:1;padding:2px 6px;color:#fff;text-decoration:none}
  .top .ttl{font-weight:900;font-size:15px;letter-spacing:.5px;color:#fff;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .top .ttl span{color:var(--accent)}
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
  /* home: the tied scores, each a strip of the group's photos with the score on top */
  .grp{display:block;position:relative;overflow:hidden;height:124px;background:var(--el);border-radius:16px;margin-bottom:10px;text-decoration:none}
  .grp .strip{position:absolute;inset:0;display:flex}
  .grp .strip i{flex:1;background:#0b1222 center/cover no-repeat;filter:saturate(.9)}
  .grp .shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(10,15,26,.96) 0%,rgba(10,15,26,.82) 38%,rgba(10,15,26,.35) 70%,rgba(10,15,26,.15) 100%)}
  .grp .row{position:absolute;left:16px;right:16px;top:0;bottom:0;display:flex;align-items:center;gap:14px}
  .grp .sc{font-size:56px;font-weight:900;letter-spacing:-3px;line-height:.85;min-width:84px;flex:0 0 auto;text-shadow:0 2px 16px rgba(0,0,0,.6)}
  .grp .nm{flex:1;min-width:0}
  .grp .nm b{display:block;color:#fff;font-size:18px;font-weight:900;letter-spacing:-.3px;text-shadow:0 1px 8px rgba(0,0,0,.7)}
  .grp .nm small{display:block;color:rgba(255,255,255,.75);font-size:12px;margin-top:3px;text-shadow:0 1px 6px rgba(0,0,0,.7)}
  .grp .bar{position:absolute;left:0;right:0;bottom:0;height:4px;background:rgba(255,255,255,.08)}
  .grp .bar i{display:block;height:100%}
  .grp.done .nm b::after{content:' ✓';color:var(--good)}
  .grp.fresh .nm small{color:var(--accent-light);font-weight:700}
  /* new additions: added or re-rated coasters that need a spot in an existing list */
  .adds{display:flex;flex-direction:column;gap:8px}
  .add{display:flex;align-items:center;gap:12px;padding:8px 12px 8px 8px;background:var(--el);border:1px solid rgba(233,130,14,.35);border-radius:14px;text-decoration:none}
  .add .th{width:48px;height:48px;border-radius:10px;background:#0b1222 center/cover no-repeat;flex:0 0 auto}
  .add .tx{flex:1;min-width:0} .add .tx b{display:block;color:#fff;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} .add .tx small{color:var(--muted);font-size:12px}
  .add .chg{font-weight:900;font-size:18px;letter-spacing:-.5px;color:#fff;white-space:nowrap} .add .chg .from{color:var(--muted);text-decoration:line-through;font-size:15px}
  .settled-toggle{display:block;margin:8px auto 0;background:transparent;border:1.5px solid rgba(255,255,255,.18);color:var(--muted)}
  .stats{display:flex;gap:8px;flex-wrap:wrap}
  .stat{flex:1;min-width:88px;background:var(--el);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
  .stat b{display:block;font-size:24px;font-weight:900;color:#fff;letter-spacing:-.6px;line-height:1.1}
  .stat small{display:block;color:var(--muted);font-size:10px;letter-spacing:1.2px;text-transform:uppercase;margin-top:3px}
  /* group screen */
  .ghead{display:flex;align-items:center;gap:16px;margin:0 0 18px}
  .ghead .sc{font-size:64px;font-weight:900;letter-spacing:-3.5px;line-height:.85;text-shadow:0 2px 16px rgba(0,0,0,.45)}
  .ghead .hl{margin:0;flex:1;font-size:26px;padding-bottom:10px}
  .round{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;color:var(--muted);margin-bottom:10px}
  .round b{color:#fff;font-size:15px;margin-right:4px}
  .chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:100px;background:var(--el);border:1px solid var(--line);font-size:12px;color:#fff}
  .chip.ok{border-color:rgba(34,197,94,.5)}
  .chip.ok::before{content:'✓';color:var(--good);font-weight:900}
  .chip.wait::before{content:'…';color:var(--muted)}
  .list{display:flex;flex-direction:column;gap:12px}
  .cand{background:var(--el);border:2px solid transparent;background-clip:padding-box;border-radius:18px;cursor:pointer;user-select:none;position:relative;overflow:hidden}
  .cand.mine{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent),0 8px 24px rgba(233,130,14,.2)}
  .cand .ph{position:relative;height:210px;background:#0b1222 center/cover no-repeat}
  .cand.nophoto .ph{height:104px;background:linear-gradient(135deg,#1f2d4d,#0b1222)}
  .cand .ph::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,8,16,.3) 0%,rgba(5,8,16,0) 30%,rgba(5,8,16,0) 45%,rgba(5,8,16,.92) 100%)}
  .cand .tx{position:absolute;left:14px;right:14px;bottom:12px;z-index:1}
  .cand .tx b{display:block;color:#fff;font-size:24px;font-weight:900;letter-spacing:-.5px;line-height:1.05;text-shadow:0 2px 12px rgba(0,0,0,.8)}
  .cand .tx .ln{display:block;color:rgba(255,255,255,.78);font-size:12px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 6px rgba(0,0,0,.8)}
  .specs4{display:flex;justify-content:space-between;gap:8px;padding:12px 14px 13px}
  .specs4 div{flex:1;min-width:0;text-align:center}
  .specs4 b{display:block;font-size:19px;font-weight:900;color:#fff;letter-spacing:-.5px;line-height:1;white-space:nowrap}
  .specs4 .lb{display:block;font-size:9px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:var(--muted);margin-top:4px;white-space:nowrap}
  .cand .info{position:absolute;right:10px;top:10px;z-index:2;width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,.5);color:#fff;font:700 14px Roboto,serif;display:flex;align-items:center;justify-content:center}
  .cand .tick{position:absolute;left:0;top:0;z-index:2;background:var(--accent);color:#0c0c0c;font:900 10px Roboto,sans-serif;letter-spacing:1px;padding:4px 9px;border-radius:0 0 10px 0}
  .cand .tick.new{background:var(--good);color:#06260f}
  /* the sheet's "score feels wrong" row and the home list of flags */
  .sh-flag{display:flex;align-items:center;gap:18px;border-top:1px solid var(--line);padding:12px 0 2px;font-size:14px}
  .sh-flag span{color:var(--muted);flex:1}
  .sh-flag button{background:transparent;border:0;padding:6px 0;color:#fff;font:700 13px Roboto,sans-serif;letter-spacing:.3px;border-radius:0}
  .sh-flag button.on{color:var(--accent)}
  .sh-flag button.rm{color:var(--muted);font-weight:500}
  .sh-flag.top{border-top:0;padding-top:4px;border-bottom:1px solid var(--line);padding-bottom:12px}
  .sh-flag span em{font-style:normal;color:var(--accent-light);font-weight:700}
  .add.flag{border-color:rgba(255,255,255,.12)}
  .add .chg .dir{display:block;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--accent-light)}
  .add .chg .dir.low{color:var(--blue)}
  .add .x{background:transparent;border:0;color:var(--muted);font-size:18px;padding:6px 8px}
  .verdict .turn{display:block;font-size:13px;letter-spacing:0;color:var(--muted);font-weight:500;margin-top:4px}
  /* the draft list */
  .placed{display:flex;flex-direction:column;gap:6px}
  .pl{display:flex;align-items:center;gap:10px;padding:7px 6px 7px 10px;background:var(--el);border:1px solid transparent;border-radius:14px;user-select:none;position:relative}
  .pl .rk{width:26px;font-weight:900;font-size:20px;text-align:right;flex:0 0 auto;letter-spacing:-.8px}
  .pl .th{width:46px;height:46px;border-radius:10px;background:#0b1222 center/cover no-repeat;flex:0 0 auto}
  .pl .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff;font-weight:900;font-size:15px;letter-spacing:-.2px}
  .pl .nm small{display:block;color:var(--muted);font-weight:400;font-size:11px;letter-spacing:0}
  .pl .grip{font-size:20px;color:rgba(255,255,255,.4);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;padding:0 4px;touch-action:none;cursor:grab;-webkit-touch-callout:none}
  .pl .x{background:transparent;border:0;color:var(--muted);font-size:18px;padding:6px 8px}
  .pl.lift{transition:none;z-index:5;background:var(--el2);box-shadow:0 10px 30px rgba(0,0,0,.55);cursor:grabbing}
  /* the coaster being placed: a lifted, draggable row (like the park rank lane) */
  .pl.new{background:rgba(37,99,235,.9);border-color:#60a5fa;color:#fff;touch-action:none;cursor:grab;z-index:5;-webkit-touch-callout:none}
  .pl.new .rk{color:#fff} .pl.new .nm small{color:rgba(255,255,255,.75)} .pl.new .grip{color:rgba(255,255,255,.9)}
  .pl.new.lift{box-shadow:0 0 14px rgba(96,165,250,.7),0 10px 30px rgba(0,0,0,.5)}
  /* the final list: full cards, the photo is the card */
  .placed.big{gap:10px}
  .pl.bc{display:block;position:relative;height:172px;padding:0;border-radius:18px;overflow:hidden;background:#0b1222;border:1px solid rgba(255,255,255,.06)}
  .pl.bc .img{position:absolute;inset:0;background:#0b1222 center/cover no-repeat}
  .pl.bc::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,8,16,.55) 0%,rgba(5,8,16,0) 35%,rgba(5,8,16,0) 45%,rgba(5,8,16,.92) 100%)}
  .pl.bc .rk{position:absolute;left:14px;top:8px;width:auto;font-size:44px;letter-spacing:-2.5px;line-height:1;text-shadow:0 2px 14px rgba(0,0,0,.7)}
  .pl.bc .grip{position:absolute;right:50px;top:10px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:12px;background:rgba(0,0,0,.45);color:#fff;font-size:22px;padding:0}
  .pl.bc .x{position:absolute;right:8px;top:10px;width:36px;height:44px;color:rgba(255,255,255,.7)}
  .pl.bc .bot{position:absolute;left:16px;right:16px;bottom:14px}
  .pl.bc .bot b{display:block;color:#fff;font-size:24px;font-weight:900;letter-spacing:-.6px;line-height:1.05;text-shadow:0 2px 12px rgba(0,0,0,.8)}
  .pl.bc .bot small{display:block;color:rgba(255,255,255,.75);font-size:12px;margin-top:4px;text-shadow:0 1px 6px rgba(0,0,0,.8)}
  .pl.bc.lift{box-shadow:0 0 0 2px var(--accent),0 18px 40px rgba(0,0,0,.6)}
  .verdict.onsite{color:var(--good)} .verdict.onsite small{display:block;font-size:11px;letter-spacing:1px;color:var(--muted);font-weight:500;margin-top:2px}
  /* what the other phone is dragging right now */
  .pl.ghost{background:rgba(37,99,235,.18);border:1px dashed rgba(96,165,250,.7);color:rgba(255,255,255,.85)}
  .pl.ghost .rk{color:var(--blue)} .pl.ghost .nm small{color:var(--blue)}
  .banner{display:flex;align-items:center;gap:12px;margin-top:10px;padding:12px 14px;border-radius:12px;font-size:14px;font-weight:700}
  .banner.dirty{background:rgba(233,130,14,.12);border:1px solid rgba(233,130,14,.45);color:var(--accent-light)}
  .banner.dirty>div{flex:1} .banner.dirty button{white-space:nowrap}
  .banner.ok{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.35);color:var(--good)}
  .banner.ok small{font-weight:400;color:var(--muted);margin-left:auto;font-size:12px}
  /* sticky action bar */
  .act{position:fixed;left:0;right:0;bottom:0;z-index:30;padding:12px 14px calc(12px + env(safe-area-inset-bottom));background:#0a0f1a;border-top:1px solid var(--line);max-height:70vh;overflow:auto}
  .act .in{max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:10px}
  .act .btns{display:flex;gap:8px}
  .act .btns button{flex:1}
  .verdict{text-align:center;font-weight:900;font-size:22px;letter-spacing:1px;padding:6px 0 2px}
  .verdict.match{color:var(--good)} .verdict.split{color:var(--accent-light)}
  .verdict.place{font-size:17px;letter-spacing:0;color:#fff} .verdict.place b{color:var(--blue)}
  .verdict.wait{font-size:17px;letter-spacing:0;color:#fff;font-weight:700}
  .verdict.wait b{color:var(--accent-light)}
  .verdict.wait .dots i{display:inline-block;font-style:normal;animation:blink 1.2s infinite}
  .verdict.wait .dots i:nth-child(2){animation-delay:.3s} .verdict.wait .dots i:nth-child(3){animation-delay:.6s}
  .list.locked .cand{opacity:.35;pointer-events:none;transition:opacity .4s}
  .list.locked .cand.mine{opacity:.85}
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
  /* bottom sheet: one coaster, in the coaster page's grammar (photo first, big figures, thin rules, no boxes) */
  .sheet-bg{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:40;display:none}
  .sheet{position:fixed;left:0;right:0;bottom:0;z-index:41;max-height:92vh;overflow:auto;overscroll-behavior:contain;background:#0b1222;border-radius:20px 20px 0 0;transform:translateY(100%);transition:transform .25s}
  .sheet.open{transform:none} .sheet-bg.open{display:block}
  .sheet .grab{position:absolute;left:50%;top:8px;width:44px;height:5px;margin-left:-22px;border-radius:3px;background:rgba(255,255,255,.5);z-index:3}
  .sheet .close{position:absolute;right:12px;top:12px;z-index:3;width:44px;height:44px;border-radius:50%;background:rgba(0,0,0,.5);color:#fff;font-size:18px;padding:0;border:1px solid rgba(255,255,255,.25);}
  .sh-top{position:sticky;top:0;z-index:4;height:52px;margin-bottom:-52px;display:flex;align-items:center;gap:12px;padding:0 10px 0 18px;background:rgba(11,18,34,.96);border-bottom:1px solid var(--line);opacity:0;pointer-events:none;transition:opacity .15s}
  .sh-top.on{opacity:1;pointer-events:auto}
  .sh-top b{flex:1;min-width:0;color:#fff;font-size:16px;font-weight:900;letter-spacing:-.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sh-top span{font-size:22px;font-weight:900;letter-spacing:-1px}
  .sh-top button{width:44px;height:44px;border-radius:50%;background:transparent;color:#fff;font-size:18px;padding:0}
  .sp-in{background:rgba(255,255,255,.28);color:transparent;border-radius:3px;padding:0 2px;cursor:pointer;user-select:none}
  .sp-in.show{background:rgba(255,255,255,.1);color:#fff}
  .sp-block{position:relative;cursor:pointer}
  .sp-block p{filter:blur(7px);opacity:.6;user-select:none;transition:filter .3s,opacity .3s}
  .sp-block.show p{filter:none;opacity:1}
  .sp-block .sp-tag{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:rgba(255,255,255,.75)}
  .sp-block.show .sp-tag{display:none}
  .sh-hero{position:relative;height:320px;background:#000 center/cover no-repeat;border-radius:20px 20px 0 0;clear:both}
  .sh-hero.none{height:120px;background:var(--el)}
  .sh-hero::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,18,34,.35) 0%,rgba(11,18,34,0) 30%,rgba(11,18,34,0) 50%,rgba(11,18,34,.95) 100%)}
  .sh-hero .ti{position:absolute;left:18px;right:104px;bottom:14px;z-index:1}
  .sh-hero .ti b{display:block;color:#fff;font-size:30px;font-weight:900;letter-spacing:-.8px;line-height:1;text-shadow:0 2px 14px rgba(0,0,0,.7)}
  .sh-hero .ti small{display:block;color:rgba(255,255,255,.8);font-size:12px;margin-top:6px;line-height:1.35;text-shadow:0 1px 6px rgba(0,0,0,.8)}
  .sh-hero .sc{position:absolute;right:18px;bottom:12px;z-index:1;font-size:54px;font-weight:900;letter-spacing:-3px;line-height:1;text-shadow:0 2px 16px rgba(0,0,0,.6)}
  .sh-bd{padding:0 18px}
  .sh-lb{font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:rgba(255,255,255,.5);margin:24px 0 10px}
  .sh-nums{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  .sh-nums b{display:block;font-size:26px;font-weight:900;letter-spacing:-.9px;color:#fff;line-height:1;white-space:nowrap;font-variant-numeric:tabular-nums}
  .sh-nums b i{font-style:normal;font-size:11px;font-weight:400;letter-spacing:0;color:var(--muted);margin-left:2px}
  .sh-nums small{display:block;font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted);margin-top:6px;white-space:nowrap}
  .sh-rows{border-top:1px solid var(--line);margin-top:16px}
  .sh-rows>div{display:flex;justify-content:space-between;align-items:baseline;gap:14px;padding:9px 0;border-bottom:1px solid var(--line);font-size:14px}
  .sh-rows>div span:first-child{color:var(--muted);flex:0 0 auto}
  .sh-rows>div span:last-child{color:#e2e8f0;font-weight:500;text-align:right;font-variant-numeric:tabular-nums;min-width:0}
  .sh-rows>div span:last-child em{font-style:normal;color:var(--accent-light)}
  .sh-notes{color:var(--muted);font-size:13px;line-height:1.5;margin:10px 0 0}
  .sh-hl{border-top:1px solid var(--line)}
  .sh-hl p{font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:rgba(255,255,255,.45);margin:12px 0 2px}
  .sh-hl ul{list-style:none;margin:0;padding:0}
  .sh-hl li{display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:15px;color:#e2e8f0;line-height:1.3}
  .sh-hl li:last-child{border-bottom:0}
  .sh-hl svg{width:16px;height:16px;flex:0 0 auto}
  .sh-hl .up{color:var(--accent)} .sh-hl .dn{color:rgba(255,255,255,.45)} .sh-hl .fl{color:rgba(255,255,255,.3)}
  .sh-photos{display:flex;gap:8px;overflow-x:auto;margin:0 -18px;padding:0 18px 4px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none}
  .sh-photos::-webkit-scrollbar{display:none}
  .sh-photos i{flex:0 0 150px;height:190px;border-radius:12px;background:#000 center/cover no-repeat;scroll-snap-align:start}
  .sh-rev h4{margin:16px 0 4px;font-size:16px;font-weight:900;color:#fff;letter-spacing:-.2px}
  .sh-rev p{margin:0 0 8px;color:rgba(255,255,255,.85);font-size:14px;line-height:1.55}
  .sh-dim{color:var(--muted);font-size:13px}
  .sh-link{display:inline-block;margin:22px 0 4px;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--accent);text-decoration:none}
  .sh-nav{position:sticky;bottom:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:16px;padding:10px 18px calc(12px + env(safe-area-inset-bottom));background:rgba(11,18,34,.96);border-top:1px solid var(--line);}
  .sh-nav button{flex:1;min-width:0;background:transparent;border:0;color:#fff;font:700 14px Roboto,sans-serif;padding:8px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;border-radius:0}
  .sh-nav button:last-child{text-align:right}
  .sh-nav button:disabled{opacity:.25}
  .sh-nav button span{color:var(--accent)}
  .sh-nav small{flex:0 0 auto;color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase}
  /* top bar: who is here and who you are */
  .who{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--muted)}
  .who .other{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
  .who .me{display:inline-flex;align-items:center;gap:6px;background:transparent;border:1px solid rgba(255,255,255,.18);border-radius:100px;padding:5px 10px 5px 11px;color:#fff;font:700 12px Roboto,sans-serif;white-space:nowrap}
  .who .me span{color:var(--accent);font-weight:700;font-size:10px;letter-spacing:1px;text-transform:uppercase}
  .toast{position:fixed;left:50%;bottom:calc(150px + env(safe-area-inset-bottom));transform:translateX(-50%);background:#fff;color:#0c0c0c;font-weight:700;padding:10px 16px;border-radius:100px;z-index:50;opacity:0;transition:opacity .2s;pointer-events:none}
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
<script src="/tiebreak.js?v=18"></script>
</body></html>`;

export async function GET(req: NextRequest) {
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" };
  if (!(await isAdminRequest(req))) return new NextResponse(loginPage, { headers });
  return new NextResponse(appPage, { headers });
}
