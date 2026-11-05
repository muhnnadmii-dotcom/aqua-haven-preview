(()=>{
  const motion=document.querySelector('.atlas-motion');
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  function setMotion(paused){const systemPaused=reduced.matches;paused=systemPaused||paused;document.body.classList.toggle('motion-paused',paused);if(!motion)return;motion.disabled=systemPaused;motion.title=systemPaused?'الحركة متوقفة حسب إعداد تقليل الحركة في جهازك':'';motion.setAttribute('aria-pressed',String(paused));motion.querySelector('[data-motion-label]').textContent=systemPaused?'الحركة متوقفة':paused?'تشغيل الحركة':'إيقاف الحركة';motion.querySelector('.pause-symbol').textContent=paused?'▷':'Ⅱ';}
  setMotion(reduced.matches);
  motion?.addEventListener('click',()=>setMotion(!document.body.classList.contains('motion-paused')));
  reduced.addEventListener('change',e=>setMotion(e.matches));
  const scenes={water:{src:'assets/theme/assets/photography/aquascape-details-03.webp',alt:'تفاصيل الماء والزجاج والنباتات',caption:'01 — الماء والضوء'},craft:{src:'assets/editorial/aquascape-craft.webp',alt:'تركيب الصخور وتشكيل الأكواسكيب',caption:'02 — الصخر والتكوين'},room:{src:'assets/editorial/aquascape-room.webp',alt:'حوض مزروع بإضاءة دافئة داخل الغرفة',caption:'03 — الحوض في مساحتك'}};
  const image=document.querySelector('#atlas-detail-image'),caption=document.querySelector('#atlas-detail-caption');
  document.querySelectorAll('[data-scene]').forEach(button=>button.addEventListener('click',()=>{const scene=scenes[button.dataset.scene];if(!scene||!image)return;image.src=scene.src;image.alt=scene.alt;caption.textContent=scene.caption;document.querySelectorAll('[data-scene]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}));
})();
