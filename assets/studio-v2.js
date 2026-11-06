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
  return Array.isArray(value) ? value.map((item,index) => ({item,index})).filter(({item}) => typeof item?.name === 'string' && validDesign(item.config)) : [];
}
// Remove exactly one selected record, retaining every other record, including older formats.
export function removeSavedRecord(records, index, snapshot) {
  if (!Array.isArray(records)) return null;
  const next = records.slice();
  const fingerprint = JSON.stringify(snapshot);
  const current = index>=0&&index<next.length&&JSON.stringify(next[index]) === fingerprint ? index : next.findIndex(item => JSON.stringify(item) === fingerprint);
  if (current < 0) return null;
  next.splice(current,1);
  return next;
}
// Keep the entered script intact; normalize only the value used for validation.
export function parseDimension(value,min,max) {
  const normalized=String(value??'').trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-0x660)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-0x6f0));
  if(!/^\d{1,3}$/.test(normalized))return null;
  const number=Number(normalized);
  return Number.isSafeInteger(number)&&number>=min&&number<=max?number:null;
}
const money = n => new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(n)+' ر.س';
const decimal = n => new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(n);
const validDraft = value => !!value && typeof value==='object' && !Array.isArray(value) && (value.version===undefined||value.version===1) && typeof value.name==='string' && validDesign(value.config);
function readStorage(key,valid) {
  let raw;
  try {raw=localStorage.getItem(key);} catch {return {status:'unavailable'};}
  if(raw===null)return {status:'missing',raw:null,value:null};
  try {const value=JSON.parse(raw);return {status:valid(value)?'ready':'invalid',raw,value};}
  catch {return {status:'invalid',raw};}
}
// A failed read, unknown format or a newer tab's edit never becomes an empty draft.
function writeStorage(key,state,value) {
  if(!state||!['missing','ready'].includes(state.status))return null;
  try {
    const raw=JSON.stringify(value);
    if(localStorage.getItem(key)!==state.raw)return null;
    localStorage.setItem(key,raw);
    return {status:'ready',raw,value};
  } catch {return null;}
}
async function changeSavedRecords(action) {
  // Cooperating tabs serialize list changes where Web Locks are supported.
  // The snapshot check in writeStorage also protects the fallback path.
  if(typeof navigator.locks?.request==='function')return navigator.locks.request(SAVED_KEY,action);
  return action();
}
function announce(message) {const status=document.querySelector('#studio-status');if(status)status.textContent=message;}
function createSavedReceipt(record,archiveUrl) {
  const make=(tag,className,text)=>{const node=document.createElement(tag);node.className=className;if(text!==undefined)node.textContent=text;return node;};
  const quote=estimateDesign(record.config), receipt=make('section','saved-design-receipt');
  receipt.id='studio-saved-receipt';receipt.setAttribute('aria-labelledby','studio-saved-title');
  const geometry=make('div','saved-design-geometry');geometry.setAttribute('aria-hidden','true');
  const outline=make('div','saved-design-outline');outline.style.setProperty('--saved-ratio',String(record.config.length/record.config.height));geometry.append(outline);
  const body=make('div','saved-design-receipt-body'), heading=make('h3','saved-design-title','حُفظ تصميمك.'), name=make('p','saved-design-name',record.name);
  heading.id='studio-saved-title';name.dir='auto';
  const dimensions=make('p','saved-design-dimensions',`${record.config.length} × ${record.config.width} × ${record.config.height} سم`);dimensions.dir='ltr';
  const specs=make('p','saved-design-specs',`${decimal(quote.litres)} لتر · ${record.config.glass==='ultra'?'زجاج فائق الصفاء':'زجاج صافي'}`);
  const selected=[['filter','فلتر'],['light','إضاءة'],['plants','نباتات']].filter(([key])=>record.config.addons[key]).map(([,label])=>label).join(' · ')||'بدون إضافات';
  const extras=make('p','saved-design-extras',selected), link=make('a','saved-design-open','افتح تصاميمي المحفوظة');link.href=archiveUrl;
  const note=make('p','saved-design-local','في هذا المتصفح فقط. يمكنك العودة وتعديل هذه النسخة.');
  body.append(heading,name,dimensions,specs,extras,link,note);receipt.append(geometry,body);return receipt;
}
if (typeof document !== 'undefined') {
  if (document.querySelector('#tank-form')) initializeDesigner();
  if (document.querySelector('[data-drafts-page]')) initializeDrafts();
}
function initializeDesigner() {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const form=$('#tank-form'), name=$('#tank-name');
  const savedLink=$('#studio-saved-link'), saveArea=$('.studio-summary-save');
  let savedReceipt;
  function clearSavedReceipt(){if(savedReceipt){savedReceipt.remove();savedReceipt=undefined;announce('');}if(savedLink?.dataset.hasSaved==='true')savedLink.hidden=false;}
  function showSavedReceipt(record){
    if(!saveArea||!savedLink)return;
    clearSavedReceipt();savedReceipt=createSavedReceipt(record,savedLink.href);saveArea.append(savedReceipt);savedLink.hidden=true;savedLink.dataset.hasSaved='true';
  }
  form.noValidate=true;name.dir='auto';
  const dimensionLimits={length:[40,160],width:[25,80],height:[25,80]};
  const numberFields=$$('[data-number]');
  numberFields.forEach(field=>{field.type='text';field.inputMode='numeric';});
  function fieldError(field,message,show=true) {
    field.setCustomValidity(message);
    if(show||field.getAttribute('aria-invalid')==='true') {
      const error=$('#'+field.id+'-error');
      if(message)field.setAttribute('aria-invalid','true');else field.removeAttribute('aria-invalid');
      if(error){error.textContent=message;error.hidden=!message;}
    }
  }
  function checkField(field,show=false) {
    if(field===name){const message=name.value.length>80?'اكتب اسمًا من ٨٠ حرفًا أو أقل، مع احتساب الرموز.':'';fieldError(field,message,show);return !message;}
    const [min,max]=dimensionLimits[field.dataset.number],value=parseDimension(field.value,min,max);
    const message=value===null?`أدخل عددًا صحيحًا من ${decimal(min)} إلى ${decimal(max)} سم.`:'';
    fieldError(field,message,show);return value!==null;
  }
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
    const invalid=[...numberFields,name].filter(field=>!checkField(field,true))[0];
    if(invalid && hasSteps){const index=panels.indexOf(invalid.closest('[data-studio-panel]'));if(index>=0)showStep(index);}
    if(invalid){invalid.focus();invalid.reportValidity();return false;}
    return true;
  }
  if(hasSteps){
    $('.studio-v8')?.classList.add('is-step-enhanced');
    $('.studio-step-footer').hidden=false;
    for(const [index,panel]of panels.entries()){
      $$(`a[href="#${panel.id}"]`).forEach(link=>link.addEventListener('click',event=>{event.preventDefault();showStep(index,{focus:true,scroll:true});}));
    }
    stepBack.addEventListener('click',()=>showStep(currentStep-1,{focus:true,scroll:true}));
    stepNext.addEventListener('click',()=>{
      const invalid=numberFields.filter(field=>field.closest('[data-studio-panel]')===panels[currentStep]).filter(field=>!checkField(field,true))[0];
      if(invalid){invalid.focus();invalid.reportValidity();return;}
      if(currentStep<panels.length-1)showStep(currentStep+1,{focus:true,scroll:true});
      else {$('#studio-estimate').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});$('#studio-summary-title')?.focus({preventScroll:true});}
    });
    const requested=panels.findIndex(panel=>'#'+panel.id===location.hash);
    showStep(requested>=0?requested:0);
    window.addEventListener('hashchange',()=>{const index=panels.findIndex(panel=>'#'+panel.id===location.hash);if(index>=0)showStep(index);});
  }
  let config={length:90,width:45,height:45,glass:'standard',addons:{filter:true,light:true,plants:true}};
  let paused=matchMedia('(prefers-reduced-motion: reduce)').matches, builder;
  let draftState=readStorage(DRAFT_KEY,validDraft);
  if(draftState.status==='ready') {config=structuredClone(draftState.value.config);name.value=draftState.value.name;}
  else if(draftState.status==='invalid')announce('تعذّر قراءة المسودة السابقة. بقيت محفوظة كما هي؛ يمكنك نسخ ملخص تصميمك الجديد.');
  else if(draftState.status==='unavailable')announce('تخزين المتصفح غير متاح. يمكنك تعديل الحوض ونسخ ملخصه قبل مغادرة الصفحة.');
  try {builder=createTankScene($('[data-scene="builder"]'),config);} catch {$('#scene-fallback').hidden=false;}
  function refresh(persist=true) {
    if(persist)clearSavedReceipt();
    const quote=estimateDesign(config);
    try {builder?.update(config);} catch {builder=undefined;$('#scene-fallback').hidden=false;}
    $('#scene-dimensions').textContent=`${config.length} × ${config.width} × ${config.height} cm`;
    $('#quote-price').textContent=money(quote.price);
    $('#quote-volume').textContent=decimal(quote.litres);
    const tankCost=$('#quote-tank-cost'), addonCost=$('#quote-addon-cost');
    if(tankCost && addonCost) {tankCost.textContent=money(quote.tank);addonCost.textContent=money(quote.price-quote.tank);}
    else $('#quote-breakdown').textContent=`الحوض ${money(quote.tank)} + الإضافات ${money(quote.price-quote.tank)}.`;
    $$('[data-preview-volume]').forEach(el=>el.textContent=decimal(quote.litres)+' لتر');
    $$('[data-preview-glass]').forEach(el=>el.textContent=config.glass==='ultra'?'فائق الصفاء':'صافي');
    $$('[data-preview-price]').forEach(el=>el.textContent=money(quote.price));
    if(persist && checkField(name)) {
      const next=writeStorage(DRAFT_KEY,draftState,{...draftState.value,name:name.value,config});
      if(next)draftState=next;
      else announce('تعذّر حفظ آخر تعديل. بقيت المسودة السابقة كما هي؛ انسخ ملخصك للاحتفاظ بالتعديل.');
    }
    $$('[data-preset]').forEach(button => {const active=button.dataset.preset===`${config.length},${config.width},${config.height}`;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active));});
  }
  function sync(persist=true) {
    for(const key of ['length','width','height']) {$(`[data-dimension="${key}"]`).value=config[key];$(`[data-number="${key}"]`).value=config[key];}
    numberFields.forEach(field=>fieldError(field,''));
    $$('input[name="glass"]').forEach(el => el.checked=el.value===config.glass);
    for(const key of ['filter','light','plants']) $(`input[name="${key}"]`).checked=config.addons[key];
    refresh(persist);
  }
  $$('[data-dimension]').forEach(el => el.addEventListener('input',() => {const key=el.dataset.dimension,value=parseDimension(el.value,...dimensionLimits[key]);if(value===null)return;config[key]=value;const field=$(`[data-number="${key}"]`);field.value=el.value;fieldError(field,'');refresh();}));
  $$('[data-number]').forEach(el => el.addEventListener('input',() => {
    if(!checkField(el)) return;
    const key=el.dataset.number;config[key]=parseDimension(el.value,...dimensionLimits[key]);$(`[data-dimension="${key}"]`).value=config[key];refresh();
  }));
  numberFields.forEach(el=>el.addEventListener('blur',()=>checkField(el,true)));
  $$('input[name="glass"]').forEach(el => el.addEventListener('change',() => {if(el.checked){config.glass=el.value;refresh();}}));
  for(const key of ['filter','light','plants']) $(`input[name="${key}"]`).addEventListener('change',event => {config.addons[key]=event.target.checked;refresh();});
  $$('[data-preset]').forEach(el => el.addEventListener('click',() => {const values=el.dataset.preset.split(',').map(Number),next={...config,length:values[0],width:values[1],height:values[2]};if(!validDesign(next))return;config=next;sync();}));
  name.addEventListener('input',()=>{checkField(name);refresh();});
  name.addEventListener('blur',()=>checkField(name,true));
  form.addEventListener('submit',event => event.preventDefault());
  form.addEventListener('input',clearSavedReceipt);
  window.addEventListener('storage',event=>{if(event.key===SAVED_KEY||event.key===null)clearSavedReceipt();});
  $('#save-tank').addEventListener('click',async() => {
    clearSavedReceipt();
    if(!validateForm()) return;
    const record={id:globalThis.crypto?.randomUUID?.() || `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,name:name.value.trim()||'تصميم حوض',config:structuredClone(config)};
    const button=$('#save-tank');button.disabled=true;
    try {await changeSavedRecords(()=>{
      const state=readStorage(SAVED_KEY,Array.isArray);
      if(!['ready','missing'].includes(state.status)){announce('تعذّر قراءة التصاميم السابقة. بقيت كما هي؛ انسخ ملخص تصميمك للاحتفاظ به.');return;}
      const records=state.value||[];
      if(savedEntries(records).length>=12) {announce('وصلت إلى ١٢ تصميمًا. احذف تصميمًا من «تصاميمي المحفوظة» لإضافة آخر.');return;}
      const saved=writeStorage(SAVED_KEY,state,[record,...records]);
      if(saved && savedLink){savedLink.hidden=false;showSavedReceipt(record);}
      announce(saved?'حُفظ التصميم. ستجده في «تصاميمي المحفوظة» على هذا المتصفح.':'تعذّر الحفظ أو تغيّرت التصاميم في صفحة أخرى. بقيت التصاميم السابقة كما هي؛ انسخ ملخص تصميمك.');
    });}catch{announce('تعذّر الحفظ في المتصفح. بقيت التصاميم السابقة كما هي؛ انسخ ملخص تصميمك.');}
    finally{button.disabled=false;}
  });
  $('#copy-design').addEventListener('click',async() => {
    clearSavedReceipt();
    if(!validateForm()) return;
    const quote=estimateDesign(config), extras=[['filter','فلتر'],['light','إضاءة'],['plants','نباتات']].filter(([key]) => config.addons[key]).map(([,label]) => label).join('، ')||'بدون إضافات';
    const summary=`${name.value.trim()||'تصميم حوض'} — أكوا هافن\n${config.length} × ${config.width} × ${config.height} سم\n${config.glass==='ultra'?'زجاج فائق الصفاء':'زجاج صافي'} · ${extras}\nتكلفة تقديرية: ${money(quote.price)} · ${decimal(quote.litres)} لتر\nتصميم تقريبي؛ ليس عرض سعر أو مخطط تصنيع.`;
    const button=$('#copy-design'),fallback=$('#studio-copy-fallback'),text=$('#studio-copy-text');
    button.disabled=true;
    try {
      if(typeof navigator.clipboard?.writeText!=='function')throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(summary);
      if(fallback)fallback.hidden=true;
      announce('نُسخ ملخص التصميم.');
    } catch {
      if(fallback&&text){fallback.hidden=false;text.value=summary;text.focus();text.select();}
      announce('تعذّر النسخ التلقائي. حدّد الملخص الظاهر وانسخه يدويًا.');
    } finally {button.disabled=false;}
  });
  const motion=$('#motion-toggle');
  function updateMotion(){builder?.pause(paused);motion.setAttribute('aria-pressed',String(paused));motion.textContent=paused?'تشغيل الحركة':'إيقاف الحركة';}
  motion.addEventListener('click',() => {paused=!paused;updateMotion();});
  $('#rotate-left').addEventListener('click',() => builder?.rotate(-.4));
  $('#rotate-right').addEventListener('click',() => builder?.rotate(.4));
  $('#reset-view').addEventListener('click',() => builder?.reset());
  sync(false);updateMotion();
}
function initializeDrafts() {
  const page=document.querySelector('[data-drafts-page]'), host=document.querySelector('#tank-list');
  const make=(tag,className,text) => {const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
  function render(focusPosition) {
    host.replaceChildren();
    const state=readStorage(SAVED_KEY,Array.isArray),entries=savedEntries(state.value);
    document.querySelector('#drafts-count').textContent=decimal(entries.length);
    if(!entries.length) {
      const empty=make('div','drafts-empty'), icon=make('div','drafts-empty-symbol');icon.setAttribute('aria-hidden','true');
      const title=make('h2','','لم تحفظ أيّ تصميم بعد.'), text=make('p','','اختر المقاسات والزجاج والإضافات في المصمّم، ثم احفظ التصميم لتجده هنا.');
      if(!['ready','missing'].includes(state.status)){title.textContent='تعذّر عرض التصاميم المحفوظة.';text.textContent='لم تُحذف بياناتك. أعد فتح الصفحة عند توفر تخزين المتصفح، أو ابدأ تصميمًا وانسخ ملخصه.';announce('تعذّر قراءة التصاميم المحفوظة. بقيت بيانات التخزين كما هي.');}
      else if(Array.isArray(state.value)&&state.value.length){title.textContent='لا توجد تصاميم يمكن فتحها هنا.';text.textContent='بقيت السجلات السابقة محفوظة كما هي. يمكنك بدء تصميم جديد ونسخ ملخصه.';}
      const link=make('a','btn btn-primary','صمّم أول حوض');link.href=page.dataset.designerUrl;
      empty.append(icon,title,text,link);host.append(empty);if(Number.isInteger(focusPosition))link.focus();return;
    }
    for(const [position,{item,index}] of entries.entries()) {
      const quote=estimateDesign(item.config), card=make('article','drafts-card'), visual=make('div','drafts-card-visual'), tank=make('div','drafts-mini-tank');
      visual.setAttribute('aria-hidden','true');tank.style.setProperty('--draft-ratio',String(item.config.length/item.config.height));
      if(item.config.addons.plants){const img=make('img');img.src=page.dataset.plantImage;img.alt='';img.loading='lazy';img.addEventListener('error',()=>{img.hidden=true;},{once:true});tank.append(img);}
      if(item.config.addons.light)tank.append(make('span','drafts-mini-light'));
      if(item.config.addons.filter && page.dataset.filterImage){const filter=make('img','drafts-mini-filter');filter.src=page.dataset.filterImage;filter.alt='';filter.loading='lazy';filter.addEventListener('error',()=>{filter.hidden=true;},{once:true});tank.append(filter);}
      const number=make('span','drafts-card-number','معاينة تقريبية');
      visual.append(number,tank);
      const body=make('div','drafts-card-body'), title=make('h2','',item.name||'تصميم حوض');
      title.dir='auto';
      const dimensions=make('p','drafts-card-dimensions',`${item.config.length} × ${item.config.width} × ${item.config.height} سم`);dimensions.dir='ltr';
      const specs=make('p','drafts-card-specs',`${decimal(quote.litres)} لتر · ${item.config.glass==='ultra'?'فائق الصفاء':'زجاج صافي'}`);
      const extras=[['filter','فلتر'],['light','إضاءة'],['plants','نباتات']].filter(([key])=>item.config.addons[key]).map(([,label])=>label).join(' · ')||'بدون إضافات';
      const selected=make('p','drafts-card-extras',extras);
      const price=make('p','drafts-card-price');price.append(make('span','','تكلفة تقديرية'),make('strong','',money(quote.price)));
      const actions=make('div','drafts-card-actions'), open=make('button','btn btn-primary','متابعة التصميم'), remove=make('button','studio-text-button drafts-delete','حذف');
      open.type=remove.type='button';open.setAttribute('aria-label',`متابعة تصميم ${item.name}`);remove.setAttribute('aria-label',`حذف التصميم: ${item.name}`);
      open.addEventListener('click',() => {const draft=readStorage(DRAFT_KEY,validDraft);if(writeStorage(DRAFT_KEY,draft,{name:item.name,config:item.config}))location.assign(page.dataset.designerUrl);else announce('تعذّر فتح التصميم. بقيت المسودة السابقة كما هي؛ أعد فتح الصفحة وحاول مجددًا.');});
      remove.addEventListener('click',async() => {
        remove.disabled=true;
        try{await changeSavedRecords(()=>{const latest=readStorage(SAVED_KEY,Array.isArray),next=removeSavedRecord(latest.value,index,item);if(next&&writeStorage(SAVED_KEY,latest,next)){render(position);announce(`حُذف تصميم «${item.name}» فقط.`);}else announce('تعذّر الحذف أو تغيّرت التصاميم في صفحة أخرى. أعد فتح الصفحة؛ لم تُحذف سجلات أخرى.');});}
        catch{announce('تعذّر الحذف في المتصفح. بقيت التصاميم السابقة كما هي.');}
        finally{remove.disabled=false;}
      });
      actions.append(open,remove);body.append(title,dimensions,specs,selected,price,actions);card.append(visual,body);host.append(card);
    }
    if(Number.isInteger(focusPosition)){const buttons=host.querySelectorAll('.drafts-card-actions .btn-primary');buttons[Math.min(focusPosition,buttons.length-1)]?.focus();}
  }
  window.addEventListener('storage',event => {if(event.key===SAVED_KEY||event.key===null)render();});
  render();
}
