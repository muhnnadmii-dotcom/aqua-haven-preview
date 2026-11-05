/* One photographic opening; the rest of the page remains ready to read. */
(() => {
  const root = document.querySelector('.ah10-main');
  const button = root?.querySelector('[data-scroll-motion-control]');
  if (!root || !button) return;
  const preferenceKey = 'aqua-haven.home-motion.paused';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const readPaused = () => { try { return localStorage.getItem(preferenceKey) === 'true'; } catch { return false; } };
  let userPaused = readPaused();
  let animation = null;
  let opened = false;
  const photo = root.querySelector('.ah10-work-image');
  const pauseIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>';
  const playIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>';
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    if (opened || reduced.matches || userPaused || document.hidden) return;
    if (!entries.some(entry => entry.isIntersecting)) return;
    if (!photo?.animate) return;
    opened = true;
    observer.unobserve(photo);
    animation = photo.animate([
      {clipPath: 'inset(0 6% 0 6%)'},
      {clipPath: 'inset(0 0% 0 0%)'}
    ], {duration: 850, easing: 'cubic-bezier(.16,1,.3,1)'});
    animation.finished.then(() => { animation = null; }).catch(() => {});
  }, {threshold: .12}) : null;
  function applyPreference() {
    const stopped = reduced.matches || userPaused;
    root.dataset.scrollMotion = stopped ? 'off' : 'on';
    button.hidden = false;
    button.disabled = reduced.matches;
    button.setAttribute('aria-pressed', String(stopped));
    button.querySelector('[data-scroll-motion-label]').textContent = reduced.matches ? 'الحركة متوقفة' : stopped ? 'تشغيل الحركة' : 'إيقاف الحركة';
    button.querySelector('[data-scroll-motion-icon]').innerHTML = stopped ? playIcon : pauseIcon;
    button.title = reduced.matches ? 'حسب إعداد تقليل الحركة في جهازك' : '';
    if (stopped) {
      animation?.cancel();
      animation = null;
      observer?.disconnect();
    } else if (photo && !opened) observer?.observe(photo);
  }
  button.addEventListener('click', () => {
    userPaused = !userPaused;
    try { localStorage.setItem(preferenceKey, String(userPaused)); } catch {}
    applyPreference();
  });
  photo?.addEventListener('focusin', () => { animation?.cancel(); animation = null; opened = true; });
  reduced.addEventListener('change', applyPreference);
  addEventListener('storage', event => {
    if (event.key === preferenceKey || event.key === null) { userPaused = readPaused(); applyPreference(); }
  });
  addEventListener('pageshow', () => { userPaused = readPaused(); applyPreference(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { animation?.cancel(); animation = null; }
    else applyPreference();
  });
  applyPreference();
})();
