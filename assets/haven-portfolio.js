/* Static portfolio enhancement: filtering and an accessible native image dialog.
   Articles and case-file links remain usable when this script is unavailable. */
(() => {
  'use strict';

  const allowedCategories = new Set(['all', 'freshwater', 'marine', 'nano']);
  const filterButtons = [...document.querySelectorAll('[data-project-filter]')];
  const projects = [...document.querySelectorAll('[data-project]')];
  const originalDisplay = new Map(projects.map(project => [project, {
    value: project.style.getPropertyValue('display'),
    priority: project.style.getPropertyPriority('display')
  }]));
  const count = document.querySelector('#portfolio-count');
  const digits = new Intl.NumberFormat('ar-SA');

  function categoryFromURL() {
    const category = new URL(location.href).searchParams.get('category');
    return allowedCategories.has(category) ? category : 'all';
  }

  function filter(category, updateURL = false) {
    if (!allowedCategories.has(category)) category = 'all';
    let visible = 0, focusedProjectHidden = false;
    for (const project of projects) {
      const categories = (project.dataset.categories || '').split(/\s+/).filter(Boolean);
      const matches = category === 'all' || categories.includes(category);
      if (!matches && project.contains(document.activeElement)) focusedProjectHidden = true;
      project.hidden = !matches;
      // A card's author-level display:grid/flex must not override the hidden state.
      if (!matches) project.style.setProperty('display', 'none', 'important');
      else {
        const display = originalDisplay.get(project);
        if (display.value) project.style.setProperty('display', display.value, display.priority);
        else project.style.removeProperty('display');
      }
      if (matches) visible++;
    }
    for (const button of filterButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.projectFilter === category));
    }
    if (focusedProjectHidden) filterButtons.find(button => button.dataset.projectFilter === category)?.focus({ preventScroll: true });
    if (count) count.textContent = visible === 0 ? 'لا توجد أحواض في هذا التصنيف.' : visible === 1 ? 'عدد الأحواض: ١' : `عدد الأحواض: ${digits.format(visible)}`;
    if (updateURL) {
      const url = new URL(location.href);
      if (category === 'all') url.searchParams.delete('category');
      else url.searchParams.set('category', category);
      try { history.replaceState(history.state, '', url.pathname + url.search + url.hash); } catch {}
    }
    document.dispatchEvent(new CustomEvent('haven:content-change', {
      bubbles: true,
      detail: { source: 'portfolio', category, count: visible }
    }));
  }

  for (const button of filterButtons) {
    button.addEventListener('click', () => filter(button.dataset.projectFilter, true));
  }
  if (projects.length || filterButtons.length) {
    filter(categoryFromURL());
    addEventListener('popstate', () => filter(categoryFromURL()));
  }

  const payload = document.querySelector('#haven-projects');
  const dialog = document.querySelector('#portfolio-lightbox');
  const title = document.querySelector('#gallery-title');
  const image = document.querySelector('#gallery-image');
  const caption = document.querySelector('#gallery-caption');
  const counter = document.querySelector('#gallery-counter');
  const thumbnails = document.querySelector('#gallery-thumbnails');
  const previous = dialog?.querySelector('[data-gallery-prev]');
  const next = dialog?.querySelector('[data-gallery-next]');
  const closeButtons = dialog ? [...dialog.querySelectorAll('[data-gallery-close]')] : [];
  if (!payload || !dialog || typeof dialog.showModal !== 'function' || !title || !image || !caption || !counter || !thumbnails || !previous || !next || !closeButtons.length) return;

  let entries;
  try { entries = JSON.parse(payload.textContent || '[]'); } catch { return; }
  if (!Array.isArray(entries)) return;
  const galleries = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry.slug !== 'string' || !Array.isArray(entry.images)) continue;
    const images = entry.images.filter(item => item && typeof item.src === 'string' && item.src.trim()).map(item => ({
      src: item.src,
      alt: typeof item.alt === 'string' ? item.alt : ''
    }));
    if (images.length) galleries.set(entry.slug, {
      title: typeof entry.title === 'string' ? entry.title : 'صور العمل',
      images
    });
  }

  let current = null;
  let index = 0;
  let opener = null;
  let thumbnailButtons = [];

  function displayImage(nextIndex) {
    if (!current) return;
    index = (nextIndex % current.images.length + current.images.length) % current.images.length;
    const selected = current.images[index];
    image.alt = selected.alt || `${current.title} — الصورة ${digits.format(index + 1)}`;
    image.src = selected.src;
    caption.textContent = selected.alt || current.title;
    counter.textContent = `الصورة ${digits.format(index + 1)} من ${digits.format(current.images.length)}`;
    thumbnailButtons.forEach((button, position) => {
      if (position === index) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
    // Do not rebuild or focus the thumbnails: keyboard focus stays on the control used.
  }

  function openGallery(slug, trigger) {
    const gallery = galleries.get(slug);
    if (!gallery) return;
    current = gallery;
    opener = trigger instanceof HTMLElement ? trigger : document.activeElement;
    title.textContent = current.title;
    thumbnailButtons = current.images.map((item, position) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gallery-thumb';
      button.setAttribute('aria-label', `عرض الصورة ${digits.format(position + 1)} من ${digits.format(current.images.length)}`);
      const thumb = document.createElement('img');
      thumb.src = item.src;
      thumb.alt = '';
      thumb.width = 96;
      thumb.height = 72;
      thumb.loading = 'lazy';
      thumb.decoding = 'async';
      button.append(thumb);
      button.addEventListener('click', () => displayImage(position));
      return button;
    });
    thumbnails.replaceChildren(...thumbnailButtons);
    previous.disabled = next.disabled = current.images.length < 2;
    dialog.setAttribute('aria-labelledby', title.id);
    const requestedIndex = Number(trigger?.dataset.galleryIndex ?? 0);
    const initialIndex = Number.isInteger(requestedIndex) ? Math.max(0, Math.min(current.images.length - 1, requestedIndex)) : 0;
    displayImage(initialIndex);
    if (!dialog.open) dialog.showModal();
    closeButtons[0].focus({ preventScroll: true });
  }

  for (const button of document.querySelectorAll('[data-gallery-open]')) {
    button.addEventListener('click', () => openGallery(button.dataset.galleryOpen, button));
  }
  previous.addEventListener('click', () => displayImage(index - 1));
  next.addEventListener('click', () => displayImage(index + 1));
  for (const button of closeButtons) button.addEventListener('click', () => dialog.close());

  dialog.addEventListener('keydown', event => {
    if (!dialog.open || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target.matches('input,textarea,select'))) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); displayImage(index + 1); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); displayImage(index - 1); }
    // Escape and focus containment are provided by the native modal dialog.
  });
  dialog.addEventListener('close', () => {
    const restore = opener;
    opener = null;
    current = null;
    if (restore instanceof HTMLElement && restore.isConnected && !restore.closest('[hidden],[inert]') && restore.getClientRects().length) {
      restore.focus({ preventScroll: true });
    } else {
      filterButtons.find(button => button.getAttribute('aria-pressed') === 'true')?.focus({ preventScroll: true });
    }
  });
})();
