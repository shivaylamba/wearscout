(() => {
 const clean=s=>(s||'').replace(/\s+/g,' ').trim();
 const text=clean(document.body?.innerText);
 const blocked=/verify you are human|unusual traffic|enter the characters|robot check|access denied|captcha/i.test(text.slice(0,3500));
 const h=location.hostname.replace(/^www\./,'');
 const selectors={
  'amazon.in':['#productTitle','#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen, #corePrice_feature_div .a-price .a-offscreen','#landingImage'],
  'meesho.com':['h1','h4','main img, img[alt]'],
  'myntra.com':['.pdp-name','.pdp-price','.image-grid-image']
 }[h];
 if(!selectors)return {url:location.href,blocked,title:null};
 const title=clean(document.querySelector(selectors[0])?.textContent);
 // On Meesho take price only from the heading's bounded parent region.
 let priceRoot=document;
 if(h==='meesho.com')priceRoot=document.querySelector('h1')?.parentElement;
 const price=clean(priceRoot?.querySelector(selectors[1])?.textContent);
 const img=document.querySelector(selectors[2]);
 return {url:location.href,blocked,title,price:price.match(/(?:₹|INR\s*|Rs\.?\s*|\$|£|€)\s*[\d,]+(?:\.\d{1,2})?/)?.[0]||null,
  image:img?.currentSrc||null,observed_at:new Date().toISOString()};
})()
