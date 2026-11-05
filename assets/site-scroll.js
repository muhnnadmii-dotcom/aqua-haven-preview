/* Shared motion for the home, collection and product pages. No content depends on it. */
(() => {
  const root = document.querySelector('.ah8-main, .catalog-v8, .product-v8, .hp-page');
  const button = document.querySelector('[data-scroll-motion-control]');
  if (!root || !button || !('IntersectionObserver' in window) || !Element.prototype.animate) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width: 760px)');
  // Retain the original key so existing homepage preferences apply everywhere.
  const storageKey = 'aqua-haven.home-motion.paused';
  const readPreference = () => { try { return localStorage.getItem(storageKey) === 'true'; } catch { return false; } };
  let userPaused = readPreference(), paused = false, frame = 0, heroVisible = false;
  const played = new WeakSet(), running = new Map(), targets = new Set(), delays = new Map();
  const selector = [
    '.ah8-section-head', '.ah8-specimen', '.ah8-featured-product', '.ah8-product-study',
    '.ah8-making-craft', '.ah8-making-water', '.ah8-studio-sheet', '.ah8-endnote',
    '.catalog-listing-heading', '.collection-card', '.collection-story-frame', '.collection-story-copy',
    '.product-image-stage', '.product-summary-copy', '.product-details-aside',
    '.product-details-content > details', '.catalog-section-heading', '[data-reveal]'
  ].join(',');
  const hero = root.querySelector('.ah8-cover-scene, .exhibit-stage');
  const heroImage = hero?.querySelector(':scope > img');
  const grid = root.querySelector('#aq-product-grid');

  function finish(element) {
    const animation = running.get(element);
    if (animation) { animation.finish(); running.delete(element); }
  }
  function forget(element) {
    revealObserver.unobserve(element);
    running.get(element)?.cancel();
    running.delete(element); targets.delete(element); delays.delete(element);
  }
  function setDelays(group) {
    const columns = group.matches('.collection-grid') ? (compact.matches ? 2 : 4) : 3;
    [...group.children].forEach((element, index) => delays.set(element, (index % columns) * 90));
  }
  function register(element) {
    if (targets.has(element)) return;
    targets.add(element);
    if (!paused && !played.has(element)) revealObserver.observe(element);
  }
  function reveal(element, entry) {
    if (played.has(element) || !element.isConnected) return;
    played.add(element);
    if (paused || entry.boundingClientRect.top < 95 || element.contains(document.activeElement)) return;
    const photo = element.matches('.ah8-making-craft, .ah8-making-water, .collection-story-frame');
    const distance = element.matches('.product-image-stage') ? 8 : compact.matches ? 18 : photo ? 34 : 26;
    const animation = element.animate([
      {opacity: 0, transform: `translate3d(0,${distance}px,0)`},
      {opacity: 1, transform: 'translate3d(0,0,0)'}
    ], {duration: compact.matches ? 520 : photo ? 780 : 650, delay: delays.get(element) || 0,
      easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards'});
    running.set(element, animation);
    animation.finished.then(() => { if (running.get(element) === animation) running.delete(element); }).catch(() => {});
  }
  const revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      revealObserver.unobserve(entry.target); reveal(entry.target, entry);
    }
  }, {threshold: 0.08, rootMargin: '0px 0px -32px 0px'});

  function resetPhoto() {
    hero?.classList.remove('site-parallax-active');
    heroImage?.style.removeProperty('--site-photo-offset');
  }
  function drawPhoto() {
    frame = 0;
    if (paused || compact.matches || !heroVisible || document.hidden || !heroImage) { resetPhoto(); return; }
    const box = hero.getBoundingClientRect();
    const progress = Math.max(-1, Math.min(1, (innerHeight / 2 - box.top - box.height / 2) / (innerHeight / 2 + box.height / 2)));
    hero.classList.add('site-parallax-active');
    heroImage.style.setProperty('--site-photo-offset', `${(progress * 14).toFixed(2)}px`);
  }
  function schedulePhoto() {
    if (!frame && !paused && heroVisible && !compact.matches && !document.hidden) frame = requestAnimationFrame(drawPhoto);
  }
  const photoObserver = new IntersectionObserver(entries => {
    heroVisible = entries.some(entry => entry.isIntersecting);
    if (heroVisible) schedulePhoto(); else resetPhoto();
  });
  if (hero) photoObserver.observe(hero);

  function applyPreference() {
    paused = reduced.matches || userPaused;
    root.dataset.scrollMotion = paused ? 'off' : 'on';
    button.hidden = false; button.disabled = reduced.matches;
    button.setAttribute('aria-pressed', String(paused));
    button.querySelector('[data-scroll-motion-label]').textContent = reduced.matches ? 'الحركة متوقفة' : paused ? 'تشغيل الحركة' : 'إيقاف الحركة';
    button.querySelector('[data-scroll-motion-icon]').textContent = paused ? '▷' : 'Ⅱ';
    button.title = reduced.matches ? 'الحركة متوقفة حسب إعداد تقليل الحركة في جهازك' : '';
    revealObserver.disconnect();
    if (paused) {
      for (const element of [...running.keys()]) finish(element);
      cancelAnimationFrame(frame); frame = 0; resetPhoto();
    } else {
      for (const element of targets) if (!played.has(element)) revealObserver.observe(element);
      schedulePhoto();
    }
  }
  root.querySelectorAll('.ah8-specimens, .ah8-product-studies, .collection-grid').forEach(setDelays);
  root.querySelectorAll(selector).forEach(register);
  if (grid) new MutationObserver(records => {
    for (const record of records) for (const element of record.removedNodes) if (element.nodeType === 1) forget(element);
    setDelays(grid);
    for (const element of grid.children) if (element.matches('.collection-card')) register(element);
  }).observe(grid, {childList: true});
  document.addEventListener('haven:content-change', () => {
    root.querySelectorAll(selector).forEach(register);
  });
  button.addEventListener('click', () => {
    userPaused = !userPaused;
    try { localStorage.setItem(storageKey, String(userPaused)); } catch {}
    applyPreference();
  });
  root.addEventListener('focusin', event => {
    for (const element of targets) if (element.contains(event.target)) {
      played.add(element); revealObserver.unobserve(element); finish(element);
    }
  });
  addEventListener('scroll', schedulePhoto, {passive: true});
  addEventListener('resize', schedulePhoto, {passive: true});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; resetPhoto(); }
    else schedulePhoto();
  });
  compact.addEventListener('change', () => {
    root.querySelectorAll('.ah8-specimens, .ah8-product-studies, .collection-grid').forEach(setDelays);
    resetPhoto(); schedulePhoto();
  });
  reduced.addEventListener('change', applyPreference);
  addEventListener('storage', event => { if (event.key === storageKey || event.key === null) { userPaused = readPreference(); applyPreference(); } });
  addEventListener('pageshow', () => { userPaused = readPreference(); applyPreference(); });
  applyPreference();
})();
