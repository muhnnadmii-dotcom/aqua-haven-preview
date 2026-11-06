/* Native disclosure only. The camera, scroll and pause controller stay unchanged. */
(() => {
  const picker = document.querySelector('.story-route-picker');
  if (!picker) return;
  const summary = picker.querySelector('summary');
  const close = (restoreFocus = false) => {
    if (!picker.open) return;
    picker.open = false;
    if (restoreFocus) summary?.focus({preventScroll: true});
  };
  picker.addEventListener('click', event => {
    if (event.target.closest('[data-story-chapter]')) close(true);
  });
  picker.addEventListener('keydown', event => {
    if (event.key === 'Escape' && picker.open) { close(true); event.preventDefault(); }
  });
  picker.addEventListener('focusout', event => {
    if (event.relatedTarget && !picker.contains(event.relatedTarget)) close();
  });
  document.addEventListener('click', event => { if (!picker.contains(event.target)) close(); });
})();
