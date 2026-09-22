# Threadline validation — 22 September 2026

## Live provider and browser checks

- Nebius authenticated model catalog returned `deepseek-ai/DeepSeek-V4.1-Flash`.
- A blue floral dress photo was analyzed using the model's image input. Responses identified dress, blue, floral, short sleeves and V-neck. Calls varied: 3.937 s, 5.268 s and 80.399 s were observed during development. This is not a latency benchmark.
- Final browser run used an actual prior Nebius response, retained during server restarts to avoid repeatedly billing image analysis. No synthetic garment output or product records were substituted.
- Live Chrome search retained 28 text-relevant products: {'Amazon India': 12, 'Meesho': 16}. Source statuses are partial because only a bounded sample was collected.
- Jev decision/relevance call latency in this run: median 404.5 ms, range 353–1344 ms. Browser/loading time is additional.
- Google Search accepted the query and rendered shopping results, but its carousel did not expose extractable direct product links in this run. It is marked without verified matches, not fabricated as successful. Myntra is implemented but not live-verified in this run.
- Product titles, URLs, prices and images originate in observed DOM cards. Meesho's first displayed price was checked against each returned card's title; Amazon tracking-link variants were deduplicated by ASIN. Prices are card observations, not checkout guarantees.
- Desktop UI rendered all 28 product cards and links; mobile layout checked at 390 px without horizontal overflow. No JavaScript page errors in upload/review interaction.

## Automated checks

71 Python tests pass, including new upload validation, vision contract, action restrictions, typed relevance output, cancellation, submitted-search evidence, deduplication and Enter action mapping. 52 inherited Node tests pass. Ruff, JavaScript syntax checks and package build pass. Offline browser fixture checks confirmed card-to-price association and rejection of unsafe URLs. Tests do not call paid APIs.

## Limits

This is a local Chrome prototype, not an autonomous purchasing system or a deployed multi-user service. Jev ranks textual relevance to Nebius's description, not pixel-to-pixel similarity. Site layouts, blocked access, dynamic loading and unclear product copy can affect results. Source exceptions are reported, and CAPTCHA checks are not bypassed.

Test image source (not distributed in the project): https://www.ebay.de/itm/406035492963 .

## Extraction and verification upgrade — 22 September 2026

- Added bounded Amazon, Meesho and Myntra card adapters. A container spanning more than one product is rejected. Product IDs deduplicate tracking URLs; duplicate records preserve images, and conflicting card prices are withheld.
- Google direct links to the three supported retailers are parsed, including `/url` wrappers. Google carousel-only entries and arbitrary retailer domains remain unsupported. Myntra adapter is not live-verified.
- Empty search pages are read again for up to four seconds to allow client-rendered cards to appear; no browser mutation is replayed.
- The top three Jev matches per source are opened in the existing dedicated browser tab. Product-ID redirects are rejected; blocked/read failures remain explicitly unverified. Detailed page titles and available page prices retain separate card provenance. Jev reassesses those page descriptions, so a generic search-card title is not mistaken for authoritative product detail.
- UI labels distinguish card evidence, product page checked, updated title, blocked checks and incomplete checks. Page checks do not verify exact visual match, sizing, inventory or delivery. Card prices remain labelled as such when no page price is extracted.

### Current live evidence

The existing Nebius description was reused (white sleeveless square-neck textured mini dress); vision was not billed again. Browser searches, Jev decisions, page verification and reassessment were fresh.

1. Amazon full UI flow: nine candidates observed; seven retained; three retained matches checked on their product pages and reassessed by Jev. Meesho in this run hit a Jev connection failure, recorded as a source error rather than a successful search.
2. A separate fresh Meesho UI run: 20 candidates collected (first 16 scored), three product pages checked, then two retained after page-evidence reassessment. Their page prices were ₹186 and ₹322 at observation. The third candidate was rejected by Jev after page inspection.
3. Both UI runs reported zero JavaScript page errors and no horizontal overflow at 390px.
4. Private local evidence: `artifacts/upgrade-live-results.json`, `artifacts/upgrade-meesho-results.json`, and corresponding desktop/mobile screenshots. These are excluded from source archives.

Offline checks: 78 Python tests, 52 inherited JavaScript tests, and Playwright DOM fixtures for Amazon selling-price selection, adjacent-card isolation, spoofed hosts, Meesho title/price extraction, Google direct links and evidence labels. Ruff, JavaScript syntax checks and wheel/source build passed. Fixture tests do not call models or shopping sites. Live results are bounded samples, not exhaustive coverage or a reliability benchmark.
