/* A bounded, device-only brief. No requests, contact fields, uploads or submissions. */
(() => {
  'use strict';
  const form = document.getElementById('hs-brief-form');
  if (!form) return;
  const $ = id => document.getElementById(id);
  const key = 'aqua-haven.services.brief.v1';
  const serviceNames = {custom:'تصميم وتركيب حوض', maintenance:'الصيانة والعناية', consultation:'استشارة فنية', business:'حلول الأعمال'};
  const systemNames = {undecided:'لم أحدد بعد', freshwater:'مياه عذبة', marine:'مياه بحرية'};
  const placeNames = {home:'مساحة منزلية', business:'مساحة أعمال'};
  const hints = {
    custom:'اذكر المكان والمقاس والتنسيق الذي تريده للحوض.',
    maintenance:'صف الحوض القائم وما يحتاج إلى مراجعة أو عناية.',
    consultation:'حدّد السؤال أو الملاحظة التي تريد توضيحها عن الحوض.',
    business:'اذكر المساحة وطبيعة استخدامها والشكل الذي تريده للحوض.',
  };
  const fields = {service:$('hs-service'), system:$('hs-system'), place:$('hs-place'), length:$('hs-length'), width:$('hs-width'), height:$('hs-height'), idea:$('hs-idea')};
  const generate = $('hs-generate'), clear = $('hs-clear'), copy = $('hs-copy');
  const summary = $('hs-brief-summary'), status = $('hs-storage-status'), copyStatus = $('hs-copy-status');
  const digits = new Intl.NumberFormat('ar-SA', {maximumFractionDigits:1});
  const emptySummary = 'اختر الخدمة وأضف بيانات الحوض، ثم اضغط «جهّز ملخص الخدمة».';
  let saveTimer = 0, prepared = false, restored = false;
  const owns = (object, value) => typeof value === 'string' && Object.prototype.hasOwnProperty.call(object, value);
  function dimension(value, max) {
    const str = typeof value === 'string' ? value.trim() : '';
    return /^\d{1,3}$/.test(str) && Number(str) >= 10 && Number(str) <= max ? String(Number(str)) : '';
  }
  function cleanDraft(input) {
    const d = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    return {
      service:owns(serviceNames,d.service) ? d.service : 'custom',
      system:owns(systemNames,d.system) ? d.system : 'undecided',
      place:owns(placeNames,d.place) ? d.place : 'home',
      length:dimension(d.length,400), width:dimension(d.width,200), height:dimension(d.height,200),
      idea:typeof d.idea === 'string' ? d.idea.replace(/\u0000/g,'').slice(0,600) : '',
    };
  }
  function currentDraft() {
    return cleanDraft(Object.fromEntries(Object.entries(fields).map(([name,field]) => [name,field.value])));
  }
  function fill(draft) {
    for (const [name,field] of Object.entries(fields)) field.value = draft[name];
  }
  function updateHints() {
    $('hs-service-context').textContent = hints[fields.service.value] || hints.custom;
    $('hs-idea-count').textContent = digits.format(fields.idea.value.length) + ' / ' + digits.format(600);
  }
  function validate(show = false) {
    const dimensions = [fields.length,fields.width,fields.height];
    dimensions.forEach(field => field.setCustomValidity(''));
    const filled = dimensions.filter(field => field.value !== '').length;
    if (filled > 0 && filled < 3) dimensions.filter(field => field.value === '').forEach(field => field.setCustomValidity('أكمل الأبعاد الثلاثة، أو اتركها جميعًا فارغة.'));
    fields.idea.setCustomValidity(fields.idea.value.trim().length > 0 && fields.idea.value.trim().length < 10 ? 'اكتب ملاحظة من 10 أحرف على الأقل، أو اترك الحقل فارغًا.' : '');
    return show ? form.reportValidity() : form.checkValidity();
  }
  function saveDraft(message = '') {
    const draft = currentDraft();
    const payload = JSON.stringify({version:1, updatedAt:new Date().toISOString(), draft});
    try {
      if (payload.length > 5000) throw new Error('Draft exceeds local limit.');
      localStorage.setItem(key,payload);
      status.textContent = message || 'حُفظت المسودة في هذا المتصفح. لم تُرسل إلى أكوا هافن.';
      return true;
    } catch {
      status.textContent = 'تعذّر الحفظ في هذا المتصفح. يمكنك تجهيز الملخص ونسخه قبل مغادرة الصفحة.';
      return false;
    }
  }
  function buildSummary(draft) {
    const lines = [
      'ملخص الخدمة — أكوا هافن',
      'الاحتياج: ' + serviceNames[draft.service],
      'نوع النظام: ' + systemNames[draft.system],
      'المكان: ' + placeNames[draft.place],
    ];
    if (draft.length && draft.width && draft.height) {
      lines.push('الأبعاد التقريبية: طول ' + digits.format(Number(draft.length)) + ' × عرض ' + digits.format(Number(draft.width)) + ' × ارتفاع ' + digits.format(Number(draft.height)) + ' سم');
      lines.push('الحجم الهندسي التقريبي: ' + digits.format(Number(draft.length) * Number(draft.width) * Number(draft.height) / 1000) + ' لتر');
    } else lines.push('الأبعاد: لم تتحدد بعد');
    if (draft.idea.trim()) lines.push('', 'الملاحظات:', draft.idea.trim());
    lines.push('', 'مسودة على جهازك — لم تُرسل إلى فريق أكوا هافن.', 'ليست حجزًا أو طلبًا أو عرض سعر.');
    return lines.join('\n');
  }
  function prepare() {
    if (!validate(true)) return false;
    clearTimeout(saveTimer); saveTimer = 0;
    summary.textContent = buildSummary(currentDraft());
    prepared = true; copy.disabled = false; copyStatus.textContent = '';
    saveDraft('حُفظت المسودة وحُدّث الملخص على جهازك. لم يُرسل أي طلب.');
    return true;
  }
  function changed() {
    updateHints();
    // Clear prior custom errors without surfacing validation on every keystroke.
    [fields.length,fields.width,fields.height,fields.idea].forEach(field => field.setCustomValidity(''));
    if (prepared) copyStatus.textContent = 'تغيّرت المسودة. جهّز الملخص مجددًا قبل نسخه.';
    prepared = false; copy.disabled = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {saveTimer = 0; saveDraft();},350);
  }
  function selectSummary() {
    summary.focus({preventScroll:true});
    const selection = window.getSelection();
    if (!selection) return false;
    const range = document.createRange();
    range.selectNodeContents(summary); selection.removeAllRanges(); selection.addRange(range);
    return true;
  }
  async function copySummary() {
    if (!prepared) return;
    const content = summary.textContent;
    let copied = false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(content); copied = true;
      }
    } catch { /* Local selection fallback below. */ }
    if (!copied) {
      try { if (selectSummary()) copied = document.execCommand('copy'); } catch { copied = false; }
    }
    copyStatus.textContent = copied ? 'نُسخ الملخص. لم يُرسل إلى أي جهة.' : 'تعذّر النسخ التلقائي. حدّد نص الملخص وانسخه يدويًا.';
    if (copied) copy.focus({preventScroll:true});
  }
  function clearDraft() {
    clearTimeout(saveTimer); saveTimer = 0; form.reset();
    [fields.length,fields.width,fields.height,fields.idea].forEach(field => field.setCustomValidity(''));
    summary.textContent = emptySummary; prepared = false; copy.disabled = true; copyStatus.textContent = ''; updateHints();
    try { localStorage.removeItem(key); status.textContent = 'حُذفت مسودة الخدمة من هذا المتصفح. يمكنك البدء من جديد.'; }
    catch { status.textContent = 'تم تفريغ الحقول هنا، لكن تعذّر حذف المسودة من تخزين المتصفح.'; }
    fields.service.focus({preventScroll:true});
  }

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      if (raw.length > 7000) throw new Error('Invalid local draft size.');
      const stored = JSON.parse(raw);
      if (!stored || stored.version !== 1 || !stored.draft) throw new Error('Unknown local draft.');
      fill(cleanDraft(stored.draft)); restored = true;
      status.textContent = 'استُعيدت مسودتك من هذا المتصفح. لم تُرسل إلى أكوا هافن.';
    }
  } catch {
    status.textContent = 'تعذّر استعادة مسودة الخدمة. يمكنك تجهيز ملخص جديد ونسخه.';
  }
  try {
    const requested = new URLSearchParams(location.search).get('service');
    if (owns(serviceNames,requested)) {fields.service.value = requested; if (!restored && requested === 'business') fields.place.value = 'business';}
  } catch { /* The default service remains selected. */ }
  updateHints();
  if (restored && validate()) {
    summary.textContent = buildSummary(currentDraft()); prepared = true; copy.disabled = false;
  }
  generate.disabled = false; clear.disabled = false;
  form.addEventListener('submit', event => {event.preventDefault(); if (prepare()) summary.focus();});
  form.addEventListener('input',changed);
  form.addEventListener('change',changed);
  clear.addEventListener('click',clearDraft);
  copy.addEventListener('click',copySummary);
  document.querySelectorAll('[data-service-choice]').forEach(button => button.addEventListener('click', () => {
    const service = button.dataset.serviceChoice;
    if (!owns(serviceNames,service)) return;
    fields.service.value = service;
    if (service === 'business') fields.place.value = 'business';
    changed();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || !!document.querySelector('main[data-scroll-motion="off"]');
    $('service-brief').scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});
    fields.service.focus({preventScroll:true});
  }));
  window.addEventListener('pagehide', () => {if (saveTimer) {clearTimeout(saveTimer); saveTimer=0; saveDraft();}});
})();
