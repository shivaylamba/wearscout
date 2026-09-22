(() => {
 const clean=s=>(s||'').replace(/\s+/g,' ').trim();
 const visible=e=>e && e.getClientRects().length && getComputedStyle(e).visibility!=='hidden';
 const url=s=>{try{const u=new URL(s,location.href);return u.protocol==='https:'&&!u.username&&!u.password?u:null}catch{return null}};
 const identity=s=>{
  const u=url(s);if(!u)return null;
  const h=u.hostname.replace(/^www\./,'');
  if(h==='amazon.in'){const m=u.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i);return m?`https://www.amazon.in/dp/${m[1].toUpperCase()}`:null}
  if(h==='meesho.com'){const m=u.pathname.match(/\/p\/([\w-]+)\/?$/);return m?`https://www.meesho.com${u.pathname.replace(/\/$/,'')}`:null}
  if(h==='myntra.com' && /\/\d+\/buy\/?$/.test(u.pathname))return `https://www.myntra.com${u.pathname.replace(/\/$/,'')}`;
  return null;
 };
 const observed=a=>{let u=url(a.href);if(!u)return null;if(u.hostname==='www.google.com'&&u.pathname==='/url')u=url(u.searchParams.get('q')||u.searchParams.get('url'));return u?identity(u.href):null};
 const host=location.hostname.replace(/^www\./,'');
 const adapter={ 'amazon.in':'[data-component-type="s-search-result"][data-asin]', 'meesho.com':'a[href*="/p/"]', 'myntra.com':'.product-base' }[host];
 const out=[];
 for(const a of document.querySelectorAll('a[href]')){
  if(!visible(a))continue;
  const href=observed(a);if(!href)continue;
  let card=adapter?a.closest(adapter):null;
  let method=card?'site-card':'single-product-container';
  if(!card){
   card=a;
   for(let i=0;i<5&&card.parentElement;i++){
    const parent=card.parentElement;
    const ids=new Set([...parent.querySelectorAll('a[href]')].map(observed).filter(Boolean));
    if(ids.size!==1||clean(parent.innerText).length>1800)break;
    card=parent;
    if(/[₹$£€]|\bINR\b/.test(card.innerText))break;
   }
  }
  // Reject a selector match if a redesign turned it into a multi-product wrapper.
  if(new Set([...card.querySelectorAll('a[href]'),...(card.matches('a[href]')?[card]:[])].map(observed).filter(Boolean)).size!==1)continue;
  const text=clean(card.innerText).slice(0,1200);
  const heading=card.querySelector('h2,h3,h4,[data-testid="product-title"],.product-product');
  const img=card.querySelector('img');
  const title=clean(heading?.innerText||img?.alt||a.innerText).slice(0,240);
  if(title.length<8)continue;
  const preferred=card.querySelector('.a-price:not(.a-text-price) .a-offscreen,.product-discountedPrice,.product-price');
  // Never use a struck-through list price as the selling price.
  const clone=card.cloneNode(true);clone.querySelectorAll('del,s,strike,.a-text-price,.product-strike').forEach(e=>e.remove());
  const priceText=clean(preferred?.textContent||clone.textContent);
  const price=priceText.match(/(?:₹|INR\s*|Rs\.?\s*|\$|£|€)\s*[\d,]+(?:\.\d{1,2})?/);
  const image=url(img?.currentSrc||img?.getAttribute('data-src')||img?.src);
  out.push({url:href,title,evidence:text,price:price?.[0]||null,image:image?.href||null,
   observed_at:new Date().toISOString(),evidence_url:location.href,extraction:method,verification:{status:'card_only',reason:'Observed in one product card; product page not checked.'}});
  if(out.length>=80)break;
 }
 return out;
})()
