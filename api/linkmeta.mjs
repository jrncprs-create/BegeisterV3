// Haalt een visuele preview (og:image + titel) op voor een link (Instagram/web) — voor het inspiratiebord.
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
export default async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const url = (req.body && req.body.url || '').toString().trim();
  if(!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'geen geldige url' });
  try{
    const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BegeisterBot/1.0)' } });
    clearTimeout(t);
    const html = (await r.text()).slice(0, 500000);
    let image = pickMeta(html, ['og:image:secure_url','og:image','twitter:image','twitter:image:src']);
    let title = pickMeta(html, ['og:title','twitter:title']) || ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1] || '');
    image = decodeEnt(image); title = decodeEnt(title);
    if(image && image.indexOf('//') === 0) image = 'https:' + image;
    else if(image && image.indexOf('/') === 0){ try{ const u = new URL(url); image = u.origin + image; }catch(_){} }
    return res.status(200).json({ image, title, url });
  }catch(e){
    return res.status(200).json({ image: '', title: '', url });
  }
}
