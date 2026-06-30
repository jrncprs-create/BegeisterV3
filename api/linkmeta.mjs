// Haalt een visuele preview op voor een link (Instagram/web) — voor het inspiratiebord.
// Geeft: og:image (cover), titel, og:video (mp4 indien aanwezig) en — voor Instagram-carrousels —
// de losse frames via ?img_index=1..N.
function decodeEnt(s){ return String(s||'').replace(/&amp;/gi,'&').replace(/&#x2F;/gi,'/').replace(/&#39;/gi,"'").replace(/&quot;/gi,'"').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&nbsp;/gi,' ').trim(); }
function pickMeta(html, props){
  for(const p of props){
    let m = html.match(new RegExp('<meta[^>]+(?:property|name)=["\\\']'+p+'["\\\'][^>]*content=["\\\']([^"\\\']+)["\\\']','i'));
    if(m && m[1]) return m[1];
    m = html.match(new RegExp('<meta[^>]+content=["\\\']([^"\\\']+)["\\\'][^>]*(?:property|name)=["\\\']'+p+'["\\\']','i'));
    if(m && m[1]) return m[1];
  }
  return '';
}
function absUrl(v, base){
  v = decodeEnt(v);
  if(v && v.indexOf('//') === 0) return 'https:' + v;
  if(v && v.indexOf('/') === 0){ try{ const u = new URL(base); return u.origin + v; }catch(_){ } }
  return v;
}
function pickImage(html, base){ return absUrl(pickMeta(html, ['og:image:secure_url','og:image','twitter:image','twitter:image:src']), base); }
function pickVideo(html, base){ return absUrl(pickMeta(html, ['og:video:secure_url','og:video','og:video:url','twitter:player:stream']), base); }
async function fetchHtml(u){
  const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), 8000);
  try{
    const r = await fetch(u, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BegeisterBot/1.0)' } });
    return (await r.text()).slice(0, 600000);
  } finally { clearTimeout(t); }
}

export default async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const url = (req.body && req.body.url || '').toString().trim();
  if(!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'geen geldige url' });
  try{
    const html = await fetchHtml(url);
    const image = pickImage(html, url);
    let title = pickMeta(html, ['og:title','twitter:title']) || ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1] || '');
    title = decodeEnt(title);
    const video = pickVideo(html, url);
    let images = image ? [image] : [];
    // Instagram-carrousel (/p/ of /tv/): losse frames ophalen via ?img_index=1..N.
    if(/instagram\.com\/(p|tv)\//i.test(url)){
      try{
        const seen = new Set(); images = [];
        for(let idx=1; idx<=10; idx++){
          let u; try{ u = new URL(url); }catch(_){ break; }
          u.searchParams.set('img_index', String(idx));
          const im = pickImage(await fetchHtml(u.toString()), url);
          if(!im || seen.has(im)) break;
          seen.add(im); images.push(im);
        }
        if(!images.length && image) images = [image];
      }catch(_){ if(image) images = [image]; }
    }
    return res.status(200).json({ image: images[0] || image || '', title, url, video: video || '', images });
  }catch(e){
    return res.status(200).json({ image: '', title: '', url, video: '', images: [] });
  }
}
