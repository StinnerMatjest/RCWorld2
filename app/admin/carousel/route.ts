import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/app/lib/adminAuth";
import { CAROUSEL_SLUG_RE, carouselHash, loadCarousel } from "@/app/lib/carouselStore";

// Instagram carousel review tool for admins.
//   /admin/carousel            dashboard: carousels, templates, new-from-template
//   /admin/carousel?slug=x     editor for one carousel (photos, text, slides, export)
// The stored carousel HTML is served with the editor injected. Edits save to
// /api/carousel and every open editor reloads when someone else saves, so two
// people can review the same post. Export renders JPEGs in the browser.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { inject } = require("@/app/lib/carouselEditor.cjs") as {
  inject: (html: string, opts?: Record<string, unknown>) => string;
};

const SLUG_RE = CAROUSEL_SLUG_RE;

const shell = (title: string, body: string, wide = false) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
  :root{--accent:#e9820e;--bg:#0f172a;--el:#16223c}
  body{margin:0;min-height:100vh;background:var(--bg);color:#e2e8f0;font:14px/1.5 Roboto,sans-serif;display:flex;align-items:${wide ? "flex-start" : "center"};justify-content:center;padding:${wide ? "40px 16px" : "0 16px"};box-sizing:border-box}
  .card{width:${wide ? "min(900px,100%)" : "360px"};background:var(--el);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:26px 28px;box-shadow:0 20px 60px rgba(0,0,0,.5);box-sizing:border-box}
  h1{font-size:15px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 4px;color:#fff}
  h1 span,h2 span{color:var(--accent)}
  h2{font-size:11px;font-weight:900;letter-spacing:1.8px;text-transform:uppercase;color:rgba(255,255,255,.55);margin:26px 0 10px}
  p{margin:0 0 16px;color:rgba(255,255,255,.65)}
  input,select{width:100%;box-sizing:border-box;font:14px Roboto,sans-serif;padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:var(--bg);color:#fff;margin-bottom:12px}
  button{font:700 13px Roboto,sans-serif;letter-spacing:.5px;padding:10px 16px;border-radius:100px;border:none;background:var(--accent);color:#0c0c0c;cursor:pointer}
  button.sec{background:transparent;border:1.5px solid rgba(255,255,255,.3);color:rgba(255,255,255,.85)}
  button.danger{background:transparent;border:1.5px solid rgba(248,113,113,.5);color:#f87171}
  button.sm{padding:6px 12px;font-size:12px}
  .err{color:#f87171;font-size:12px;min-height:18px;margin-top:8px}
  table{width:100%;border-collapse:collapse}
  td,th{text-align:left;padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.08);vertical-align:middle}
  th{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.45);font-weight:700}
  td.name a{color:#fff;font-weight:700;text-decoration:none}
  td.name a:hover{color:var(--accent)}
  td .meta{font-size:11px;color:rgba(255,255,255,.45)}
  td.ops{text-align:right;white-space:nowrap}
  td.ops button{margin-left:6px}
  .row{display:flex;gap:10px;align-items:flex-end}
  .row>div{flex:1}
  .row label{display:block;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:6px;font-weight:700}
  .row button{margin-bottom:12px;white-space:nowrap}
  .empty{color:rgba(255,255,255,.45);padding:14px 8px;font-style:italic}
</style></head><body>${body}</body></html>`;

const loginPage = shell(
  "Parkrating carousel tool",
  `<form class="card" onsubmit="return login(event)">
    <h1><span>Parkrating</span> carousel tool</h1>
    <p>Enter the admin password to continue.</p>
    <input type="password" id="pw" placeholder="Admin password" autofocus autocomplete="current-password">
    <button type="submit" style="width:100%">Open</button>
    <div class="err" id="err"></div>
  </form>
  <script>
    async function login(e){e.preventDefault();const err=document.getElementById('err');err.textContent='';
      const r=await fetch('/api/authenticate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.getElementById('pw').value})});
      if(r.ok){location.reload();}else{err.textContent='Wrong password';}return false;}
  </script>`
);

const dashboard = shell(
  "Parkrating carousel tool",
  `<div class="card">
    <h1><span>Parkrating</span> carousel tool</h1>
    <p>Instagram carousels for review. Open one to change photos, text and slides. Everyone with the admin password sees the same version.</p>

    <h2>New carousel</h2>
    <div class="row">
      <div><label>Name</label><input id="new-name" placeholder="e.g. Parc Astérix 5 reasons"></div>
      <div style="max-width:260px"><label>Template</label><select id="new-tpl"></select></div>
      <button onclick="createNew()">Create</button>
    </div>
    <div class="err" id="err"></div>

    <h2>Carousels</h2>
    <table><thead><tr><th>Name</th><th>Slides</th><th>Updated</th><th></th></tr></thead><tbody id="list"><tr><td colspan="4" class="empty">Loading…</td></tr></tbody></table>

    <h2>Templates</h2>
    <p style="font-size:12px">A template is a carousel used as the starting point for new ones. Set new templates up in Claude Code, then mark them here. Templates can be opened and edited like any carousel.</p>
    <table><thead><tr><th>Name</th><th>Slides</th><th>Updated</th><th></th></tr></thead><tbody id="tpls"><tr><td colspan="4" class="empty">Loading…</td></tr></tbody></table>

    <h2>Import</h2>
    <div class="row">
      <div><label>Carousel HTML file (from Claude Code)</label><input type="file" id="imp-file" accept=".html,text/html"></div>
      <div style="max-width:260px"><label>Name</label><input id="imp-name" placeholder="Name"></div>
      <button class="sec" onclick="importFile(false)">Import</button>
      <button class="sec" onclick="importFile(true)">Import as template</button>
    </div>
  </div>
  <script>
    const slugify=s=>s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);
    const fmt=d=>{const t=new Date(d);return t.toLocaleDateString()+' '+t.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});};
    const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    let data={carousels:[],templates:[]};
    function row(x,isTpl){return '<tr><td class="name"><a href="/admin/carousel?slug='+x.slug+'">'+esc(x.name||x.slug)+'</a><div class="meta">'+x.slug+'</div></td><td>'+x.slides+'</td><td class="meta">'+fmt(x.updated_at)+'</td><td class="ops">'
      +'<button class="sm sec" onclick="rename(\\''+x.slug+'\\')">Rename</button>'
      +'<button class="sm sec" onclick="dup(\\''+x.slug+'\\')">Duplicate</button>'
      +(isTpl?'<button class="sm sec" onclick="flag(\\''+x.slug+'\\',0)">Unmark template</button>':'<button class="sm sec" onclick="flag(\\''+x.slug+'\\',1)">Make template</button>')
      +'<button class="sm danger" onclick="del(\\''+x.slug+'\\')">Delete</button></td></tr>';}
    async function load(){
      const r=await fetch('/api/carousel?list=1');if(!r.ok){document.getElementById('err').textContent='Could not load list ('+r.status+')';return;}
      data=await r.json();
      document.getElementById('list').innerHTML=data.carousels.map(x=>row(x,false)).join('')||'<tr><td colspan="4" class="empty">No carousels yet. Create one from a template above.</td></tr>';
      document.getElementById('tpls').innerHTML=data.templates.map(x=>row(x,true)).join('')||'<tr><td colspan="4" class="empty">No templates yet. Import one, or mark a carousel as a template.</td></tr>';
      document.getElementById('new-tpl').innerHTML=data.templates.map(x=>'<option value="'+x.slug+'">'+esc(x.name||x.slug)+'</option>').join('')||'<option value="">No templates yet</option>';
    }
    async function post(url,body){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'text/html'},body:body||''});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j;}
    async function createNew(){const err=document.getElementById('err');err.textContent='';
      const name=document.getElementById('new-name').value.trim();const tpl=document.getElementById('new-tpl').value;
      if(!name)return err.textContent='Give it a name';if(!tpl)return err.textContent='Pick a template';
      const slug=slugify(name)||('carousel-'+Date.now());
      try{await post('/api/carousel?slug='+slug+'&from='+tpl+'&name='+encodeURIComponent(name));location.href='/admin/carousel?slug='+slug;}catch(e){err.textContent=e.message;}}
    async function dup(slug){const x=[...data.carousels,...data.templates].find(c=>c.slug===slug);const name=prompt('Name for the copy',(x.name||slug)+' copy');if(!name)return;
      const ns=slugify(name);try{await post('/api/carousel?slug='+ns+'&from='+slug+'&name='+encodeURIComponent(name));load();}catch(e){document.getElementById('err').textContent=e.message;}}
    async function rename(slug){const x=[...data.carousels,...data.templates].find(c=>c.slug===slug);const name=prompt('New name',x.name||slug);if(!name)return;
      try{await post('/api/carousel?slug='+slug+'&rename='+encodeURIComponent(name));load();}catch(e){document.getElementById('err').textContent=e.message;}}
    async function flag(slug,v){try{await post('/api/carousel?slug='+slug+'&template='+v);load();}catch(e){document.getElementById('err').textContent=e.message;}}
    async function del(slug){if(!confirm('Delete "'+slug+'"? This cannot be undone.'))return;
      const r=await fetch('/api/carousel?slug='+slug,{method:'DELETE'});if(!r.ok)document.getElementById('err').textContent='Delete failed';load();}
    async function importFile(asTpl){const err=document.getElementById('err');err.textContent='';
      const f=document.getElementById('imp-file').files[0];const name=document.getElementById('imp-name').value.trim();
      if(!f)return err.textContent='Pick a file';if(!name)return err.textContent='Give it a name';
      const slug=slugify(name);const html=await f.text();
      try{await post('/api/carousel?slug='+slug+'&name='+encodeURIComponent(name)+(asTpl?'&template=1':''),html);document.getElementById('imp-name').value='';document.getElementById('imp-file').value='';load();}catch(e){err.textContent=e.message;}}
    load();
  </script>`,
  true
);

export async function GET(req: NextRequest) {
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
  if (!(await isAdminRequest(req))) return new NextResponse(loginPage, { headers });

  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return new NextResponse(dashboard, { headers });
  if (!SLUG_RE.test(slug)) return new NextResponse("Bad slug", { status: 400 });

  const row = await loadCarousel(slug);
  if (!row) {
    return new NextResponse(
      shell("Not found", `<div class="card"><h1>Not found</h1><p>No carousel called <span style="color:#e9820e">${slug}</span>.</p><a href="/admin/carousel" style="color:#fff">Back to the list</a></div>`),
      { status: 404, headers }
    );
  }

  const api = `/api/carousel?slug=${slug}`;
  const html = inject(row.html, {
    gallery: "[]",
    sync: {
      hash: carouselHash(row.html),
      slug,
      name: row.name || slug,
      isTemplate: row.is_template,
      saveUrl: api,
      versionUrl: `${api}&v=1`,
      exportUrl: false,
      clientExport: true,
      imgProxy: "/api/carousel/img?u=",
      galleryApi: true,
      backUrl: "/admin/carousel",
    },
  });
  return new NextResponse(html, { headers });
}
