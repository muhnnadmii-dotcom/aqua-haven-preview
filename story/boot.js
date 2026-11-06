// Reserve the already-approved journey before the browser evaluates lazy images.
// A broken module or opening image releases the reservation to the static page.
(() => {
  const root=document.documentElement;
  root.classList.add('story-pending');
  window.addEventListener('error',event=>{
    const node=event.target;
    if(node?.matches?.('script[src*="story.js"],.room-photo img,.underwater-backdrop'))root.classList.remove('story-pending');
  },true);
  window.addEventListener('unhandledrejection',()=>root.classList.remove('story-pending'),{once:true});
})();
