/* Homepage-only motion. Content is visible by default, including when JS is unavailable. */
(() => {
  const root = document.querySelector('body.home-v8 .ah8-main');
  const button = document.querySelector('#home-motion-toggle');
  if (!root || !button || !('IntersectionObserver' in window) || !Element.prototype.animate) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width: 760px)');
  const storageKey = 'aqua-haven.home-motion.paused';
  let userPaused = false;
  try { userPaused = localStorage.getItem(storageKey) === 'true'; } catch {}
  let paused = false, frame = 0, heroVisible = false;
  const played = new WeakSet(), running = new Map();
  const targets = [...root.querySelectorAll('.ah8-section-head, .ah8-specimen, .ah8-featured-product, .ah8-product-study, .ah8-making-craft, .ah8-making-water, .ah8-studio-sheet, .ah8-endnote')];
  const delays = new Map();
  for (const group of root.querySelectorAll('.ah8-specimens, .ah8-product-studies')) {
    [...group.children].forEach((element, index) => delays.set(element, Math.min(index, 2) * 90));
  }
  const hero = root.querySelector('.ah8-cover-scene');
  const heroImage = hero?.querySelector(':scope > img');

  function finish(element) {
    const animation = running.get(element);
    if (animation) { animation.finish(); running.delete(element); }
  }
  function reveal(element, entry) {
    if (played.has(element)) return;
    played.add(element);
    // Anchors, keyboard focus and fast jumps should never leave text waiting to appear.
    if (paused || entry.boundingClientRect.top < 95 || element.contains(document.activeElement)) return;
    const photo = element.matches('.ah8-making-craft, .ah8-making-water');
    const distance = compact.matches ? 18 : (photo ? 34 : 26);
    const animation = element.animate([
      { opacity: 0, transform: `translate3d(0,${distance}px,0)` },
      { opacity: 1, transform: 'translate3d(0,0,0)' }
    ], {
      duration: compact.matches ? 520 : (photo ? 780 : 650),
      delay: delays.get(element) || 0,
      easing: 'cubic-bezier(.22,1,.36,1)',
      fill: 'backwards'
    });
    running.set(element, animation);
    animation.finished.then(() => { if (running.get(element) === animation) running.delete(element); }).catch(() => {});
  }
  const revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      revealObserver.unobserve(entry.target);
      reveal(entry.target, entry);
    }
  }, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' });

  function resetPhoto() {
    hero?.classList.remove('home-parallax-active');
    heroImage?.style.removeProperty('--home-photo-offset');
  }
  function drawPhoto() {
    frame = 0;
    if (paused || compact.matches || !heroVisible || document.hidden || !heroImage) { resetPhoto(); return; }
    const box = hero.getBoundingClientRect();
    const progress = Math.max(-1, Math.min(1, (innerHeight / 2 - box.top - box.height / 2) / (innerHeight / 2 + box.height / 2)));
    hero.classList.add('home-parallax-active');
    heroImage.style.setProperty('--home-photo-offset', `${(progress * 14).toFixed(2)}px`);
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
    button.hidden = false;
    button.disabled = reduced.matches;
    button.setAttribute('aria-pressed', String(paused));
    button.querySelector('[data-home-motion-label]').textContent = reduced.matches ? 'الحركة متوقفة' : paused ? 'تشغيل الحركة' : 'إيقاف الحركة';
    button.querySelector('[data-home-motion-icon]').textContent = paused ? '▷' : 'Ⅱ';
    button.title = reduced.matches ? 'الحركة متوقفة حسب إعداد تقليل الحركة في جهازك' : '';
    revealObserver.disconnect();
    if (paused) {
      for (const element of [...running.keys()]) finish(element);
      cancelAnimationFrame(frame); frame = 0; resetPhoto();
    } else {
      targets.filter(element => !played.has(element)).forEach(element => revealObserver.observe(element));
      schedulePhoto();
    }
  }
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
  addEventListener('scroll', schedulePhoto, { passive: true });
  addEventListener('resize', schedulePhoto, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; resetPhoto(); }
    else schedulePhoto();
  });
  compact.addEventListener('change', () => { resetPhoto(); schedulePhoto(); });
  reduced.addEventListener('change', applyPreference);
  addEventListener('pageshow', applyPreference);
  applyPreference();
})();
