// Loft Spinozastraat (kamerverhuur via Airbnb en Booking). Alleen zichtbaar voor Jeroen.
// Los bestand naast index.html: gebruikt daar `sb`, `who`, `toonToast` en `escapeHtml` uit.
// Data komt uit de loft_*-tabellen (RLS: alleen Jeroen); acties gaan via /api/loft met het sessietoken.
// Deep link: ?loft=akkoord|agenda|prijzen|buurt|meldingen of ?loft=<voorstel-id> (ook vanuit een push).
(function(){
'use strict';
const VIEWS=['akkoord','agenda','prijzen','buurt','meldingen'];
const LABEL={akkoord:'Akkoord',agenda:'Agenda',prijzen:'Prijzen',buurt:'Buurt',meldingen:'Meldingen'};
const MND=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
const DAG=['zo','ma','di','wo','do','vr','za'];
const eur=n=>n==null||isNaN(n)?'–':'€ '+Math.round(n);
const kl=p=>p==='airbnb'||p==='Airbnb'?'air':(p==='booking'||p==='Booking'?'bk':'');
let st={inst:{},dagen:[],vst:[],buurt:[],log:[],meld:[]}, view='akkoord', open=false, focusId=null;

function el(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}

// ---------- opbouw ----------
function bouw(){
  if(document.getElementById('loftOverlay'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href='/loft.css';document.head.appendChild(link);
  const ov=el('div');ov.id='loftOverlay';ov.className='dayview-ov';ov.setAttribute('aria-hidden','true');
  ov.innerHTML=`<div class="dov-inner lf-inner">
    <div class="dov-head"><div class="dov-greet"><b>Loft</b> <span class="lf-dim">Spinozastraat</span></div>
      <div class="dov-right"><span class="lf-status"><span class="lf-lamp" id="lfLamp"></span><span id="lfLampT">laden</span></span>
        <button class="dov-close" onclick="closeLoft()" aria-label="Sluiten" title="Sluiten"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div>
    <div class="lf-tabs" id="lfTabs"></div>
    <div class="lf-view" id="lfBody"></div></div>`;
  document.body.appendChild(ov);
  const tabs=ov.querySelector('#lfTabs');
  VIEWS.forEach(v=>{const b=el('button','',LABEL[v]);b.dataset.v=v;b.onclick=()=>toon(v);tabs.appendChild(b)});
  const nav=document.getElementById('nav');
  if(nav&&!document.getElementById('loftBtn')){
    const b=el('button','','Loft');b.id='loftBtn';b.dataset.v='loft';b.onclick=()=>openLoft();
    const loep=nav.querySelector('.nav-loep'); loep?nav.insertBefore(b,loep):nav.appendChild(b);
  }
}

window.openLoft=async function(v){
  bouw(); open=true;
  const ov=document.getElementById('loftOverlay'); ov.setAttribute('aria-hidden','false'); ov.classList.add('open');
  if(v&&VIEWS.includes(v))view=v; else if(v){focusId=v;view='akkoord'}
  await laad(); toon(view);
};
window.closeLoft=function(){open=false;const ov=document.getElementById('loftOverlay');if(!ov)return;ov.classList.remove('open');ov.setAttribute('aria-hidden','true')};

// ---------- data ----------
async function q(t){const r=await t;if(r.error)throw new Error(r.error.message);return r.data||[]}
async function laad(){
  try{
    const vanaf=new Date(Date.now()-864e5).toISOString().slice(0,10);
    const [inst,dagen,vst,buurt,log,meld]=await Promise.all([
      q(sb.from('loft_instellingen').select('*').eq('id','main').maybeSingle()),
      q(sb.from('loft_dagen').select('*').gte('datum',vanaf).order('datum')),
      q(sb.from('loft_voorstellen').select('*').order('aangemaakt',{ascending:false}).limit(40)),
      q(sb.from('loft_buurt').select('*').order('prijs')),
      q(sb.from('loft_log').select('*').order('tijd',{ascending:false}).limit(25)),
      q(sb.from('meldingen').select('id,titel,tekst,url,aangemaakt').ilike('url','%loft%').order('aangemaakt',{ascending:false}).limit(30)),
    ]);
    st={inst:inst||{},dagen,vst,buurt,log,meld};
  }catch(e){toonToast('Loft laden lukte niet: '+e.message,'fout');throw e}
  kop();
}
async function api(body){
  const s=await sb.auth.getSession(); const token=s&&s.data&&s.data.session&&s.data.session.access_token;
  if(!token)throw new Error('niet ingelogd');
  const r=await fetch('/api/loft',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({error:'geen antwoord van de server'}));
  if(!r.ok||j.error)throw new Error(j.error||('fout '+r.status));
  return j;
}

// ---------- weergave ----------
function kop(){
  const s=st.inst.status||{}; const open=st.vst.filter(v=>v.status==='open').length;
  const issues=!s.synced||s.bookingIssues;
  const lamp=document.getElementById('lfLamp'); if(lamp){lamp.className='lf-lamp '+(issues?'warn':'ok');document.getElementById('lfLampT').textContent=issues?'actie nodig':'alles live'}
  const btn=document.getElementById('loftBtn'); if(btn){btn.classList.toggle('loft-badge',open>0);btn.dataset.n=open}
  document.querySelectorAll('#lfTabs button').forEach(b=>{
    b.classList.toggle('on',b.dataset.v===view);
    const old=b.querySelector('.lf-badge'); if(old)old.remove();
    if(b.dataset.v==='akkoord'&&open){b.appendChild(el('span','lf-badge',String(open)))}
  });
}
function toon(v){
  view=v; kop();
  const body=document.getElementById('lfBody'); body.textContent='';
  ({akkoord:rAkkoord,agenda:rAgenda,prijzen:rPrijzen,buurt:rBuurt,meldingen:rMeldingen})[v](body);
  document.getElementById('loftOverlay').scrollTo(0,0);
}
function sec(body,titel,sub){const s=el('div','pb-sec');const h=el('div','pb-h');h.append(titel);if(sub)h.appendChild(el('span','lf-dim',sub));s.appendChild(h);body.appendChild(s);return s}

function rAkkoord(body){
  const s0=sec(body,'Nu');
  const bezet=st.dagen.filter(d=>{const t=new Date(d.datum+'T12:00');return (t-Date.now())<30*864e5&&(d.status==='airbnb'||d.status==='booking')}).length;
  const stat=el('div','lf-stat');
  [['Gast betaalt',eur(st.inst.weekdag)],['Komende 30 dgn',bezet+' / 30'],['Koppeling',(st.inst.status||{}).synced?'aan':'uit']].forEach(([k,v])=>{const d=el('div');d.appendChild(el('div','k',k));d.appendChild(el('div','v lf-num',v));stat.appendChild(d)});
  s0.appendChild(stat);
  const open=st.vst.filter(v=>v.status==='open');
  const s=sec(body,'Wacht op akkoord',open.length?open.length+' open':'');
  if(!st.vst.length){s.appendChild(el('p','lf-leeg','Nog geen voorstellen. De agent zet hier prijswijzigingen en antwoorden aan gasten neer.'));return}
  if(!open.length)s.appendChild(el('p','lf-leeg','Niets open. Eerdere besluiten staan hieronder.'));
  const lijst=[...st.vst].sort((a,b)=>(a.status==='open'?0:1)-(b.status==='open'?0:1)).slice(0,12);
  if(focusId){const i=lijst.findIndex(v=>v.id===focusId);if(i>0)lijst.unshift(lijst.splice(i,1)[0])}
  lijst.forEach(v=>s.appendChild(vstKaart(v)));
  focusId=null;
}
function vstKaart(v){
  const k=el('article','lf-vst '+kl(v.platform)); k.id='vst-'+v.id;
  k.appendChild(el('div','lf-vsub',(v.soort==='bericht'?'Antwoord aan gast':'Prijs')+' · '+(v.platform||'beide')+(v.datums?' · '+v.datums:'')));
  k.appendChild(el('div','lf-vkop',v.titel||''));
  if(v.detail)k.appendChild(el('div','lf-tx lf-dim',v.detail));
  if(v.vraag)k.appendChild(el('div','lf-vraag',v.vraag));
  let conceptEl=null; if(v.concept){conceptEl=el('div','lf-concept',v.concept);k.appendChild(conceptEl)}
  if(v.status==='open'){
    if(v.soort==='bericht'){
      const row=el('div','lf-instr'); const inp=el('input');inp.placeholder='Wat wil je zeggen? Eén regel is genoeg.';inp.id='instr-'+v.id;
      const hb=el('button','lf-btn ghost','Herschrijf');
      hb.onclick=async()=>{if(!inp.value.trim())return toonToast('Typ eerst wat je wilt zeggen');hb.disabled=true;try{const r=await api({action:'herschrijf',id:v.id,instructie:inp.value.trim()});v.concept=r.concept;if(conceptEl)conceptEl.textContent=r.concept;else{conceptEl=el('div','lf-concept',r.concept);k.insertBefore(conceptEl,row)}inp.value='';toonToast('Concept aangepast')}catch(e){toonToast(e.message,'fout')}hb.disabled=false};
      row.append(inp,hb); k.appendChild(row);
    }
    const acts=el('div','lf-acts');
    const ja=el('button','lf-btn',v.soort==='bericht'?'Verstuur':'Ja, doorvoeren');
    const nee=el('button','lf-btn ghost','Nee');
    ja.onclick=async()=>{ja.disabled=nee.disabled=true;try{
        if(v.soort==='bericht'){await api({action:'verstuur',id:v.id});toonToast('Verstuurd aan '+(v.gast||'de gast'))}
        else{await api({action:'besluit',id:v.id,status:'ja'});toonToast('Akkoord. Volgt bij de volgende ronde.')}
        await laad();toon(view)}catch(e){ja.disabled=nee.disabled=false;toonToast(e.message,'fout')}};
    nee.onclick=async()=>{ja.disabled=nee.disabled=true;try{await api({action:'besluit',id:v.id,status:'nee'});toonToast('Afgewezen');await laad();toon(view)}catch(e){ja.disabled=nee.disabled=false;toonToast(e.message,'fout')}};
    acts.append(ja,nee); k.appendChild(acts);
  } else {
    k.appendChild(el('div','lf-besluit',{ja:'Akkoord, volgt bij de volgende ronde',nee:'Afgewezen',verzonden:'Verstuurd',uitgevoerd:'Doorgevoerd'}[v.status]||v.status));
  }
  return k;
}

function rAgenda(body){
  const s=sec(body,'Agenda','gastprijs Airbnb / Booking');
  const per=new Map(st.dagen.map(d=>[d.datum,d]));
  const t=new Date();t.setHours(12,0,0,0); let m=-1;
  for(let i=0;i<90;i++){
    const d=new Date(t);d.setDate(t.getDate()+i);
    const iso=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    if(d.getMonth()!==m){m=d.getMonth();s.appendChild(el('div','lf-maand',MND[m]+' '+d.getFullYear()))}
    const info=per.get(iso)||{}; const we=d.getDay()===5||d.getDay()===6;
    const gist=per.get(new Date(d-864e5).toISOString().slice(0,10));
    if(info.aankomst&&gist&&(gist.status==='airbnb'||gist.status==='booking')&&gist.code!==info.code){
      const w=el('div','lf-wissel');w.appendChild(el('div','dt','wissel'));w.appendChild(el('div','', '12 tot 16 uur: '+(gist.gast||'gast')+' vertrekt, '+(info.gast||'gast')+' komt'));s.appendChild(w);
    }
    const r=el('div','lf-dag'+(we?' we':'')+' '+kl(info.status));
    const dt=el('div','dt');dt.appendChild(el('b','lf-num',String(d.getDate())));dt.append(DAG[d.getDay()]);
    const wie=el('div','wie'); const pr=el('div','pr lf-num');
    if(info.status==='airbnb'||info.status==='booking'){
      const p=el('span','lf-plat');p.appendChild(el('i'));p.append((info.status==='airbnb'?'Airbnb':'Booking')+(info.gast?' · '+info.gast:'')+(info.gasten?' ('+info.gasten+')':''));
      if(info.url){const a=el('a');a.href=info.url;a.target='_blank';a.rel='noopener';a.style.textDecoration='none';a.appendChild(p);wie.appendChild(a)}else wie.appendChild(p);
    }else if(info.status==='blok'){const p=el('span','lf-plat');p.appendChild(el('i'));p.append('dicht');wie.appendChild(p)}
    else{wie.appendChild(el('span','lf-dim','vrij'));const basis=we?st.inst.weekend:st.inst.weekdag;pr.append(eur(info.prijs_airbnb??basis));pr.appendChild(el('br'));pr.appendChild(el('span','lf-dim',eur(info.prijs_booking??basis)))}
    r.append(dt,wie,pr); s.appendChild(r);
  }
}

function rPrijzen(body){
  const s=sec(body,'Jouw grenzen','bedragen die de gast betaalt');
  const f=el('form'); const velden=[['weekdag','Doordeweeks'],['weekend','Weekend (vr, za)'],['minimum','Nooit lager dan'],['maximum','Nooit hoger dan'],['langverblijf_pct','Korting vanaf 4 nachten (%)'],['leeg_dagen','Omlaag als nog leeg, dagen vooraf']];
  velden.forEach(([k,l])=>{const v=el('div','lf-veld');const lab=el('label','',l);lab.htmlFor='lf-'+k;const inp=el('input');inp.type='number';inp.inputMode='numeric';inp.id='lf-'+k;inp.value=st.inst[k]??'';v.append(lab,inp);f.appendChild(v)});
  const acts=el('div','lf-acts');acts.style.marginTop='16px';const save=el('button','lf-btn','Opslaan');save.type='submit';acts.appendChild(save);f.appendChild(acts);
  f.appendChild(el('p','lf-noot','Airbnb rekent 12,5% belasting bovenop je prijs; de agent zet daar dus gastprijs gedeeld door 1,125. Booking krijgt de gastprijs zelf.'));
  f.onsubmit=async e=>{e.preventDefault();save.disabled=true;const inst={};velden.forEach(([k])=>{const n=parseFloat(document.getElementById('lf-'+k).value);inst[k]=isNaN(n)?null:n});
    try{await api({action:'instellingen',instellingen:inst});toonToast('Opgeslagen');await laad()}catch(err){toonToast(err.message,'fout')}save.disabled=false};
  s.appendChild(f);
}

function rBuurt(body){
  const gem=st.buurt.map(b=>b.gemeten).filter(Boolean).sort().pop();
  const s=sec(body,'Buurt',gem?gem+' · per nacht, alles incl.':'');
  if(!st.buurt.length){s.appendChild(el('p','lf-leeg','Nog geen metingen.'));return}
  st.buurt.forEach(b=>{const r=el('div','lf-buur '+kl(b.platform)+(b.ik?' ik':''));const nm=el('div','nm');const p=el('span','lf-plat');p.appendChild(el('i'));p.append(b.naam||'');nm.appendChild(p);
    r.append(nm,el('div','pn lf-num',eur(b.prijs)),el('div','sub',(b.platform||'')+' · badkamer '+(b.badkamer||'onbekend')+' · '+(b.score?'score '+b.score+(b.reviews?' ('+b.reviews+')':''):'nieuw')));s.appendChild(r)});
}

function tijd(x){const d=new Date(x);if(isNaN(d))return '';return String(d.getDate()).padStart(2,'0')+'-'+String(d.getMonth()+1).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
function rMeldingen(body){
  const s=sec(body,'Meldingen','wat je op je telefoon kreeg');
  if(!st.meld.length)s.appendChild(el('p','lf-leeg','Nog geen meldingen verstuurd.'));
  st.meld.forEach(mx=>{const plat=/airbnb/i.test(mx.titel)?'air':(/booking/i.test(mx.titel)?'bk':'');const r=el('div','lf-rij '+plat);r.style.cursor='pointer';
    r.onclick=()=>{const id=(mx.url||'').match(/[?&]loft=([^&#]+)/);if(id&&!VIEWS.includes(id[1])){focusId=id[1];toon('akkoord')}else toon((id&&id[1])||'akkoord')};
    const tx=el('div','lf-tx');tx.appendChild(el('b','',mx.titel||''));tx.appendChild(el('br'));tx.append(mx.tekst||'');r.append(tx,el('div','lf-meta lf-num',tijd(mx.aangemaakt)));s.appendChild(r)});
  const s2=sec(body,'Open punten'); const op=st.inst.open_punten||[];
  if(!op.length)s2.appendChild(el('p','lf-leeg','Niets open.'));
  op.forEach(t=>{const r=el('div','lf-rij');r.append(el('div','lf-tx',t.text||''),el('div','lf-meta',t.who||''));s2.appendChild(r)});
  const s3=sec(body,'Logboek'); if(!st.log.length)s3.appendChild(el('p','lf-leeg','Nog niets gebeurd.'));
  st.log.forEach(l=>{const r=el('div','lf-rij');r.append(el('div','lf-tx',l.tekst),el('div','lf-meta lf-num',tijd(l.tijd)));s3.appendChild(r)});
}

// ---------- start ----------
function deepLink(url){try{const q=new URLSearchParams(String(url||'').split('?')[1]||'');const v=q.get('loft');if(v){openLoft(v);return true}}catch(_){}return false}
async function start(){
  if(typeof sb==='undefined')return;
  const s=await sb.auth.getSession(); const email=(s&&s.data&&s.data.session&&s.data.session.user&&s.data.session.user.email)||'';
  if(!/^jeroen@/i.test(email))return;
  bouw();
  try{const vst=await q(sb.from('loft_voorstellen').select('id').eq('status','open'));const b=document.getElementById('loftBtn');if(b&&vst.length){b.classList.add('loft-badge');b.dataset.n=vst.length}}catch(_){}
  if(deepLink(location.href)){try{history.replaceState({},'',location.pathname)}catch(_){}}
  if(navigator.serviceWorker)navigator.serviceWorker.addEventListener('message',ev=>{const d=ev.data||{};if(d.type==='openUrl'&&d.url)deepLink(d.url)});
}
if(typeof sb!=='undefined'){sb.auth.onAuthStateChange((_e,session)=>{if(session&&!document.getElementById('loftOverlay'))start()});start()}
})();
