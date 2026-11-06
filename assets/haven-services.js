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
  let saveTimer = 0, prepared = false, restored = false, revision = 0, copying = false;
  let storageState = {status:'unavailable'};
  form.noValidate=true;
  const owns = (object, value) => typeof value === 'string' && Object.prototype.hasOwnProperty.call(object, value);
  const dimensions = [fields.length,fields.width,fields.height];
  const dimensionMax = new Map([[fields.length,400],[fields.width,200],[fields.height,200]]);
  dimensions.forEach(field=>{field.type='text';field.inputMode='numeric';});
  fields.idea.dir='auto';summary.dir='auto';
  function dimension(value, max) {
    const str = typeof value === 'string' ? value.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-0x660)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-0x6f0)) : '';
    return /^\d{1,3}$/.test(str) && Number.isSafeInteger(Number(str)) && Number(str) >= 10 && Number(str) <= max ? Number(str) : null;
  }
  function validStored(input) {
    const d=input?.draft;
    return input&&typeof input==='object'&&!Array.isArray(input)&&input.version===1&&d&&typeof d==='object'&&!Array.isArray(d)&&owns(serviceNames,d.service)&&owns(systemNames,d.system)&&owns(placeNames,d.place)&&['length','width','height','idea'].every(name=>typeof d[name]==='string');
  }
  function currentDraft() {
    // Incomplete input remains editable after reload, rather than becoming blank.
    return Object.fromEntries(Object.entries(fields).map(([name,field]) => [name,field.value]));
  }
  function fill(draft) {
    for (const [name,field] of Object.entries(fields)) field.value = draft[name];
  }
  function updateHints() {
    $('hs-service-context').textContent = hints[fields.service.value] || hints.custom;
    $('hs-idea-count').textContent = digits.format(fields.idea.value.length) + ' / ' + digits.format(600);
  }
  function fieldError(field,message,show) {
    field.setCustomValidity(message);
    if(show||field.getAttribute('aria-invalid')==='true'){
      if(message)field.setAttribute('aria-invalid','true');else field.removeAttribute('aria-invalid');
      const error=$(field.id+'-error');if(error){error.textContent=message;error.hidden=!message;}
    }
  }
  function validate(show = false,focus = show) {
    let first=null;
    const filled=dimensions.filter(field=>field.value.trim()!=='').length;
    for(const field of dimensions){
      const max=dimensionMax.get(field),blank=field.value.trim()==='';
      const message=blank?(filled?'أكمل الأبعاد الثلاثة، أو اتركها جميعًا فارغة.':''):(dimension(field.value,max)===null?`أدخل عددًا صحيحًا من ١٠ إلى ${digits.format(max)} سم.`:'');
      fieldError(field,message,show);if(message&&!first)first=field;
    }
    const ideaLength=fields.idea.value.trim().length;
    const message=fields.idea.value.length>600?'اكتب الملاحظات في ٦٠٠ حرف أو أقل، مع احتساب الرموز.':ideaLength>0&&ideaLength<10?'اكتب ملاحظة من ١٠ أحرف على الأقل، أو اترك الحقل فارغًا.':'';
    fieldError(fields.idea,message,show);if(message&&!first)first=fields.idea;
    for(const [name,names]of [['service',serviceNames],['system',systemNames],['place',placeNames]]){
      const message=owns(names,fields[name].value)?'':'اختر أحد الخيارات المتاحة.';fieldError(fields[name],message,show);if(message&&!first)first=fields[name];
    }
    if(first&&focus){first.focus();first.reportValidity();}
    return !first;
  }
  function saveDraft(message = '') {
    const draft = currentDraft();
    const payload = JSON.stringify({...storageState.value,version:1, updatedAt:new Date().toISOString(), draft:{...storageState.value?.draft,...draft}});
    try {
      if(!['missing','ready'].includes(storageState.status))throw new Error('Existing draft unavailable.');
      if (payload.length > 5000) throw new Error('Draft exceeds local limit.');
      if(localStorage.getItem(key)!==storageState.raw)throw new Error('Draft changed in another page.');
      localStorage.setItem(key,payload);
      storageState={status:'ready',raw:payload,value:JSON.parse(payload)};
      status.textContent = message || 'حُفظت المسودة في هذا المتصفح. لم تُرسل إلى أكوا هافن.';
      return true;
    } catch {
      status.textContent = 'تعذّر حفظ آخر تعديل. بقيت المسودة السابقة كما هي؛ جهّز الملخص وانسخه قبل مغادرة الصفحة.';
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
    const length=dimension(draft.length,400),width=dimension(draft.width,200),height=dimension(draft.height,200);
    if (length!==null && width!==null && height!==null) {
      lines.push('الأبعاد التقريبية: طول ' + digits.format(length) + ' × عرض ' + digits.format(width) + ' × ارتفاع ' + digits.format(height) + ' سم');
      lines.push('الحجم الهندسي التقريبي: ' + digits.format(length * width * height / 1000) + ' لتر');
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
    revision++;
    updateHints();
    // Refresh existing errors quietly; new errors appear on blur or preparation.
    validate();
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
    if (!prepared||copying) return;
    const content = summary.textContent;
    const requestRevision=revision;copying=true;copy.disabled=true;
    let copied = false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(content); copied = true;
      }
    } catch { /* Local selection fallback below. */ }
    if(requestRevision!==revision){copying=false;copy.disabled=!prepared;return;}
    if (!copied) {
      try { if (selectSummary()) copied = document.execCommand('copy'); } catch { copied = false; }
    }
    copyStatus.textContent = copied ? 'نُسخ الملخص. لم يُرسل إلى أي جهة.' : 'تعذّر النسخ التلقائي. حدّد نص الملخص وانسخه يدويًا.';
    copying=false;copy.disabled=!prepared;
    if (copied) copy.focus({preventScroll:true});
  }
  function clearDraft() {
    try {
      if(storageState.status==='unavailable'||localStorage.getItem(key)!==storageState.raw)throw new Error('Draft changed.');
      localStorage.removeItem(key);
    } catch {status.textContent='تعذّر حذف المسودة. بقيت الحقول وبيانات التخزين كما هي؛ أعد فتح الصفحة وحاول مجددًا.';return;}
    storageState={status:'missing',raw:null,value:null};revision++;
    clearTimeout(saveTimer); saveTimer = 0; form.reset();
    Object.values(fields).forEach(field=>fieldError(field,'',true));
    summary.textContent = emptySummary; prepared = false; copy.disabled = true; copyStatus.textContent = ''; updateHints();
    status.textContent = 'حُذفت مسودة الخدمة من هذا المتصفح. يمكنك البدء من جديد.';
    fields.service.focus({preventScroll:true});
  }

  try {
    const raw=localStorage.getItem(key);storageState={status:raw===null?'missing':'invalid',raw,value:null};
    if (raw!==null) {
      if (raw.length > 7000) throw new Error('Invalid local draft size.');
      const stored = JSON.parse(raw);
      if (!validStored(stored)) throw new Error('Unknown local draft.');
      storageState={status:'ready',raw,value:stored};
      fill(stored.draft); restored = true;
      status.textContent = 'استُعيدت مسودتك من هذا المتصفح. لم تُرسل إلى أكوا هافن.';
    }
  } catch {
    status.textContent = 'تعذّر استعادة مسودة الخدمة. بقيت بياناتها كما هي؛ يمكنك تجهيز ملخص جديد ونسخه.';
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
  [...dimensions,fields.idea].forEach(field=>field.addEventListener('blur',()=>validate(true,false)));
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
