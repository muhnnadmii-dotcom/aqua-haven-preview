/* Shared navigation uses native links and details; no order/account data is created. */
(() => {
  const header = document.querySelector('.ah-header');
  if (!header) return;
  header.classList.add('is-ready');
  const menu = header.querySelector('.ah-menu-toggle');
  const nav = header.querySelector('.ah-nav');
  const cart = header.querySelector('.ah-cart-preview');
  const mobile = matchMedia('(max-width:960px)');
  const closeMenu = (returnFocus = false) => {
    menu?.setAttribute('aria-expanded', 'false');
    menu?.setAttribute('aria-label', 'فتح القائمة');
    nav?.classList.remove('is-open');
    if (returnFocus) menu?.focus({ preventScroll: true });
  };
  const closeCart = (returnFocus = false) => {
    if (!cart?.open) return;
    cart.open = false;
    if (returnFocus) cart.querySelector('summary')?.focus({ preventScroll: true });
  };
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    closeCart();
    if (!open) return closeMenu(true);
    menu.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-label', 'إغلاق القائمة');
    nav?.classList.add('is-open');
    nav?.querySelector('a')?.focus({ preventScroll: true });
  });
  cart?.addEventListener('toggle', () => { if (cart.open) closeMenu(); });
  header.querySelector('.ah-cart-close')?.addEventListener('click', () => closeCart(true));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (cart?.open) { closeCart(true); event.preventDefault(); }
    else if (menu?.getAttribute('aria-expanded') === 'true') { closeMenu(true); event.preventDefault(); }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.ah-header')) { closeMenu(); closeCart(); }
    else if (!event.target.closest('.ah-cart-preview')) closeCart();
  });
  header.addEventListener('focusout', event => {
    if (event.relatedTarget && !header.contains(event.relatedTarget)) { closeMenu(); closeCart(); }
  });
  nav?.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  cart?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => closeCart()));
  mobile.addEventListener('change', () => { closeMenu(); closeCart(); });
})();
