const $ = id => document.getElementById(id);
let image = null;
let busy = false;
let dirtyImage = false;
let lastGarment = '';
let lastEvents = '';
let lastResults = '';
let lastStatus = '';
let currentState = null;
let evidenceFilter = 'all';
let uploadVersion = 0;
let clientError = '';

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
function showError(error) {
  clientError = error.message || String(error);
  $('error').hidden = false;
  $('error').textContent = clientError;
}
async function request(path, body) {
  const response = await fetch('/api/' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Token': window.APP_TOKEN },
    body: JSON.stringify(body),
  });
  const state = await response.json();
  if (!response.ok) throw Error(state.error || 'Request failed. Please try again.');
  render(state);
  return state;
}
function file(selected) {
  if (!selected) return;
  if (busy) return showError(Error('Stop the active search before changing your photo.'));
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size > 5000000) {
    return showError(Error('Choose a JPG, PNG or WebP smaller than 5 MB.'));
  }
  const version = ++uploadVersion;
  const reader = new FileReader();
  reader.onerror = () => showError(Error('This photo could not be read. Choose another file.'));
  reader.onload = () => {
    if (version !== uploadVersion) return;
    image = reader.result;
    dirtyImage = true;
    clientError = '';
    lastGarment = '';
    $('preview').src = image;
    $('preview').hidden = false;
    $('drop-copy').hidden = true;
    $('change-photo').hidden = false;
    $('description').hidden = true;
    if (currentState) render(currentState);
    else $('analyze').disabled = false;
  };
  reader.readAsDataURL(selected);
}
$('photo').onchange = event => file(event.target.files[0]);
for (const type of ['dragenter', 'dragover']) {
  $('drop').addEventListener(type, event => {
    event.preventDefault();
    if (!busy) $('drop').classList.add('drag');
  });
}
$('drop').addEventListener('dragleave', () => $('drop').classList.remove('drag'));
$('drop').addEventListener('drop', event => {
  event.preventDefault();
  $('drop').classList.remove('drag');
  file(event.dataTransfer.files[0]);
});
$('analyze').onclick = async () => {
  clientError = '';
  $('analyze').disabled = true;
  try {
    await request('analyze', { image });
    dirtyImage = false;
  } catch (error) {
    showError(error);
    if (currentState) render(currentState);
  }
};
$('search').onclick = async () => {
  clientError = '';
  const sources = [...document.querySelectorAll('[name=shop]:checked')].map(node => node.value);
  if (!sources.length) return showError(Error('Choose at least one shop to search.'));
  if ($('query').value.trim().length < 3) {
    $('query').setAttribute('aria-invalid', 'true');
    return showError(Error('Add a search phrase of at least three characters.'));
  }
  $('query').removeAttribute('aria-invalid');
  $('search').disabled = true;
  evidenceFilter = 'all';
  try { await request('search', { query: $('query').value, sources }); }
  catch (error) { showError(error); if (currentState) render(currentState); }
};
$('stop').onclick = () => request('stop', {}).catch(showError);
for (const filter of ['all', 'checked']) {
  $('filter-' + filter).onclick = () => {
    evidenceFilter = filter;
    if (currentState) render(currentState);
  };
}
function pageChecked(record) {
  return ['page_checked', 'title_changed'].includes(record.verification?.status);
}
function product(record, index) {
  const card = el('article', undefined, 'product');
  const href = safeUrl(record.url);
  const media = el(href ? 'a' : 'div', undefined, 'product-media');
  if (href) {
    media.href = href;
    media.target = '_blank';
    media.rel = 'noopener noreferrer';
    media.setAttribute('aria-label', `View ${record.title} at ${record.source}`);
  }
  if (safeUrl(record.image)) {
    const img = el('img');
    img.src = record.image;
    img.alt = record.title;
    img.width = 450;
    img.height = 600;
    img.loading = index < 3 ? 'eager' : 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => img.replaceWith(el('div', 'Photo unavailable from this shop', 'no-photo'));
    media.append(img);
  } else media.append(el('div', 'No product photo observed', 'no-photo'));
  media.append(el('span', String(index + 1).padStart(2, '0'), 'product-number'));
  const meta = el('div', undefined, 'product-meta');
  meta.append(el('p', record.source, 'source'), el('span', record.price || 'Price not shown', 'price'));
  card.append(media, meta, el('h3', record.title), el('span', record.match === 'strong' ? 'Strong description match' : 'Possible description match', 'match'));
  const check = record.verification || { status: 'card_only', reason: 'Only search-card evidence is available.' };
  const label = {
    page_checked: '✓ Product page checked',
    title_changed: '✓ Product ID checked · title updated',
    card_only: 'Product card only',
    blocked: 'Page check blocked',
    unverified: 'Page check incomplete',
  }[check.status] || 'Not verified';
  const verification = el('p', label, 'verification');
  verification.dataset.checked = pageChecked(record);
  const actions = el('div', undefined, 'product-actions');
  const detail = el('details');
  detail.append(el('summary', 'Check details'), el('p', check.reason), el('p', record.evidence || ''));
  detail.append(el('p', record.page_price ? 'Price observed on the product page.' : 'Price from the search card; not confirmed on the product page.'));
  if (record.observed_at) detail.append(el('p', 'Observed ' + new Date(record.observed_at).toLocaleString()));
  actions.append(detail);
  if (href) {
    const link = el('a', 'View at shop ↗', 'shop-link');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    actions.append(link);
  }
  card.append(verification, actions);
  return card;
}
function emptyResults(state) {
  const box = el('div', undefined, 'no-results');
  let title = 'The piece is out there.';
  let copy = 'Start with a clothing photo. We’ll look across your selected shops and bring the closest descriptions together here.';
  let action = 'Choose a reference photo ↗';
  let onClick = () => $('photo').click();
  if (busy) {
    title = state.status === 'analyzing' ? 'Looking at the details.' : 'Your search is taking shape.';
    copy = 'Follow the browser and Jev’s decisions below. Products appear as each shop is checked.';
    action = 'Watch the search ↓';
    onClick = () => { $('activity-panel').open = true; $('activity-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
  } else if (evidenceFilter === 'checked' && state.results.length) {
    title = 'No page-checked finds yet.';
    copy = 'There are products with search-card evidence. Open all finds to see them and check the original shop.';
    action = 'Show all finds →';
    onClick = () => { evidenceFilter = 'all'; render(currentState); };
  } else if (['complete', 'stopped', 'error'].includes(state.status)) {
    title = state.status === 'stopped' ? 'Search stopped.' : 'No matches collected this time.';
    copy = 'Try a shorter phrase or another shop. The activity panel shows any blocked pages or failed requests.';
    action = 'Edit the search phrase ↑';
    onClick = () => { $('query').focus(); };
  } else if (state.garment && !dirtyImage) {
    title = 'Ready to find your version.';
    copy = 'Review the phrase, choose your shops, then start the search. Every result links back to the original product.';
    action = 'Review the search phrase ↑';
    onClick = () => $('query').focus();
  }
  const button = el('button', action, 'empty-action');
  button.type = 'button';
  button.onclick = onClick;
  box.append(el('h3', title), el('p', copy), button);
  return box;
}
function render(state) {
  currentState = state;
  busy = ['analyzing', 'searching', 'ranking', 'verifying', 'stopping'].includes(state.status);
  document.body.dataset.busy = busy;
  $('photo').disabled = busy;
  $('analyze').disabled = busy || !image;
  $('analyze-label').textContent = state.status === 'analyzing' ? 'Reading the photo…' : 'Describe the clothing';
  $('search').disabled = busy || !state.garment || dirtyImage;
  $('query').disabled = busy;
  document.querySelectorAll('[name=shop]').forEach(node => node.disabled = busy);
  $('stop').hidden = !busy;
  $('stop').disabled = state.status === 'stopping';
  $('results').setAttribute('aria-busy', busy);
  const statuses = { analyzing: 'Reading your photo', searching: 'Searching your selected shops', ranking: 'Comparing product descriptions', verifying: 'Checking the product pages', ready: 'Ready to search', complete: 'Search complete', stopped: 'Search stopped', stopping: 'Finishing the current request', error: 'Search needs attention' };
  $('run-status').textContent = dirtyImage ? 'New photo selected · describe it to start' : statuses[state.status] || 'Ready for your reference';
  $('connection').textContent = state.configuration.nebius && state.configuration.jev ? 'Nebius + Jev · Configured' : 'Setup needed: ' + [!state.configuration.nebius ? 'Nebius key' : '', !state.configuration.jev ? 'TypeSafe key' : ''].filter(Boolean).join(', ');
  $('error').hidden = !state.error && !clientError;
  $('error').textContent = clientError || state.error || '';
  if (!dirtyImage && state.garment && JSON.stringify(state.garment) !== lastGarment) {
    lastGarment = JSON.stringify(state.garment);
    $('description').hidden = false;
    $('garment').textContent = state.garment.description;
    $('query').value = state.garment.search_query;
    $('attributes').replaceChildren(...[state.garment.category, state.garment.color, state.garment.pattern, state.garment.silhouette].filter(x => x && x !== 'unknown').map(text => el('span', text)));
    $('uncertainty').textContent = state.garment.uncertainty.length ? state.garment.uncertainty.join(' ') : 'This is a visual description. Brand, fabric composition and exact product identity are not confirmed.';
  }
  if (!state.garment) $('description').hidden = true;
  if (state.screenshot) {
    const src = 'data:image/jpeg;base64,' + state.screenshot;
    if ($('screen').src !== src) $('screen').src = src;
  }
  $('screen').hidden = !state.screenshot;
  $('screen-empty').hidden = !!state.screenshot;
  $('url').textContent = state.page_url || 'Dedicated shopping browser';
  $('source-status').replaceChildren(...Object.values(state.sources).map(source => {
    const labels = { partial: 'sample collected', blocked: 'blocked', error: 'failed', queued: 'waiting', searching: 'searching', stopped: 'stopped' };
    const node = el('span', source.name + ' · ' + (labels[source.status] || source.status));
    node.title = source.message || '';
    node.dataset.status = source.status;
    return node;
  }));
  if (lastStatus !== state.status && busy && state.status !== 'analyzing') $('activity-panel').open = true;
  lastStatus = state.status;
  const events = JSON.stringify(state.events);
  if (events !== lastEvents) {
    lastEvents = events;
    $('event-count').textContent = state.events.length ? `(${state.events.length})` : '';
    $('events').replaceChildren(...(state.events.length ? [...state.events].reverse().map(event => {
      const li = el('li', event.message);
      li.append(el('small', [new Date(event.at * 1000).toLocaleTimeString(), event.model, event.latency_ms !== undefined ? (event.latency_ms / 1000).toFixed(2) + 's model call' : ''].filter(Boolean).join(' · ')));
      return li;
    }) : [el('li', 'Search actions and product checks will appear here.', 'empty-event')]));
  }
  const resultsKey = JSON.stringify([state.results, state.status, evidenceFilter, dirtyImage]);
  if (resultsKey !== lastResults) {
    lastResults = resultsKey;
    const shown = evidenceFilter === 'checked' ? state.results.filter(pageChecked) : state.results;
    $('result-count').textContent = state.results.length ? `${shown.length} of ${state.results.length} finds${dirtyImage ? ' · previous search' : ''}` : 'Your next find starts here';
    for (const filter of ['all', 'checked']) {
      $('filter-' + filter).classList.toggle('active', evidenceFilter === filter);
      $('filter-' + filter).setAttribute('aria-pressed', evidenceFilter === filter);
    }
    $('results').replaceChildren(...(shown.length ? shown.map(product) : [emptyResults(state)]));
  }
}
async function poll() {
  try {
    const response = await fetch('/api/state');
    if (!response.ok) throw Error('Cannot reach the local server');
    render(await response.json());
  } catch { $('connection').textContent = 'Local server disconnected · retrying'; }
  finally { setTimeout(poll, 900); }
}
poll();
