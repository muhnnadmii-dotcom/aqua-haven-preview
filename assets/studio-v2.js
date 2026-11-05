import {createTankScene} from './theme/assets/photo-scene.js';

export const DRAFT_KEY = 'aqua-haven-preview.draft.v1';
export const SAVED_KEY = 'aqua-haven-preview.saved.v1';
export function validDesign(c) {
  return !!c && [['length',40,160],['width',25,80],['height',25,80]].every(([k,min,max]) => Number.isInteger(c[k]) && c[k] >= min && c[k] <= max) && ['standard','ultra'].includes(c.glass) && ['filter','light','plants'].every(k => typeof c.addons?.[k] === 'boolean');
}
export function estimateDesign(c) {
  if (!validDesign(c)) throw new RangeError('Invalid design');
  const area = (c.length*c.width + 2*c.length*c.height + 2*c.width*c.height)/10000;
  const tank = Math.round(120+area*450)*(c.glass === 'ultra' ? 1.25 : 1);
  return {price:Math.round((tank+(c.addons.filter?129:0)+(c.addons.light?179:0)+(c.addons.plants?39:0))*100)/100,litres:Math.round(c.length*c.width*c.height/100)/10,tank};
}
export function savedEntries(value) {
  return Array.isArray(value) ? value.map((item,index) => ({item,index})).filter(({item}) => typeof item?.name === 'string' && validDesign(item.config)).slice(0,12) : [];
}
// Remove exactly one selected record, retaining every other record, including older formats.
export function removeSavedRecord(records, index, snapshot) {
  if (!Array.isArray(records)) return [];
  const next = records.slice();
  const fingerprint = JSON.stringify(snapshot);
  const current = JSON.stringify(next[index]) === fingerprint ? index : next.findIndex(item => JSON.stringify(item) === fingerprint);
  if (current >= 0) next.splice(current,1);
  return next;
}
const money = n => new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(n)+' ر.س';
const decimal = n => new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(n);
const read = key => {try {return JSON.parse(localStorage.getItem(key)||'null');} catch {return null;}};
const write = (key,value) => {try {localStorage.setItem(key,JSON.stringify(value));return true;} catch {return false;}};
function announce(message) {const status=document.querySelector('#studio-status');if(status)status.textContent=message;}
if (typeof document !== 'undefined') {
  if (document.querySelector('#tank-form')) initializeDesigner();
  if (document.querySelector('[data-drafts-page]')) initializeDrafts();
}
function initializeDesigner() {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const form=$('#tank-form'), name=$('#tank-name');
  const panels=$$('[data-studio-panel]'), stepLinks=$$('[data-studio-step]');
  const stepBack=$('#studio-step-back'), stepNext=$('#studio-step-next');
  let currentStep=0;
  const hasSteps=panels.length===3 && stepLinks.length===3 && stepBack && stepNext;
  function showStep(index,{focus=false,scroll=false}={}) {
    if(!hasSteps)return;
    currentStep=Math.max(0,Math.min(panels.length-1,index));
    panels.forEach((panel,i)=>panel.hidden=i!==currentStep);
    stepLinks.forEach((link,i)=>{if(i===currentStep)link.setAttribute('aria-current','step');else link.removeAttribute('aria-current');});
    const position=$('[data-step-position]');if(position)position.textContent=`${decimal(currentStep+1)} / ٣`;
    stepBack.disabled=currentStep===0;
    stepNext.querySelector('span').textContent=currentStep===panels.length-1?'راجع ملخصك':'الخطوة التالية';
    if(focus)panels[currentStep].querySelector('legend')?.focus({preventScroll:true});
    if(scroll)$('#studio-dimensions')?.closest('.studio-controls')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  }
  function validateForm() {
    const invalid=form.querySelector('input:invalid');
    if(invalid && hasSteps){const index=panels.indexOf(invalid.closest('[data-studio-panel]'));if(index>=0)showStep(index);}
    return form.reportValidity();
  }
  if(hasSteps){
    $('.studio-v8')?.classList.add('is-step-enhanced');
    $('.studio-step-footer').hidden=false;
    for(const [index,panel]of panels.entries()){
      $$(`a[href="#${panel.id}"]`).forEach(link=>link.addEventListener('click',event=>{event.preventDefault();showStep(index,{focus:true,scroll:true});}));
    }
    stepBack.addEventListener('click',()=>showStep(currentStep-1,{focus:true,scroll:true}));
    stepNext.addEventListener('click',()=>{
      const invalid=panels[currentStep].querySelector('input:invalid');
      if(invalid){invalid.reportValidity();return;}
      if(currentStep<panels.length-1)showStep(currentStep+1,{focus:true,scroll:true});
      else {$('#studio-estimate').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});$('#studio-summary-title')?.focus({preventScroll:true});}
    });
    const requested=panels.findIndex(panel=>'#'+panel.id===location.hash);
    showStep(requested>=0?requested:0);
    window.addEventListener('hashchange',()=>{const index=panels.findIndex(panel=>'#'+panel.id===location.hash);if(index>=0)showStep(index);});
  }
  let config={length:90,width:45,height:45,glass:'standard',addons:{filter:true,light:true,plants:true}};
  let paused=matchMedia('(prefers-reduced-motion: reduce)').matches, builder;
  const draft=read(DRAFT_KEY);
  if(validDesign(draft?.config)) {config=structuredClone(draft.config);name.value=typeof draft.name==='string'?draft.name.slice(0,80):'';}
  try {builder=createTankScene($('[data-scene="builder"]'),config);} catch {$('#scene-fallback').hidden=false;}
  function refresh() {
    const quote=estimateDesign(config);
    builder?.update(config);
    $('#scene-dimensions').textContent=`${config.length} × ${config.width} × ${config.height} cm`;
    $('#quote-price').textContent=money(quote.price);
    $('#quote-volume').textContent=decimal(quote.litres);
    const tankCost=$('#quote-tank-cost'), addonCost=$('#quote-addon-cost');
    if(tankCost && addonCost) {tankCost.textContent=money(quote.tank);addonCost.textContent=money(quote.price-quote.tank);}
    else $('#quote-breakdown').textContent=`الحوض ${money(quote.tank)} + الإضافات ${money(quote.price-quote.tank)}.`;
    $$('[data-preview-volume]').forEach(el=>el.textContent=decimal(quote.litres)+' لتر');
    $$('[data-preview-glass]').forEach(el=>el.textContent=config.glass==='ultra'?'فائق الصفاء':'صافي');
    $$('[data-preview-price]').forEach(el=>el.textContent=money(quote.price));
    write(DRAFT_KEY,{name:name.value.slice(0,80),config});
    $$('[data-preset]').forEach(button => {const active=button.dataset.preset===`${config.length},${config.width},${config.height}`;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active));});
  }
  function sync() {
    for(const key of ['length','width','height']) {$(`[data-dimension="${key}"]`).value=config[key];$(`[data-number="${key}"]`).value=config[key];}
    $$('input[name="glass"]').forEach(el => el.checked=el.value===config.glass);
    for(const key of ['filter','light','plants']) $(`input[name="${key}"]`).checked=config.addons[key];
    refresh();
  }
  $$('[data-dimension]').forEach(el => el.addEventListener('input',() => {const key=el.dataset.dimension;config[key]=Number(el.value);$(`[data-number="${key}"]`).value=el.value;refresh();}));
  $$('[data-number]').forEach(el => el.addEventListener('input',() => {
    if(!el.checkValidity() || el.value==='') return;
    const key=el.dataset.number;config[key]=Number(el.value);$(`[data-dimension="${key}"]`).value=el.value;refresh();
  }));
  $$('input[name="glass"]').forEach(el => el.addEventListener('change',() => {if(el.checked){config.glass=el.value;refresh();}}));
  for(const key of ['filter','light','plants']) $(`input[name="${key}"]`).addEventListener('change',event => {config.addons[key]=event.target.checked;refresh();});
  $$('[data-preset]').forEach(el => el.addEventListener('click',() => {[config.length,config.width,config.height]=el.dataset.preset.split(',').map(Number);sync();}));
  name.addEventListener('input',refresh);
  form.addEventListener('submit',event => event.preventDefault());
  $('#save-tank').addEventListener('click',() => {
    if(!validateForm()) return;
    const value=read(SAVED_KEY), records=Array.isArray(value)?value:[];
    if(savedEntries(records).length>=12) {announce('وصلت إلى ١٢ مسودة. احذف فكرة من صفحة مسوداتي لإضافة أخرى.');return;}
    const record={id:globalThis.crypto?.randomUUID?.() || `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,name:name.value.trim().slice(0,80)||'فكرة حوض',config:structuredClone(config)};
    const saved=write(SAVED_KEY,[record,...records]);
    if(saved && $('#studio-saved-link')) $('#studio-saved-link').hidden=false;
    announce(saved?'حُفظت الفكرة. ستجدها في صفحة «مسوداتي» على هذا المتصفح.':'التخزين المحلي غير متاح. يمكنك نسخ الملخص بدلًا من الحفظ.');
  });
  $('#copy-design').addEventListener('click',async() => {
    if(!validateForm()) return;
    const quote=estimateDesign(config), extras=[['filter','فلتر'],['light','إضاءة'],['plants','نباتات']].filter(([key]) => config.addons[key]).map(([,label]) => label).join('، ')||'بدون إضافات';
    const summary=`${name.value.trim()||'فكرة حوض'} — أكوا هافن\n${config.length} × ${config.width} × ${config.height} سم\n${config.glass==='ultra'?'زجاج فائق الصفاء':'زجاج صافي'} · ${extras}\nتقدير توضيحي: ${money(quote.price)} · ${decimal(quote.litres)} لتر\nتجربة تصميم فقط؛ ليست عرض بيع أو مخطط تصنيع.`;
    try {await navigator.clipboard.writeText(summary);announce('نُسخ ملخص التصميم.');} catch {announce('النسخ التلقائي غير متاح. يمكنك تحديد المقاسات والتقدير ونسخهما.');}
  });
  const motion=$('#motion-toggle');
  function updateMotion(){builder?.pause(paused);motion.setAttribute('aria-pressed',String(paused));motion.textContent=paused?'تشغيل الحركة':'إيقاف الحركة';}
  motion.addEventListener('click',() => {paused=!paused;updateMotion();});
  $('#rotate-left').addEventListener('click',() => builder?.rotate(-.4));
  $('#rotate-right').addEventListener('click',() => builder?.rotate(.4));
  $('#reset-view').addEventListener('click',() => builder?.reset());
  sync();updateMotion();
}
function initializeDrafts() {
  const page=document.querySelector('[data-drafts-page]'), host=document.querySelector('#tank-list');
  const make=(tag,className,text) => {const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
  function render(focusPosition) {
    host.replaceChildren();
    const entries=savedEntries(read(SAVED_KEY));
    document.querySelector('#drafts-count').textContent=decimal(entries.length);
    if(!entries.length) {
      const empty=make('div','drafts-empty'), icon=make('div','drafts-empty-symbol');icon.setAttribute('aria-hidden','true');
      const title=make('h2','','أول فكرة تبدأ من هنا.'), text=make('p','','جرّب المقاسات والتفاصيل في المصمم، ثم احفظ الفكرة لتجدها هنا.');
      const link=make('a','btn btn-primary','صمّم أول حوض');link.href=page.dataset.designerUrl;
      empty.append(icon,title,text,link);host.append(empty);if(Number.isInteger(focusPosition))link.focus();return;
    }
    for(const [position,{item,index}] of entries.entries()) {
      const quote=estimateDesign(item.config), card=make('article','drafts-card'), visual=make('div','drafts-card-visual'), tank=make('div','drafts-mini-tank');
      visual.setAttribute('aria-hidden','true');tank.style.setProperty('--draft-ratio',String(item.config.length/item.config.height));
      if(item.config.addons.plants){const img=make('img');img.src=page.dataset.plantImage;img.alt='';img.loading='lazy';tank.append(img);}
      if(item.config.addons.light)tank.append(make('span','drafts-mini-light'));
      if(item.config.addons.filter && page.dataset.filterImage){const filter=make('img','drafts-mini-filter');filter.src=page.dataset.filterImage;filter.alt='';filter.loading='lazy';tank.append(filter);}
      const number=make('span','drafts-card-number',`فكرة ${decimal(position+1).padStart(2,'٠')}`);
      visual.append(number,tank);
      const body=make('div','drafts-card-body'), title=make('h2','',item.name||'فكرة حوض');
      const dimensions=make('p','drafts-card-dimensions',`${item.config.length} × ${item.config.width} × ${item.config.height} سم`);dimensions.dir='ltr';
      const specs=make('p','drafts-card-specs',`${decimal(quote.litres)} لتر · ${item.config.glass==='ultra'?'فائق الصفاء':'زجاج صافي'}`);
      const extras=[['filter','فلتر'],['light','إضاءة'],['plants','نباتات']].filter(([key])=>item.config.addons[key]).map(([,label])=>label).join(' · ')||'بدون إضافات';
      const selected=make('p','drafts-card-extras',extras);
      const price=make('p','drafts-card-price');price.append(make('span','','تقدير توضيحي'),make('strong','',money(quote.price)));
      const actions=make('div','drafts-card-actions'), open=make('button','btn btn-primary','متابعة التصميم'), remove=make('button','studio-text-button drafts-delete','حذف');
      open.type=remove.type='button';open.setAttribute('aria-label',`متابعة تصميم ${item.name}`);remove.setAttribute('aria-label',`حذف المسودة: ${item.name}`);
      open.addEventListener('click',() => {if(write(DRAFT_KEY,{name:item.name.slice(0,80),config:item.config}))location.assign(page.dataset.designerUrl);else announce('تعذّر فتح المسودة لأن التخزين المحلي غير متاح.');});
      remove.addEventListener('click',() => {const next=removeSavedRecord(read(SAVED_KEY),index,item);if(write(SAVED_KEY,next)){render(position);announce(`حُذفت مسودة «${item.name}» فقط.`);}else announce('تعذّر حذف المسودة لأن التخزين المحلي غير متاح.');});
      actions.append(open,remove);body.append(title,dimensions,specs,selected,price,actions);card.append(visual,body);host.append(card);
    }
    if(Number.isInteger(focusPosition)){const buttons=host.querySelectorAll('.drafts-card-actions .btn-primary');buttons[Math.min(focusPosition,buttons.length-1)]?.focus();}
  }
  window.addEventListener('storage',event => {if(event.key===SAVED_KEY)render();});
  render();
}
