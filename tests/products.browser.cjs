// Run with NODE_PATH pointing to the local Playwright installation. No network/providers.
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
 const page=await browser.newPage();
 await page.route('https://www.amazon.in/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`
 <div data-component-type="s-search-result" data-asin="B012345678"><a href="/dp/B012345678"><h2>Blue floral summer dress</h2></a><span class="a-text-price">₹900</span><span class="a-price"><span class="a-offscreen">₹500</span></span></div>
 <div data-component-type="s-search-result" data-asin="B012345679"><a href="/dp/B012345679"><h2>Red linen summer dress</h2></a><span>₹800</span></div>
 <div><a href="/dp/B012345670"><h2>Green dress without price</h2></a><a href="/dp/B012345671"><h2>Black dress with price</h2><span>₹200</span></a></div>
 <div><a href="https://amazon.in.evil.test/dp/B012345672">Bad host dress ₹1</a></div>`}));
 await page.goto('https://www.amazon.in/s?k=dress');
 const rows=await page.evaluate(fs.readFileSync('jev_ultrafast/products.js','utf8'));
 assert.equal(rows.length,4);
 assert.equal(rows[0].price,'₹500');assert.equal(rows[1].price,'₹800');
 assert.equal(rows[2].price,null);assert.equal(rows[3].price,'₹200');
 assert.ok(rows.every(r=>r.verification.status==='card_only'));
 await page.route('https://www.meesho.com/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`<a href="/dress/p/abc123"><img alt="Blue floral dress" src="https://images.meesho.com/a.jpg"><p>Blue floral dress</p><h5>₹407</h5><del>₹508</del></a><a href="/shirt/p/xyz123"><img alt="Red linen shirt"><h5>₹800</h5></a>`}));
 await page.goto('https://www.meesho.com/search?q=dress');
 const meesho=await page.evaluate(fs.readFileSync('jev_ultrafast/products.js','utf8'));
 assert.equal(meesho.length,2);assert.equal(meesho[0].title,'Blue floral dress');assert.equal(meesho[0].price,'₹407');assert.equal(meesho[1].price,'₹800');
 await page.route('https://www.google.com/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`<div><a href="/url?q=https%3A%2F%2Fwww.amazon.in%2Fdp%2FB012345678"><h3>Blue floral summer dress</h3></a><span>₹500</span></div><a href="https://www.amazon.in/s?k=dress"><h3>Search results are not products</h3></a>`}));
 await page.goto('https://www.google.com/search?q=dress');
 const google=await page.evaluate(fs.readFileSync('jev_ultrafast/products.js','utf8'));
 assert.equal(google.length,1);assert.equal(google[0].url,'https://www.amazon.in/dp/B012345678');
 console.log('PASS: selling price, adjacent-card isolation, spoofed host, Meesho cards, Google direct links, card provenance');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
