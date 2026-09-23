// Carousel editor for the Instagram review tool: injects the photo picker, drag/zoom crop, text editing,
// winner toggle, slide management, live sync and in-browser export into a carousel HTML document.
// Served by app/admin/carousel/route.ts. Generated from make_editor.cjs + editor_ext.js (Claude Code tooling).
const fs=require("fs");
const path=require("path");
const gallery="[]"; // on the site the editor loads galleries from /api/park/<id>/gallery
const editorExt="// Editor extension: slide management (add / delete / reorder / renumber), template prototypes,\n// and in-browser Instagram export (JPEG zip). Talks to the core editor through window.__ed.\n(function(){\n  const E=window.__ed; if(!E) return;\n  const SYNC=window.ED_SYNC||{};\n  const TYPES=[[\"hook\",\"Hook\"],[\"round\",\"Round\"],[\"tie\",\"Draw round\"],[\"final\",\"Final\"]];\n  const typeOf=s=>s.classList.contains(\"hook\")?\"hook\":s.classList.contains(\"final\")?\"final\":s.classList.contains(\"tie\")?\"tie\":\"round\";\n  const status=document.getElementById(\"ed-status\");\n\n  // ---- prototypes: one clean copy of each slide type, stored in the document so they survive export and deletion\n  function protoStore(){let t=document.getElementById(\"slide-prototypes\");if(!t){t=document.createElement(\"template\");t.id=\"slide-prototypes\";document.body.appendChild(t);}return t;}\n  function cleanClone(s){\n    const c=s.cloneNode(true);\n    c.querySelectorAll(\".ed-bar\").forEach(n=>n.remove());\n    c.querySelectorAll(\"[contenteditable]\").forEach(n=>{n.removeAttribute(\"contenteditable\");n.removeAttribute(\"spellcheck\");});\n    c.querySelectorAll(\"[data-ed-bound]\").forEach(n=>delete n.dataset.edBound);\n    c.classList.remove(\"ed-selected\");\n    c.querySelectorAll(\".ed-selected,.ed-has-sel,.ed-dragging\").forEach(n=>n.classList.remove(\"ed-selected\",\"ed-has-sel\",\"ed-dragging\"));\n    c.querySelectorAll(\".logo-slot\").forEach(n=>n.innerHTML=\"\");\n    return c;\n  }\n  function capturePrototypes(){const st=protoStore();E.slides().forEach(s=>{const t=typeOf(s);if(!st.content.querySelector('[data-proto=\"'+t+'\"]')){const c=cleanClone(s);c.setAttribute(\"data-proto\",t);st.content.appendChild(c);}});}\n  function protoFor(t){capturePrototypes();const p=protoStore().content.querySelector('[data-proto=\"'+t+'\"]');if(!p)return null;const c=p.cloneNode(true);c.removeAttribute(\"data-proto\");return c;}\n  function relogo(root){const tpl=document.getElementById(\"pr-logo\");if(!tpl)return;root.querySelectorAll(\".logo-slot\").forEach(s=>{s.innerHTML=\"\";s.appendChild(tpl.content.firstElementChild.cloneNode(true));});}\n\n  // ---- numbering: progress labels, fill widths, \"Round X of Y\" eyebrows, slide numbers in the bars\n  function renumber(){\n    const all=E.slides();const n=all.length;let round=0;\n    const rounds=all.filter(s=>typeOf(s)===\"round\"||typeOf(s)===\"tie\").length;\n    all.forEach((s,i)=>{\n      const l=s.querySelector(\".progress-label\");if(l)l.textContent=(i+1)+\"/\"+n;\n      const f=s.querySelector(\".progress-fill\");if(f)f.style.width=((i+1)/n*100).toFixed(1)+\"%\";\n      const t=typeOf(s);\n      if(t===\"round\"||t===\"tie\"){round++;const e=s.querySelector(\".eyebrow\");if(e&&/^Round \\d+ of \\d+/i.test(e.textContent))e.innerHTML=e.innerHTML.replace(/^Round \\d+ of \\d+/i,\"Round \"+round+\" of \"+rounds);}\n      const num=s.querySelector(\".ed-bar > span\");if(num)num.textContent=\"SLIDE \"+(i+1);\n    });\n  }\n  function addSlide(after,type){\n    const c=protoFor(type);if(!c){status.textContent=\"this template has no \"+type+\" slide\";return;}\n    relogo(c);after.after(c);E.init();renumber();E.save();\n    c.scrollIntoView({block:\"center\",behavior:\"smooth\"});\n  }\n  function delSlide(s){\n    if(E.slides().length<=1)return;\n    if(!confirm(\"Delete slide \"+(E.slides().indexOf(s)+1)+\"?\"))return;\n    capturePrototypes();s.remove();renumber();E.save();\n  }\n  function move(s,d){\n    const all=E.slides();const i=all.indexOf(s);const j=i+d;if(j<0||j>=all.length)return;\n    if(d<0)all[j].before(s);else all[j].after(s);\n    renumber();E.save();s.scrollIntoView({block:\"center\",behavior:\"smooth\"});\n  }\n  function decorate(){\n    E.slides().forEach(s=>{\n      const bar=s.querySelector(\".ed-bar\");if(!bar||bar.querySelector(\".ed-ops\"))return;\n      const mk=(txt,title,fn)=>{const b=document.createElement(\"button\");b.textContent=txt;b.title=title;b.onclick=e=>{e.stopPropagation();fn();};return b;};\n      const ops=document.createElement(\"div\");ops.className=\"ed-ops\";\n      ops.appendChild(mk(\"◀\",\"Move left\",()=>move(s,-1)));\n      ops.appendChild(mk(\"▶\",\"Move right\",()=>move(s,1)));\n      const add=document.createElement(\"div\");add.className=\"ed-add\";\n      add.appendChild(mk(\"+ SLIDE\",\"Add a slide after this one\",()=>{document.querySelectorAll(\".ed-add.open\").forEach(o=>{if(o!==add)o.classList.remove(\"open\");});add.classList.toggle(\"open\");}));\n      const menu=document.createElement(\"div\");menu.className=\"ed-menu\";\n      TYPES.forEach(([t,label])=>menu.appendChild(mk(label,\"\",()=>{add.classList.remove(\"open\");addSlide(s,t);})));\n      add.appendChild(menu);ops.appendChild(add);\n      ops.appendChild(mk(\"✕\",\"Delete slide\",()=>delSlide(s)));\n      bar.insertBefore(ops,bar.children[1]||null);\n    });\n  }\n  document.addEventListener(\"mousedown\",e=>{if(!e.target.closest(\".ed-add\"))document.querySelectorAll(\".ed-add.open\").forEach(o=>o.classList.remove(\"open\"));},true);\n  const origInit=E.init;E.init=function(){origInit();decorate();};\n  capturePrototypes();decorate();renumber();\n\n  // ---- Instagram export in the browser: each slide -> 1080x1350 JPEG -> one zip\n  function loadScript(src){return new Promise((res,rej)=>{if(document.querySelector('script[src=\"'+src+'\"]'))return res();const s=document.createElement(\"script\");s.src=src;s.id=\"editor-libs\";s.onload=res;s.onerror=()=>rej(new Error(\"failed to load \"+src));document.head.appendChild(s);});}\n  // photo -> data URL through the same-origin proxy, so the renderer never has to fetch cross-origin\n  const dataCache=new Map();\n  async function toDataUrl(u){\n    if(dataCache.has(u))return dataCache.get(u);\n    const proxied=(SYNC.imgProxy&&/^https?:/.test(u))?SYNC.imgProxy+encodeURIComponent(u):u;\n    const blob=await (await fetch(proxied)).blob();\n    const d=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(blob);});\n    dataCache.set(u,d);return d;\n  }\n  async function exportZip(){\n    const btn=document.getElementById(\"ed-export-btn\");btn.disabled=true;\n    try{\n      status.textContent=\"loading export libraries\";\n      await loadScript(\"https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js\");\n      await loadScript(\"https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js\");\n      E.select(null);document.body.classList.add(\"ed-exporting\");\n      const slides=E.slides();const zip=new JSZip();const scale=1080/420;\n      let fontCss=null;\n      for(let i=0;i<slides.length;i++){\n        const s=slides[i];status.textContent=\"rendering slide \"+(i+1)+\" of \"+slides.length;\n        const photos=[...s.querySelectorAll(\".photo-bg,.hero,.inset .ph\")];const saved=photos.map(p=>p.style.backgroundImage);\n        for(const p of photos){\n          const m=p.style.backgroundImage.match(/url\\([\"']?(.*?)[\"']?\\)/);\n          if(m&&!/^data:/.test(m[1])){try{p.style.backgroundImage=\"url('\"+(await toDataUrl(m[1]))+\"')\";}catch(e){console.warn(\"photo not embedded\",m[1],e);}}\n        }\n        try{\n          if(fontCss===null)fontCss=await htmlToImage.getFontEmbedCSS(s).catch(()=>\"\");\n          const dataUrl=await htmlToImage.toJpeg(s,{width:420,height:525,pixelRatio:scale,quality:0.95,fontEmbedCSS:fontCss,filter:n=>!(n.classList&&(n.classList.contains(\"ed-bar\")||n.id===\"ed-preview\"))});\n          zip.file(\"slide_\"+String(i+1).padStart(2,\"0\")+\".jpg\",dataUrl.split(\",\")[1],{base64:true});\n        }finally{photos.forEach((p,k)=>p.style.backgroundImage=saved[k]);}\n      }\n      status.textContent=\"zipping\";\n      const blob=await zip.generateAsync({type:\"blob\"});\n      const a=document.createElement(\"a\");a.href=URL.createObjectURL(blob);a.download=(SYNC.slug||\"carousel\")+\"-instagram.zip\";a.click();\n      status.textContent=\"exported \"+slides.length+\" slides\";\n    }catch(e){console.error(e);status.textContent=\"export failed: \"+e.message;}\n    finally{document.body.classList.remove(\"ed-exporting\");btn.disabled=false;}\n  }\n  if(SYNC.clientExport){\n    const b=document.createElement(\"button\");b.className=\"sec\";b.id=\"ed-export-btn\";b.textContent=\"Export for Instagram\";b.onclick=exportZip;\n    document.getElementById(\"ed-stick-btn\").after(b);\n  }\n  // site chrome: back link and the carousel's name\n  if(SYNC.backUrl){\n    const ui=document.getElementById(\"editor-ui\");const first=ui.firstElementChild;\n    const a=document.createElement(\"a\");a.href=SYNC.backUrl;a.textContent=\"← All carousels\";a.style.cssText=\"color:rgba(255,255,255,.75);text-decoration:none;font-size:12px;margin-right:6px\";\n    ui.insertBefore(a,first);\n    if(SYNC.name){const n=document.createElement(\"span\");n.textContent=SYNC.name+(SYNC.isTemplate?\" (template)\":\"\");n.style.cssText=\"color:#fff;font-weight:700;font-size:12px\";first.after(n);}\n  }\n  // ---- text tools: select words in any text field, make them orange (or plain again)\n  const tools=document.createElement(\"div\");tools.id=\"ed-texttools\";\n  tools.innerHTML='<span>Selected words:</span><button data-act=\"orange\" title=\"Ctrl+B also works\">ORANGE</button><button class=\"sec\" data-act=\"plain\">PLAIN</button>';\n  document.body.appendChild(tools);\n  let activeField=null,hideT=null;\n  function placeTools(el){const r=el.getBoundingClientRect();tools.style.display=\"flex\";tools.style.left=Math.max(8,r.left)+\"px\";tools.style.top=Math.max(52,r.top-40)+\"px\";}\n  document.addEventListener(\"focusin\",e=>{const el=e.target;if(el&&el.isContentEditable&&el.closest(\".slide\")){clearTimeout(hideT);activeField=el;placeTools(el);}});\n  document.addEventListener(\"focusout\",e=>{if(e.target===activeField){hideT=setTimeout(()=>{tools.style.display=\"none\";activeField=null;},150);}});\n  tools.addEventListener(\"mousedown\",e=>e.preventDefault()); // keep the field focused and the selection alive\n  tools.addEventListener(\"click\",e=>{\n    const act=e.target.dataset&&e.target.dataset.act;if(!act||!activeField)return;\n    const sel=window.getSelection();if(!sel||sel.rangeCount===0||sel.isCollapsed){status.textContent=\"select the words first\";return;}\n    const range=sel.getRangeAt(0);if(!activeField.contains(range.commonAncestorContainer))return;\n    if(act===\"orange\"){\n      // unwrap any existing <b> inside the selection, then wrap the selection in one <b>\n      const frag=range.extractContents();frag.querySelectorAll&&frag.querySelectorAll(\"b,strong\").forEach(n=>n.replaceWith(...n.childNodes));\n      const b=document.createElement(\"b\");b.appendChild(frag);range.insertNode(b);\n      // merge with a directly adjacent <b> on either side\n      [b.previousSibling,b.nextSibling].forEach(s=>{if(s&&s.nodeType===1&&s.tagName===\"B\"){if(s===b.previousSibling){b.insertBefore(document.createTextNode(\"\"),b.firstChild);while(s.firstChild)b.insertBefore(s.firstChild,b.firstChild);}else{while(s.firstChild)b.appendChild(s.firstChild);}s.remove();}});\n      sel.removeAllRanges();const r2=document.createRange();r2.selectNodeContents(b);sel.addRange(r2);\n    }else{\n      // plain: split every <b> that overlaps the selection and drop the wrapper around the selected part\n      const bs=[...activeField.querySelectorAll(\"b,strong\")].filter(n=>range.intersectsNode(n));\n      bs.forEach(n=>{const nr=document.createRange();nr.selectNodeContents(n);\n        const before=range.compareBoundaryPoints(Range.START_TO_START,nr)>0?(()=>{const r=document.createRange();r.setStart(nr.startContainer,nr.startOffset);r.setEnd(range.startContainer,range.startOffset);return r.extractContents();})():null;\n        const after=range.compareBoundaryPoints(Range.END_TO_END,nr)<0?(()=>{const r=document.createRange();r.setStart(range.endContainer,range.endOffset);r.setEnd(nr.endContainer,nr.endOffset);return r.extractContents();})():null;\n        const parent=n.parentNode;\n        if(before&&before.textContent){const bb=document.createElement(\"b\");bb.appendChild(before);parent.insertBefore(bb,n);}\n        while(n.firstChild)parent.insertBefore(n.firstChild,n);\n        if(after&&after.textContent){const ab=document.createElement(\"b\");ab.appendChild(after);parent.insertBefore(ab,n);}\n        n.remove();});\n    }\n    activeField.normalize();E.save();\n  });\n  window.__edExt={renumber,addSlide,delSlide,move,exportZip,typeOf};\n})();\n";

const editorCss=`
<style id="editor-css">
  body { padding: 100px 400px 80px 0; align-items: stretch; scroll-padding-top: 90px; }
  .ig-frame { width: auto; max-width: none; background: transparent; box-shadow: none; border-radius: 0; margin: 0 auto; overflow: visible !important; }
  .ig-header, .ig-caption, .export-bar { display: none !important; }
  .carousel-viewport { width: auto !important; height: auto !important; overflow: visible !important; cursor: default !important; }
  .carousel-track { flex-wrap: wrap; gap: 44px 20px; justify-content: center; transform: none !important; transition: none !important; height: auto !important; padding: 30px 20px 0; }
  .carousel-track .slide { outline: 1px solid rgba(255,255,255,0.08); box-shadow: 0 8px 30px rgba(0,0,0,0.5); overflow: visible !important; }
  .slide > .grain::after { display: none; }
  .slide .ed-bar { position: absolute; top: -26px; left: 0; right: 0; height: 22px; display: flex; align-items: center; gap: 6px; font: 700 10px/1 Roboto, sans-serif; letter-spacing: 1px; color: rgba(255,255,255,0.6); z-index: 50; }
  .slide .ed-bar .ed-w { margin-left: auto; display: flex; gap: 4px; }
  .slide .ed-bar button { font: 700 9px Roboto, sans-serif; letter-spacing: 0.8px; padding: 4px 8px; border-radius: 100px; border: 1px solid rgba(255,255,255,0.25); background: transparent; color: rgba(255,255,255,0.7); cursor: pointer; pointer-events: auto !important; }
  .slide .ed-bar button.on { background: #e9820e; border-color: #e9820e; color: #0c0c0c; }
  /* the slide is a canvas: only photos and text fields take the mouse */
  .slide, .slide * { pointer-events: none !important; }
  .slide .ed-bar, .slide .ed-bar * { pointer-events: auto !important; }
  .slide .photo-bg, .slide .hero, .slide .inset .ph { pointer-events: auto !important; cursor: grab; }
  .slide [contenteditable="true"] { pointer-events: auto !important; cursor: text; outline: 1px dashed transparent; outline-offset: 2px; transition: outline-color .15s; }
  .slide [contenteditable="true"]:hover { outline-color: rgba(248,148,30,0.55); }
  .slide [contenteditable="true"]:focus { outline: 1.5px solid #f8941e; background: rgba(15,23,42,0.35); }
  .slide .sticker { pointer-events: auto !important; cursor: move; }
  .slide .sticker:hover { box-shadow: 0 0 0 2px #fff, 0 2px 6px rgba(0,0,0,0.35); }
  .slide .photo-bg:hover, .slide .hero:hover, .slide .inset .ph:hover { outline: 2px dashed rgba(248,148,30,0.9); outline-offset: -2px; }
  .slide .ed-selected { outline: 3px solid #f8941e !important; outline-offset: -3px; }
  .slide .ed-dragging { cursor: grabbing !important; }
  /* clip-path hides the outline on the halves; show a corner tag instead */
  .slide .vs-half.ed-has-sel::before { content: 'SELECTED'; position: absolute; z-index: 60; left: 8px; font: 900 8px Roboto, sans-serif; letter-spacing: 1.5px; color: #0c0c0c; background: #f8941e; padding: 3px 6px 2px; border-radius: 3px; }
  .slide .vs-top.ed-has-sel::before { top: 62px; }
  .slide .vs-bottom.ed-has-sel::before { bottom: 62px; }

  #editor-ui { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; display: flex; gap: 10px; align-items: center; padding: 10px 16px; background: rgba(10,15,26,0.97); border-bottom: 1px solid rgba(255,255,255,0.12); font: 12px/1.4 Roboto, sans-serif; color: #e2e8f0; }
  #editor-ui b { color: #f8941e; }
  #editor-ui button { font: 500 12px Roboto, sans-serif; padding: 7px 14px; border-radius: 100px; border: none; cursor: pointer; background: #e9820e; color: #0c0c0c; }
  #editor-ui button.sec { background: transparent; border: 1.5px solid rgba(255,255,255,0.35); color: rgba(255,255,255,0.85); }
  #editor-ui #ed-save-btn { background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.6); min-width: 118px; }
  #editor-ui #ed-save-btn.dirty { background: #e9820e; color: #0c0c0c; box-shadow: 0 0 0 3px rgba(233,130,14,0.25); }
  #editor-ui .hint { opacity: 0.7; margin-left: auto; font-size: 11px; }
  #ed-status { font-size: 11px; color: rgba(255,255,255,0.55); min-width: 120px; }

  #ed-gallery { position: fixed; top: 46px; right: 0; bottom: 0; width: 390px; z-index: 999; background: #0a0f1a; border-left: 1px solid rgba(255,255,255,0.12); display: flex; flex-direction: column; font: 12px Roboto, sans-serif; color: #e2e8f0; }
  #ed-gallery .g-head { padding: 12px 14px 8px; border-bottom: 1px solid rgba(255,255,255,0.1); }
  #ed-gallery .g-title { font-weight: 700; font-size: 12px; letter-spacing: 0.5px; margin-bottom: 8px; color: #fff; }
  #ed-gallery .g-title span { color: #f8941e; }
  #ed-gallery .g-tabs { display: flex; gap: 6px; margin-bottom: 8px; }
  #ed-gallery .g-tabs button { flex: 1; font: 700 10px Roboto, sans-serif; letter-spacing: 1px; padding: 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: transparent; color: rgba(255,255,255,0.7); cursor: pointer; }
  #ed-gallery .g-tabs button.on { background: #e9820e; color: #0c0c0c; border-color: #e9820e; }
  #ed-gallery input { width: 100%; box-sizing: border-box; font: 12px Roboto, sans-serif; padding: 7px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: #111827; color: #fff; }
  #ed-gallery .g-grid { flex: 1; min-height: 160px; overflow-y: auto; padding: 10px; display: grid; grid-template-columns: repeat(3, 1fr); grid-auto-rows: max-content; gap: 8px; align-content: start; }
  #ed-gallery .g-item { cursor: pointer; border-radius: 6px; overflow: hidden; background: #111827; border: 2px solid transparent; }
  #ed-gallery .g-item:hover { border-color: rgba(248,148,30,0.7); }
  #ed-gallery .g-item.cur { border-color: #f8941e; }
  #ed-gallery .g-item .im { width: 100%; height: 82px; background-size: cover; background-position: center; }
  #ed-gallery .g-item .t { font-size: 9px; line-height: 1.25; padding: 4px 5px 5px; color: rgba(255,255,255,0.75); height: 24px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  #ed-gallery .g-empty { padding: 20px 14px; color: rgba(255,255,255,0.5); line-height: 1.5; }
  #ed-crop { border-bottom: 1px solid rgba(255,255,255,0.1); padding: 10px 10px 8px; }
  #ed-crop .c-wrap { position: relative; width: fit-content; max-width: 100%; margin: 0 auto; background: #000; border-radius: 6px; overflow: hidden; user-select: none; line-height: 0; }
  #ed-crop .c-img { display: block; max-width: 100%; max-height: 190px; width: auto; height: auto; pointer-events: none; }
  #ed-crop .c-rect { position: absolute; border: 2px solid #f8941e; box-sizing: border-box; box-shadow: 0 0 0 9999px rgba(0,0,0,0.6); cursor: move; }
  #ed-crop .c-zoom { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 11px; color: rgba(255,255,255,0.75); }
  #ed-crop .c-zoom input { flex: 1; accent-color: #f8941e; }
  #ed-crop .c-hint { font-size: 10px; line-height: 1.3; color: rgba(255,255,255,0.45); margin-top: 4px; }
  #ed-preview { position: fixed; right: 400px; top: 60px; z-index: 1001; display: none; background: #0a0f1a; padding: 6px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 16px 50px rgba(0,0,0,0.7); pointer-events: none; }
  #ed-preview img { display: block; width: 640px; height: 480px; object-fit: contain; background: #000; border-radius: 4px; }
  #ed-preview .pv-t { font: 500 11px Roboto, sans-serif; color: rgba(255,255,255,0.8); padding: 6px 4px 2px; max-width: 640px; }
  #ed-readout { padding: 8px 14px; font: 11px/1.5 monospace; color: rgba(255,255,255,0.7); border-top: 1px solid rgba(255,255,255,0.1); white-space: pre; }
  /* slide operations in the bar above each slide */
  .slide .ed-bar .ed-ops { display: flex; align-items: center; gap: 4px; margin-left: 10px; position: relative; }
  .slide .ed-bar .ed-ops button { padding: 3px 7px; }
  .slide .ed-bar .ed-add { position: relative; }
  .slide .ed-bar .ed-add .ed-menu { display: none; position: absolute; top: 22px; left: 0; z-index: 200; background: #0a0f1a; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 6px; flex-direction: column; gap: 4px; min-width: 120px; box-shadow: 0 10px 30px rgba(0,0,0,0.6); }
  .slide .ed-bar .ed-add.open .ed-menu { display: flex; }
  .slide .ed-bar .ed-add .ed-menu button { width: 100%; text-align: left; border-radius: 6px; }
  /* export pass: strip editor chrome from the rendered slide */
  .ed-exporting .carousel-track .slide { outline: none !important; box-shadow: none !important; overflow: hidden !important; }
  .ed-exporting .slide [contenteditable="true"] { outline: none !important; background: transparent !important; }
  .ed-exporting .slide .photo-bg, .ed-exporting .slide .hero, .ed-exporting .slide .inset .ph, .ed-exporting .slide .sticker { outline: none !important; box-shadow: none !important; }
  .ed-exporting .slide .vs-half.ed-has-sel::before { display: none; }
  #ed-texttools { position: fixed; z-index: 1002; display: none; gap: 6px; align-items: center; padding: 5px 8px; background: #0a0f1a; border: 1px solid rgba(255,255,255,0.2); border-radius: 100px; box-shadow: 0 8px 24px rgba(0,0,0,0.6); font: 11px Roboto, sans-serif; color: rgba(255,255,255,0.6); }
  #ed-texttools button { font: 700 10px Roboto, sans-serif; letter-spacing: 1px; padding: 5px 10px; border-radius: 100px; border: none; cursor: pointer; background: #e9820e; color: #0c0c0c; }
  #ed-texttools button.sec { background: transparent; border: 1px solid rgba(255,255,255,0.3); color: rgba(255,255,255,0.85); }
  #ed-json { display: none; position: fixed; bottom: 14px; left: 16px; z-index: 1000; width: 460px; height: 140px; font: 10px/1.3 monospace; background: #0a0f1a; color: #cbd5e1; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 8px; }
</style>`;

const editorUi=`
<div id="editor-ui">
  <span><b>Carousel editor</b></span>
  <button id="ed-save-btn" style="display:none">Saved</button>
  <button class="sec" onclick="edDownload()">Download HTML</button>
  <button class="sec" onclick="edCopyJson()">Copy positions</button>
  <button class="sec" onclick="edToggleStickers()" id="ed-stick-btn">WIN stickers: on</button>
  <button class="sec" onclick="edRestore()" id="ed-restore-btn" style="display:none">Restore last draft</button>
  <span id="ed-status"></span>
  <span class="hint">Click a photo to select it: then pick another from the gallery, drag to move, wheel to zoom, double-click to reset. Click any text to edit.</span>
</div>
<div id="ed-gallery">
  <div class="g-head">
    <div class="g-title" id="g-title">Click a photo on a slide to replace it</div>
    <div class="g-tabs"><button data-park="AW" onclick="edTab('AW')">ADVENTURE WORLD</button><button data-park="DLP" onclick="edTab('DLP')">DISNEYLAND PARK</button></div>
    <input id="g-search" placeholder="Search photo titles..." oninput="edRenderGallery()">
  </div>
  <div id="ed-crop" style="display:none">
    <div class="c-wrap" id="c-wrap"><img class="c-img" id="c-img" alt=""><div class="c-rect" id="c-rect"></div></div>
    <div class="c-zoom"><span>Zoom</span><input type="range" id="c-zoom" min="1" max="3" step="0.01" value="1"><span id="c-zoom-v">1.00x</span></div>
    <div class="c-hint">Orange frame = what the slide shows. Drag it, zoom for a tighter crop.</div>
  </div>
  <div class="g-grid" id="g-grid"><div class="g-empty">Select a photo on any slide first. The gallery then shows that park's photos. Click one to swap it in; the position resets to centre so you can drag it into place.</div></div>
  <div id="ed-readout">hover a photo for its position</div>
</div>
<div id="ed-preview"><img id="pv-img" alt=""><div class="pv-t" id="pv-t"></div></div>
<textarea id="ed-json" readonly></textarea>
<script id="editor-data" type="application/json">__GALLERY__</script>
<script id="editor-js">
(function(){
  let GALLERY=JSON.parse(document.getElementById('editor-data').textContent);
  const KEY='carousel-editor-draft:'+location.pathname;
  const EDITABLE='.eyebrow, .h-title, .ride, .score, .ff-nums span, .ff-teams span, .ff-sub, .why, .next, .hk-name, .hk-sub, .hk-sub2, .sb-num, .progress-label, .inset .cap span, .cta-headline, .cta-question, .cta-line';
  const PHOTOS='.photo-bg, .hero, .inset .ph';
  const readout=document.getElementById('ed-readout');
  const status=document.getElementById('ed-status');
  const meta=new WeakMap();
  let sel=null, tab='AW', stickers=true;

  const slides=()=>[...document.querySelectorAll('.carousel-track .slide')];
  const urlOf=el=>{const m=(el.style.backgroundImage||getComputedStyle(el).backgroundImage).match(/url\\(["']?(.*?)["']?\\)/);return m?m[1]:null;};
  const posOf=el=>{const p=(el.style.backgroundPosition||'50% 50%').split(/\\s+/).map(parseFloat);return {x:isNaN(p[0])?50:p[0],y:isNaN(p[1])?50:p[1]};};
  const partOf=el=>el.closest('.vs-top')?'top':el.closest('.vs-bottom')?'bottom':el.classList.contains('hero')?'hero':'inset';
  const parkOf=el=>el.dataset.park||(partOf(el)==='top'||partOf(el)==='hero'?'AW':'DLP');

  function ensureMeta(el){return new Promise(res=>{const m0=meta.get(el);if(m0&&m0.url===urlOf(el))return res(m0);const img=new Image();img.onload=()=>{const m={iw:img.naturalWidth,ih:img.naturalHeight,zoom:parseFloat(el.dataset.zoom||'1'),url:urlOf(el)};meta.set(el,m);res(m);};img.onerror=()=>res(null);img.src=urlOf(el);});}
  function rendered(el,m){const cw=el.offsetWidth,ch=el.offsetHeight;const s=Math.max(cw/m.iw,ch/m.ih)*m.zoom;return {cw,ch,w:m.iw*s,h:m.ih*s};}
  function applyZoom(el,m){if(m.zoom<=1.001){m.zoom=1;el.style.backgroundSize='cover';delete el.dataset.zoom;}else{const r=rendered(el,m);el.style.backgroundSize=r.w.toFixed(1)+'px '+r.h.toFixed(1)+'px';el.dataset.zoom=m.zoom.toFixed(3);}}
  function label(el){const i=slides().indexOf(el.closest('.slide'))+1;const p=partOf(el);return 'slide '+i+' \\u00b7 '+(p==='top'?'top half (AW)':p==='bottom'?'bottom half (DLP)':p);}
  function show(el){if(el===sel)renderCrop();const p=posOf(el);const m=meta.get(el);readout.textContent=label(el)+'\\nposition '+p.x.toFixed(1)+'% '+p.y.toFixed(1)+'%'+(m?'   zoom '+m.zoom.toFixed(2)+'x':'');}

  // ---- selection + gallery
  function select(el){
    document.querySelectorAll('.ed-selected').forEach(n=>n.classList.remove('ed-selected'));
    document.querySelectorAll('.ed-has-sel').forEach(n=>n.classList.remove('ed-has-sel'));
    sel=el; if(!el){renderCrop();return;}
    el.classList.add('ed-selected'); const half=el.closest('.vs-half'); if(half) half.classList.add('ed-has-sel');
    tab=parkOf(el); edRenderGallery(); ensureMeta(el).then(()=>{renderCrop();show(el);});
  }
  window.edTab=function(p){tab=p;edRenderGallery();};
  window.edRenderGallery=function(){
    document.querySelectorAll('#ed-gallery .g-tabs button').forEach(b=>b.classList.toggle('on',b.dataset.park===tab));
    const grid=document.getElementById('g-grid');
    const title=document.getElementById('g-title');
    if(!sel){title.textContent='Click a photo on a slide to replace it';return;}
    title.innerHTML='Replacing: <span>'+label(sel)+'</span>';
    const q=(document.getElementById('g-search').value||'').toLowerCase();
    const cur=urlOf(sel);
    const items=GALLERY.filter(g=>g.park===tab&&(!q||g.title.toLowerCase().includes(q)));
    grid.innerHTML=items.map(g=>'<div class="g-item'+(g.url===cur?' cur':'')+'" data-url="'+g.url+'" title="'+g.title.replace(/"/g,'&quot;')+'"><div class="im" style="background-image:url(\\''+g.url.replace('-w1200.webp','-w480.webp')+'\\')"></div><div class="t">#'+g.n+' '+g.title+'</div></div>').join('')||'<div class="g-empty">No photos match.</div>';
    const pv=document.getElementById('ed-preview'),pvImg=document.getElementById('pv-img'),pvT=document.getElementById('pv-t');
    // hover preview: show the cached thumbnail at once, swap in the full-size photo once it has loaded
    let pvTimer=null;
    grid.querySelectorAll('.g-item').forEach(it=>{
      it.addEventListener('mouseenter',()=>{
        const full=it.dataset.url,thumb=full.replace('-w1200.webp','-w480.webp');
        pvImg.dataset.cur=full;pvImg.src=thumb;pvT.textContent=it.title;pv.style.display='block';
        const r=it.getBoundingClientRect();pv.style.top=Math.max(50,Math.min(window.innerHeight-560,r.top-180))+'px';
        clearTimeout(pvTimer);pvTimer=setTimeout(()=>{const hi=new Image();hi.onload=()=>{if(pvImg.dataset.cur===full)pvImg.src=full;};hi.src=full;},180);
      });
      it.addEventListener('mouseleave',()=>{clearTimeout(pvTimer);pv.style.display='none';});
    });
    grid.querySelectorAll('.g-item').forEach(it=>it.addEventListener('click',()=>{
      if(!sel)return; sel.style.backgroundImage="url('"+it.dataset.url+"')"; sel.style.backgroundPosition='50% 50%'; sel.style.backgroundSize='cover'; delete sel.dataset.zoom; meta.delete(sel); ensureMeta(sel).then(()=>{renderCrop();show(sel);}); edRenderGallery(); save();
    }));
  };


  // ---- crop panel: the whole photo, with a frame showing the visible part
  const cropBox=document.getElementById("ed-crop"),cImg=document.getElementById("c-img"),cRect=document.getElementById("c-rect"),cWrap=document.getElementById("c-wrap"),cZoom=document.getElementById("c-zoom"),cZoomV=document.getElementById("c-zoom-v");
  let cropGeom=null;
  function renderCrop(){
    if(!sel){cropBox.style.display="none";return;}
    cropBox.style.display="";
    const u=urlOf(sel);const thumb=u.replace("-w1200.webp","-w480.webp");
    if(cImg.dataset.src!==u){cImg.dataset.src=u;cImg.src=thumb;cImg.onload=()=>layoutCrop();}
    layoutCrop();
  }
  function layoutCrop(){
    const m=meta.get(sel);if(!m||!cImg.clientWidth){cropGeom=null;return;}
    const PW=cImg.clientWidth,PH=cImg.clientHeight;
    const r=rendered(sel,m);const fx=Math.min(1,r.cw/r.w),fy=Math.min(1,r.ch/r.h);
    const rw=fx*PW,rh=fy*PH;const p=posOf(sel);
    const left=(PW-rw)*p.x/100,top=(PH-rh)*p.y/100;
    cRect.style.width=rw+"px";cRect.style.height=rh+"px";cRect.style.left=left+"px";cRect.style.top=top+"px";
    cropGeom={PW,PH,rw,rh};cZoom.value=m.zoom.toFixed(2);cZoomV.textContent=m.zoom.toFixed(2)+"x";
  }
  cRect.addEventListener("mousedown",e=>{
    e.preventDefault();if(!sel||!cropGeom)return;const g=cropGeom;const p0=posOf(sel);const start={x:e.clientX,y:e.clientY};
    function mv(ev){const dx=ev.clientX-start.x,dy=ev.clientY-start.y;
      let x=g.PW-g.rw>0?p0.x+dx/(g.PW-g.rw)*100:p0.x;let y=g.PH-g.rh>0?p0.y+dy/(g.PH-g.rh)*100:p0.y;
      x=Math.min(100,Math.max(0,x));y=Math.min(100,Math.max(0,y));
      sel.style.backgroundPosition=x.toFixed(1)+"% "+y.toFixed(1)+"%";show(sel);}
    function up(){window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up);save();}
    window.addEventListener("mousemove",mv);window.addEventListener("mouseup",up);
  });
  cWrap.addEventListener("wheel",async e=>{e.preventDefault();if(!sel)return;const m=await ensureMeta(sel);if(!m)return;m.zoom=Math.min(3,Math.max(1,m.zoom*(e.deltaY<0?1.05:1/1.05)));applyZoom(sel,m);show(sel);save();},{passive:false});
  cZoom.addEventListener("input",async()=>{if(!sel)return;const m=await ensureMeta(sel);if(!m)return;m.zoom=parseFloat(cZoom.value);applyZoom(sel,m);show(sel);save();});

  // ---- photos: drag / zoom / click-to-select
  function bindPhoto(el){
    if(el.dataset.edBound)return; el.dataset.edBound='1';
    ensureMeta(el);
    el.addEventListener('mouseenter',()=>show(el));
    el.addEventListener('dblclick',e=>{e.preventDefault();const m=meta.get(el);if(m){m.zoom=1;applyZoom(el,m);}el.style.backgroundPosition='50% 50%';show(el);save();});
    // wheel zooms only the photo you clicked (selected); otherwise the page just scrolls
    el.addEventListener('wheel',async e=>{if(el!==sel)return;e.preventDefault();const m=await ensureMeta(el);if(!m)return;m.zoom=Math.min(3,Math.max(1,m.zoom*(e.deltaY<0?1.05:1/1.05)));applyZoom(el,m);show(el);save();},{passive:false});
    el.addEventListener('mousedown',async e=>{
      e.preventDefault();const m=await ensureMeta(el);if(!m)return;
      const start={x:e.clientX,y:e.clientY};const p0=posOf(el);const r=rendered(el,m);
      const ox=Math.max(0,r.w-r.cw),oy=Math.max(0,r.h-r.ch);let moved=false;
      el.classList.add('ed-dragging');
      function mv(ev){const dx=ev.clientX-start.x,dy=ev.clientY-start.y;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;
        let x=ox>0?p0.x-dx/ox*100:p0.x;let y=oy>0?p0.y-dy/oy*100:p0.y;
        x=Math.min(100,Math.max(0,x));y=Math.min(100,Math.max(0,y));
        el.style.backgroundPosition=x.toFixed(1)+'% '+y.toFixed(1)+'%';show(el);}
      function up(){window.removeEventListener('mousemove',mv);window.removeEventListener('mouseup',up);el.classList.remove('ed-dragging');if(!moved)select(el);save();}
      window.addEventListener('mousemove',mv);window.addEventListener('mouseup',up);
    });
  }


  // ---- WIN tag: drag it anywhere on the slide (offset stored inline, survives export)
  function bindSticker(st){
    if(st.dataset.edBound)return;st.dataset.edBound="1";
    st.addEventListener("mousedown",e=>{
      e.preventDefault();e.stopPropagation();
      const parent=st.offsetParent||st.parentElement;const pr=parent.getBoundingClientRect();const sr=st.getBoundingClientRect();
      // switch to explicit left/top so the drag is stable whichever side the CSS anchored it to
      const cs=getComputedStyle(st);const rot=cs.transform;
      st.style.transform="none";const sr0=st.getBoundingClientRect();st.style.transform=rot==="none"?"":rot;
      let left=sr0.left-pr.left,top=sr0.top-pr.top;
      st.style.right="auto";st.style.left=left+"px";st.style.top=top+"px";
      const start={x:e.clientX,y:e.clientY};
      function mv(ev){st.style.left=(left+ev.clientX-start.x).toFixed(0)+"px";st.style.top=(top+ev.clientY-start.y).toFixed(0)+"px";}
      function up(){window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up);save();}
      window.addEventListener("mousemove",mv);window.addEventListener("mouseup",up);
    });
    st.addEventListener("dblclick",e=>{e.preventDefault();e.stopPropagation();st.style.left="";st.style.top="";st.style.right="";save();});
  }

  // ---- text fields
  function bindText(slide){
    slide.querySelectorAll(EDITABLE).forEach(el=>{
      if(el.closest('.ed-bar'))return;
      el.setAttribute('contenteditable','true'); el.setAttribute('spellcheck','false');
      el.querySelectorAll('.sticker').forEach(s=>{s.setAttribute('contenteditable','false');bindSticker(s);});
      if(!el.dataset.edBound){el.dataset.edBound='1';
        // Enter finishes a field; Shift+Enter inserts a plain line break (never a nested block)
        el.addEventListener('keydown',e=>{if(e.key!=='Enter')return;e.preventDefault();if(e.shiftKey){document.execCommand('insertLineBreak');}else{el.blur();}});
        el.addEventListener('input',()=>{if(el.classList.contains('sb-num'))syncLead(slide);save();});
        el.addEventListener('paste',e=>{e.preventDefault();document.execCommand('insertText',false,(e.clipboardData||window.clipboardData).getData('text'));});
      }
    });
  }
  function syncLead(slide){const t=[...slide.querySelectorAll('.sb-team')];if(t.length!==2)return;const a=parseFloat(t[0].querySelector('.sb-num').textContent),b=parseFloat(t[1].querySelector('.sb-num').textContent);t[0].classList.toggle('lead',a>b);t[1].classList.toggle('lead',b>a);}

  // ---- winner toggle
  function winnerOf(slide){if(slide.classList.contains('tie'))return 'tie';if(slide.querySelector('.score-block.sb-aw.win'))return 'aw';if(slide.querySelector('.score-block.sb-dlp.win'))return 'dlp';return null;}
  function setWinner(slide,who){
    const top=slide.querySelector('.vs-top'),bot=slide.querySelector('.vs-bottom');if(!top||!bot)return;
    [top,bot].forEach(h=>h.classList.remove('winner','loser'));
    if(who==='aw'){top.classList.add('winner');bot.classList.add('loser');}
    if(who==='dlp'){bot.classList.add('winner');top.classList.add('loser');}
    slide.classList.toggle('tie',who==='tie');
    const aw=slide.querySelector('.score-block.sb-aw'),dlp=slide.querySelector('.score-block.sb-dlp');
    [aw,dlp].forEach(b=>{if(!b)return;b.classList.remove('win');b.querySelectorAll('.sticker').forEach(s=>s.remove());});
    const w=who==='aw'?aw:who==='dlp'?dlp:null;
    if(w){w.classList.add('win');if(stickers){const s=document.createElement('span');s.className='sticker';s.textContent='WIN';s.setAttribute('contenteditable','false');w.querySelector('.score').appendChild(s);bindSticker(s);}}
    const dot=slide.querySelector('.vs-dot');if(dot){dot.textContent=who==='tie'?'DRAW':'VS';dot.classList.toggle('draw',who==='tie');}
    slide.querySelectorAll('.ed-bar .ed-w button').forEach(b=>b.classList.toggle('on',b.dataset.w===who));
    save();
  }
  window.edToggleStickers=function(){stickers=!stickers;document.getElementById('ed-stick-btn').textContent='WIN stickers: '+(stickers?'on':'off');slides().forEach(s=>{const w=winnerOf(s);if(w&&w!=='tie')setWinner(s,w);});};

  // ---- slide chrome
  function addBar(slide,i){
    let bar=slide.querySelector('.ed-bar');if(bar)bar.remove();
    bar=document.createElement('div');bar.className='ed-bar';
    bar.innerHTML='<span>SLIDE '+(i+1)+'</span>';
    if(slide.querySelector('.vs-top')&&slide.querySelector('.score-block')){
      const w=document.createElement('div');w.className='ed-w';
      const cur=winnerOf(slide);
      [['aw','AW WINS'],['dlp','DLP WINS'],['tie','DRAW']].forEach(([k,t])=>{const b=document.createElement('button');b.dataset.w=k;b.textContent=t;b.classList.toggle('on',cur===k);b.onclick=()=>setWinner(slide,k);w.appendChild(b);});
      bar.appendChild(w);
    }
    slide.appendChild(bar);
  }
  function init(){
    slides().forEach((s,i)=>{addBar(s,i);bindText(s);s.querySelectorAll(PHOTOS).forEach(bindPhoto);});
    document.addEventListener('mousedown',e=>{if(!e.target.closest('.slide')&&!e.target.closest('#ed-gallery'))select(null);},true);
  }

  // ---- draft autosave (browser only, survives a refresh)
  let saveT=null;
  const SYNC=window.ED_SYNC||null; let lastHash=SYNC?SYNC.hash:null; let saving=false; let dirty=false; let remoteChanged=false;
  const saveBtn=document.getElementById('ed-save-btn');
  function setDirty(v){dirty=v;if(saveBtn){saveBtn.classList.toggle('dirty',v);saveBtn.textContent=v?'Save changes':'Saved';}}
  // in sync mode every edit only marks the document dirty; the Save button (or Ctrl+S) writes it
  function save(){
    if(SYNC){setDirty(true);if(!remoteChanged)status.textContent='unsaved changes';return;}
    clearTimeout(saveT);saveT=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify({t:Date.now(),html:cleanTrackHtml()}));status.textContent='draft saved '+new Date().toLocaleTimeString();}catch(e){status.textContent='draft not saved';}},400);
  }
  window.edSaveNow=function(){
    if(!SYNC||saving)return Promise.resolve();
    saving=true;status.textContent='saving';
    return fetch(SYNC.saveUrl||'/save',{method:'POST',headers:{'Content-Type':'text/html'},body:edBuildHtml()}).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
      .then(j=>{lastHash=j.hash;remoteChanged=false;setDirty(false);status.textContent='saved '+new Date().toLocaleTimeString();const rb=document.getElementById('ed-reload-btn');if(rb)rb.remove();})
      .catch(e=>{status.textContent='save failed: '+e.message;}).finally(()=>{saving=false;});
  };
  if(SYNC){
    document.getElementById('ed-restore-btn').remove();
    saveBtn.style.display='';setDirty(false);
    saveBtn.onclick=()=>edSaveNow();
    document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();edSaveNow();}});
    window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
    const eb=document.createElement('button');eb.className='sec';eb.textContent='Export PNGs';eb.onclick=()=>{eb.disabled=true;eb.textContent='Exporting...';status.textContent='exporting 12 slides, ~40s';fetch(SYNC.exportUrl||'/export',{method:'POST'}).then(r=>r.json()).then(j=>{eb.disabled=false;eb.textContent='Export PNGs';if(j.ok){status.textContent='exported to '+j.dir;window.open((SYNC.sheetUrl||'/sheet.jpg')+'?'+Date.now(),'_blank');}else status.textContent='export failed: '+j.error;}).catch(e=>{eb.disabled=false;eb.textContent='Export PNGs';status.textContent='export failed';});};
    if(SYNC.exportUrl!==false)document.getElementById('ed-stick-btn').after(eb);
    status.textContent='';window.edSyncState=()=>({lastHash,saving,dirty});
    // someone else saved: reload if we have nothing unsaved, otherwise offer the choice
    setInterval(()=>{if(saving)return;fetch(SYNC.versionUrl||'/version').then(r=>r.json()).then(j=>{
      if(!(j.hash&&lastHash&&j.hash!==lastHash))return;
      const typing=document.activeElement&&document.activeElement.isContentEditable;const dragging=document.querySelector('.ed-dragging');
      if(!dirty){if(!typing&&!dragging){status.textContent='updated by someone else, reloading';location.reload();}return;}
      if(!remoteChanged){remoteChanged=true;status.textContent='someone else saved a newer version. Save to overwrite it, or';
        const rb=document.createElement('button');rb.id='ed-reload-btn';rb.className='sec';rb.textContent='Reload theirs (drops your edits)';rb.onclick=()=>{setDirty(false);location.reload();};status.after(rb);}
    }).catch(()=>{});},3000);
  }
  window.edRestore=function(){try{const d=JSON.parse(localStorage.getItem(KEY));if(!d)return;const track=document.querySelector('.carousel-track');track.innerHTML=d.html;
    const tpl=document.getElementById('pr-logo');track.querySelectorAll('.logo-slot').forEach(s=>{s.innerHTML='';s.appendChild(tpl.content.firstElementChild.cloneNode(true));});
    init();status.textContent='draft restored';document.getElementById('ed-restore-btn').style.display='none';}catch(e){status.textContent='restore failed';}};
  (function(){try{const d=JSON.parse(localStorage.getItem(KEY));if(d&&d.html){const b=document.getElementById('ed-restore-btn');b.style.display='';b.textContent='Restore draft from '+new Date(d.t).toLocaleString();}}catch(e){}})();

  // ---- export
  function cleanTrackHtml(){
    const track=document.querySelector('.carousel-track').cloneNode(true);
    track.querySelectorAll('.ed-bar').forEach(n=>n.remove());
    track.querySelectorAll('[contenteditable]').forEach(n=>{n.removeAttribute('contenteditable');n.removeAttribute('spellcheck');});
    track.querySelectorAll('[data-ed-bound]').forEach(n=>delete n.dataset.edBound);
    track.querySelectorAll('.ed-selected,.ed-has-sel,.ed-dragging').forEach(n=>n.classList.remove('ed-selected','ed-has-sel','ed-dragging'));
    track.querySelectorAll('.logo-slot').forEach(n=>{n.innerHTML='';});
    return track.innerHTML;
  }
  window.edBuildHtml=function(){
    const doc=document.documentElement.cloneNode(true);
    ['editor-css','editor-ui','ed-gallery','ed-json','ed-preview','ed-texttools','editor-data','editor-js','editor-js2','editor-sync'].forEach(id=>{const n=doc.querySelector('#'+id);if(n)n.remove();});
    doc.querySelectorAll('.slide strong').forEach(n=>{const b=doc.createElement('b');b.innerHTML=n.innerHTML;n.replaceWith(b);});
    doc.querySelectorAll('#editor-libs').forEach(n=>n.remove());
    doc.querySelectorAll('.ed-add.open').forEach(n=>n.classList.remove('open'));
    const track=doc.querySelector('.carousel-track');track.innerHTML=cleanTrackHtml();track.style.transform='';
    doc.querySelector('body').removeAttribute('style');
    return '<!DOCTYPE html>\\n'+doc.outerHTML;
  };
  window.edDownload=function(){const blob=new Blob([edBuildHtml()],{type:'text/html'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='carousel-04-edited.html';a.click();status.textContent='downloaded';};
  window.edPositions=function(){return [...document.querySelectorAll('.carousel-track .slide')].flatMap((s,i)=>[...s.querySelectorAll(PHOTOS)].map(el=>({slide:i+1,part:partOf(el),url:urlOf(el),position:el.style.backgroundPosition||'50% 50%',size:el.style.backgroundSize||'cover'})));};
  window.edCopyJson=function(){const t=document.getElementById('ed-json');t.value=JSON.stringify(edPositions(),null,1);t.style.display='block';t.select();try{navigator.clipboard.writeText(t.value);}catch(e){}};

  init(); edRenderGallery();
  window.__ed={slides,save,init,select,renderCrop,cleanTrackHtml,ensureMeta,bindPhoto,bindText,SYNC};
  if(window.ED_SYNC&&window.ED_SYNC.galleryApi){
    const norm=p=>{p=String(p).replace(/^:?\\/*/,"").replace(/^https?:\\/\\//,"");return "https://"+p.replace(/\\.(jpg|jpeg|png|webp)$/i,"")+"-w1200.webp";};
    Promise.all([[110,"AW"],[109,"DLP"]].map(([id,park])=>fetch("/api/park/"+id+"/gallery").then(r=>r.json()).then(j=>{const arr=Array.isArray(j)?j:(j.images||j.gallery||Object.values(j)[0]||[]);return arr.filter(x=>!/\\.mp4$|DUPLICATE/i.test(String(x.path||x.url||""))).map((x,i)=>({park,n:i,title:String(x.title||"untitled").replace(/^Disneyland Paris - (Disney Adventure World|Disneyland Park) - /,""),url:norm(x.path||x.url)}));}).catch(()=>[])))
    .then(lists=>{GALLERY=lists.flat();edRenderGallery();});
  }
})();
</script>
<script id="editor-js2">
__EDITOR_EXT__
</script>`;

function inject(html,opts={}){
  // Google Fonts stylesheet must be CORS-readable for the in-browser export to embed the fonts
  let out=html.replace(/<link ([^>]*href="https:\/\/fonts\.googleapis\.com[^"]*"[^>]*)>/g,(m,attrs)=>/crossorigin/.test(attrs)?m:`<link ${attrs} crossorigin="anonymous">`);
  out=out.replace("</head>",editorCss+"\n</head>");
  const syncTag=opts.sync?'<script id="editor-sync">window.ED_SYNC='+JSON.stringify(opts.sync)+';</script>\n':"";
  out=out.replace("</body>",syncTag+editorUi.replace("__GALLERY__",opts.gallery!==undefined?opts.gallery:gallery).replace("__EDITOR_EXT__",editorExt)+"\n</body>");
  return out;
}
module.exports={inject};
