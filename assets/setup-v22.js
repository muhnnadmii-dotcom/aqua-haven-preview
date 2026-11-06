function dimensionText(node,value){const text=String(value),pattern=/\d+(?:\.\d+)?\s*×\s*\d+(?:\.\d+)?(?:\s*×\s*\d+(?:\.\d+)?)?/g;let end=0;for(const match of text.matchAll(pattern)){node.append(document.createTextNode(text.slice(end,match.index)));const run=document.createElement('bdi');run.dir='ltr';run.textContent=match[0];node.append(run);end=match.index+match[0].length;}node.append(document.createTextNode(text.slice(end)));}
import {createProductPicker} from './setup-v22-picker.mjs?v=22';
import {SETUP_STORAGE_KEY,KIT_LIST_KEY,checkedCatalog,initialState,restorableState,numberValue,validateState,calculateKit,buildCartPayload,suitability,recommendations,filterSystem,tankVariants,removeKitProduct,setSubstrateEnabled,editStepForProduct,soilCoverageRecommendation} from './setup-v22-core.mjs?v=22';

const root=document.querySelector('[data-kit-builder]');
if(root)boot(root);
function boot(root){
  const $=id=>root.querySelector('#'+id),make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)dimensionText(e,text);return e;};
  const money=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(n/100)+' ر.س';
  const decimal=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(n);
  const labels=['الحوض والزجاج','الأرضية','الفلترة','الإضاءة','الغذاء','الإضافات','المراجعة'];
  const base=root.dataset.base||'../';let catalog,state,byKey,storageRaw=null,storageWritable=false,requestId=null,activeGuide=0,ready=false,previousPanel=null,cartBusy=false;
  let runtime=null;try{const candidate=JSON.parse(document.querySelector('#aqh-kit-runtime')?.textContent||'null');if(root.dataset.mode==='woo'&&candidate&&typeof candidate.nonce==='string'&&new URL(candidate.cartEndpoint,location.href).origin===location.origin)runtime=candidate;}catch{}
  const asset=p=>new URL(base+p.image,location.href).href;
  const image=p=>{const img=make('img');img.src=asset(p);img.alt='';img.loading='lazy';img.decoding='async';img.width=112;img.height=112;img.addEventListener('error',()=>{img.hidden=true;},{once:true});return img;};
  const available=role=>catalog.items.filter(p=>p.role===role&&p.inStock);
  const numeric=(input)=>{const n=numberValue(input.value);return n===null?input.value:n;};
  let planningDepth=null,trayOpen=false,traySignature='';
  function segmentControl(id,label,choices,value,onChange){
    const group=make('div','kit-segments');group.id=id;group.tabIndex=-1;group.setAttribute('role','group');group.setAttribute('aria-label',label);
    choices.forEach(choice=>{const button=make('button','kit-segment');button.type='button';button.disabled=!!choice.disabled;button.setAttribute('aria-pressed',String(choice.value===value));button.append(make('strong','',choice.label));if(choice.detail)button.append(make('small','',choice.detail));button.addEventListener('click',()=>onChange(choice.value));group.append(button);});return group;
  }
  function helpBox(title,text,kind='info'){const box=make('section','kit-beginner kit-beginner-'+kind);box.append(make('h3','',title),make('p','',text));return box;}
  function afterChoice(){changed({rebuild:true,resetOverrides:false});}
  function openStep(next){trayOpen=false;goStep(next);refreshTray();}
  function removeFromKit(key){if(cartBusy)return;const name=byKey.get(key)?.name;state=removeKitProduct(state,catalog,key);traySignature='';changed({rebuild:true,resetOverrides:false});announce('أُزيل '+name+' من التجميعة.');}
  function updateBeginnerFacts(){const host=$('kit-soil-coverage');if(!host||!state.soil.key)return;host.replaceChildren();const product=byKey.get(state.soil.key),plan=soilCoverageRecommendation(state,catalog,product,planningDepth),actual=calculateKit(state,catalog).geometry.soilDepthCm;host.append(make('p','kit-soil-current',`${decimal(numberValue(state.soil.packs)||0)} عبوة × ${decimal(product.packLitres)} لتر = ${decimal((numberValue(state.soil.packs)||0)*product.packLitres)} لتر · تغطي نحو ${decimal(actual||0)} سم على مقاسك`));
    if(!plan.available){host.append(make('p','kit-field-small','للتخطيط: اختر ارتفاعًا أدناه، وسنحسب اللترات وعدد العبوات. ارتفاعات التخطيط أمثلة تختار منها، وليست توصية ثابتة لكل النباتات.'));return;}
    host.append(make('p','',`ارتفاع التخطيط ${decimal(planningDepth)} سم يحتاج نحو ${decimal(plan.requiredLitres.min)} لتر لهذا الحوض.`));
    if(plan.canApplyMinimumPurchase){const b=make('button','kit-secondary',`اختَر ${decimal(plan.minimumPurchasePacks)} عبوة`);b.type='button';b.addEventListener('click',()=>{state.soil.packs=plan.minimumPurchasePacks;activeGuide='soil';afterChoice();});host.append(b,make('p','kit-field-small',`إذا استخدمت هذه العبوات كاملة يصبح الارتفاع نحو ${decimal(plan.minimumPurchaseCoverage.depthCm)} سم. يمكنك الاحتفاظ بالزائد؛ الرسم يحسب كامل الكمية المختارة.`));}else host.append(make('p','kit-field-small','العبوة الكاملة أكبر من المساحة المتاحة لهذا العمق. جرّب حجم عبوة أصغر أو عدّل خطة الطبقة.'));
  }
  function storageNote(message){$('kit-storage-note').hidden=!message;$('kit-storage-note').textContent=message;}
  function remember(){
    if(!storageWritable)return;
    try{if(localStorage.getItem(SETUP_STORAGE_KEY)!==storageRaw){storageWritable=false;storageNote('تغيّرت التجميعة في تبويب آخر. احتفظنا بما أدخلته هنا؛ انسخ الملخص قبل مغادرة الصفحة.');return;}
      const raw=JSON.stringify(state);localStorage.setItem(SETUP_STORAGE_KEY,raw);storageRaw=raw;
    }catch{storageWritable=false;storageNote('تعذّر حفظ آخر تعديل في المتصفح. اختياراتك باقية في الصفحة؛ انسخ الملخص للاحتفاظ بها.');}
  }
  function readState(){
    state=initialState(catalog);
    try{storageRaw=localStorage.getItem(SETUP_STORAGE_KEY);if(storageRaw===null){storageWritable=true;return;}
      const previous=JSON.parse(storageRaw);if(restorableState(previous,catalog)){state=previous;storageWritable=true;}
      else storageNote('تعذّر فتح التجميعة السابقة بهذا الإصدار. بقيت بياناتها كما هي؛ يمكنك تجهيز حوض جديد ونسخ ملخصه.');
    }catch{storageNote('تخزين المتصفح غير متاح أو تعذّر قراءة التجميعة السابقة. لم نحذف أي بيانات؛ يمكنك المتابعة ونسخ الملخص.');}
  }
  function announce(text,isError=false){$('kit-form-status').textContent=text;$('kit-form-status').classList.toggle('is-error',isError||/^(?:تعذ|راجع|صيغة|تغيّرت|نطاق)/.test(text));}
  function changed({rebuild=false,focus=null,resetOverrides=true}={}){
    if(cartBusy)return;
    requestId=null;if(resetOverrides)state.quantityOverrides={};
    $('kit-success')?.remove();announce('');
    if(rebuild){renderPanel();if(focus&&$(focus)?.tagName!=='SELECT')$(focus)?.focus({preventScroll:true});}
    paintErrors([],false);refresh();remember();
  }
  function field(label,id,control,help){
    const wrap=make('div','kit-field'),name=make('label','',label);control.id=id;if(control.matches('input,select,textarea'))name.htmlFor=id;else{name.id=id+'-field-label';control.setAttribute('aria-labelledby',name.id);}
    const error=make('p','kit-field-error');error.id=id+'-error';error.hidden=true;
    const described=[error.id];wrap.append(name,control);
    if(help){const hint=make('p','kit-field-small',help);hint.id=id+'-help';described.push(hint.id);wrap.append(hint);}
    control.setAttribute('aria-describedby',described.join(' '));wrap.append(error);return wrap;
  }
  function selector(items,value,noneLabel){
    const e=make('select');if(noneLabel){const option=make('option','',noneLabel);option.value='';e.append(option);}
    items.forEach(p=>{const option=make('option','',p.name+' — '+money(Math.round(p.price*100)));option.value=p.key;e.append(option);});e.value=value||'';return e;
  }
  function numberInput(value){const e=make('input');e.type='text';e.inputMode='decimal';e.maxLength=12;e.value=value??'';e.autocomplete='off';return e;}
  function errorGroup(id){const e=make('p','kit-field-error');e.id=id+'-error';e.hidden=true;return e;}
  function heading(title,intro){const h=make('h2','kit-panel-heading',title);h.id='kit-step-title';h.tabIndex=-1;$('kit-panel').append(h,make('p','kit-panel-intro',intro));}
  function productDetail(){return [];}
  const roleLabels={airPump:'مضخة الهواء',airline:'أنبوب الهواء',airStone:'حجر الهواء',media:'إسفنج ووسائط الترشيح',hose:'خراطيم الماء',waterPump:'مضخة الماء',checkValve:'صمام عدم الرجوع'};
  const roleCatalog={media:'media'};
  let filterView='all';
  let foodView='all';
  function option(value,text,disabled=false){const o=make('option','',text);o.value=value;o.disabled=disabled;return o;}
  function choiceName(p){return p.name+(p.model&&!p.name.toLowerCase().includes(String(p.model).toLowerCase())?' · '+p.model:'');}
  function previewControl(){const compact=root.classList.contains('is-preview-compact');$('kit-compact').textContent=state.step===2?(compact?'تفاصيل التوصيل':'إخفاء التفاصيل'):(compact?'تكبير المعاينة':'تصغير المعاينة');$('kit-compact').setAttribute('aria-expanded',String(!compact));}
  function pageUrl(relative){const candidate=new URL(runtime?.homeUrl||(runtime?'/':base),location.href);return new URL(relative,candidate.origin===location.origin?candidate:new URL('/',location.href)).href;}
  function facts(product){
    const wrap=make('section','kit-product-help'),beginner=product.beginner||{};
    if(beginner.benefit)wrap.append(helpBox('وش فائدته؟',beginner.benefit));
    if(beginner.tip)wrap.append(make('p','kit-field-small',beginner.tip));
    const fit=suitability(product,byKey.get(state.tankKey));
    if(['filter','light'].includes(product.role))wrap.append(make('p','kit-fit-explanation',fit.status==='recommended'?'مقاس حوضك ضمن النطاق المعلن لهذا المنتج.':fit.status==='incompatible'?'مقاس حوضك خارج النطاق المعلن؛ راجع الملاءمة قبل اعتماده.':'لا يوجد نطاق مقاس مؤكد لهذا المنتج. راجع الملاءمة ولا تعتمد على حجم الحوض وحده.'));
    const details=make('details','kit-specs'),summary=make('summary','','المواصفات وما يلزم مراجعته');details.append(summary);if(beginner.without)details.append(make('p','',beginner.without));const list=make('ul','kit-product-notes');[...new Set([...(product.notes||[]),...(product.unknowns||[])])].filter(t=>typeof t==='string'&&t).forEach(t=>list.append(make('li','',t)));details.append(list);wrap.append(details);return wrap;
  }
  function productPicker(role,value,onChange,{id='kit-'+role,none='بدون منتج جديد',items=null}={}){
    return createProductPicker({id,label:role==='soil'?'التربة الزراعية':role==='substrate'?'الرمل والحصى':roleLabels[role]||({filter:'الفلاتر',light:'الإضاءة',food:'الغذاء',extra:'الإضافات'}[role]||'المنتجات'),items:items||catalog.items.filter(p=>p.role===role),value,onChange,formatPrice:price=>money(Math.round(price*100)),assetUrl:asset,fitFor:['filter','light','airPump','waterPump'].includes(role)?p=>suitability(p,byKey.get(state.tankKey)):undefined,noneLabel:none,limit:6});
  }
  function setOwned(role,owned){state.ownedComponents=state.ownedComponents.filter(r=>r!==role);if(owned){state.ownedComponents.push(role);state.equipment[role]=null;}}
  function chooseFilter(key){state.filterKey=key;Object.keys(state.equipment).forEach(role=>state.equipment[role]=null);state.ownedComponents=[];}
  function equipmentControl(role,host,{required=false,uncertain=false,included=false}={}){
    if(included){host.append(make('p','kit-included',roleLabels[role]+' مرفقة بحسب وصف المنتج؛ لا نضيفها للسعر مرة ثانية.'));return;}
    const row=make('section','kit-component'),title=make('h3','',roleLabels[role]||(role+' إضافي'));row.append(title);
    const existing=make('label','kit-owned'),check=make('input');check.type='checkbox';check.id='kit-owned-'+role;check.checked=state.ownedComponents.includes(role);check.addEventListener('change',()=>{setOwned(role,check.checked);changed({rebuild:true,focus:check.id,resetOverrides:false});});existing.append(check,make('span','','عندي القطعة، أو تأكدت أنها مرفقة مع المنتج'));row.append(existing);
    const products=catalog.items.filter(p=>p.role===(roleCatalog[role]||role));
    if(!check.checked&&products.length){
      const select=productPicker(roleCatalog[role]||role,state.equipment[role],key=>{state.equipment[role]=key;state.ownedComponents=state.ownedComponents.filter(r=>r!==role);changed({rebuild:true,focus:'kit-equipment-'+role,resetOverrides:false});},{id:'kit-equipment-'+role,none:required?'اختر القطعة المطلوبة':'لا أحتاج إضافة جديدة'});
      row.append(field('اختر '+(roleLabels[role]||role),'kit-equipment-'+role,select));
      const p=byKey.get(state.equipment[role]);if(p)row.append(...productDetail(p),facts(p));
    }else if(!check.checked&&!products.length)row.append(make('p','kit-note-warning kit-note','لا يوجد منتج موثق لهذا الجزء في القائمة. أكّد توفره لديك قبل إكمال التجميعة.'));
    if(uncertain)row.append(make('p','kit-field-small','محتويات العبوة أو مقاس التوصيلة يحتاج مراجعة؛ لا نفترض أنه مرفق أو مناسب تلقائيًا.'));
    host.append(row);
  }
  function distributeAllocation(){for(const key of new Set(state.zones.map(z=>z.key))){const group=state.zones.filter(z=>z.key===key),sum=group.reduce((n,z)=>n+(numberValue(z.share)||0),0);group.forEach(z=>z.allocation=sum?100*(numberValue(z.share)||0)/sum:100/group.length);}}
  function renderFilter(){
    heading('فلترة واضحة، بكل توصيلاتها.','اختَر طريقة التشغيل أولًا. نوضّح موقع الفلتر والأنابيب، ثم نجمع القطع المطلوبة دون تكرار ما تملكه أو ما يأتي داخل العبوة.');
    const typeNames={all:'الكل',sponge:'إسفنجي',canister:'كانستر خارجي',hob:'شلال',internal:'داخلي',airStone:'حجر تهوية'};
    const mode=segmentControl('kit-filter-type','طريقة الفلترة أو التهوية',Object.entries(typeNames).map(([value,label])=>({value,label})),filterView,value=>{filterView=value;const chosen=byKey.get(state.filterKey);if((filterView==='airStone'&&state.filterKey)||(filterView!=='airStone'&&state.equipment.airStone)||(filterView!=='all'&&chosen&&chosen.filterType!==filterView))chooseFilter(null);afterChoice();});$('kit-panel').append(field('طريقة الفلترة أو التهوية','kit-filter-type',mode));
    if(filterView==='airStone'){
      $('kit-panel').append(make('p','kit-note','حجر الهواء للتهوية وتحريك الماء. التجميعة تحتاج مراجعة الترشيح أيضًا حسب الكائنات التي ستربيها.'));
      const stone=productPicker('airStone',state.equipment.airStone,key=>{chooseFilter(null);state.equipment.airStone=key;changed({rebuild:true,focus:'kit-air-stone',resetOverrides:false});},{id:'kit-air-stone',none:'اختر حجر الهواء'});$('kit-panel').append(field('حجر الهواء','kit-air-stone',stone));if(state.equipment.airStone)$('kit-panel').append(...productDetail(byKey.get(state.equipment.airStone)),facts(byKey.get(state.equipment.airStone)));
    }else{
      const all=catalog.items.filter(p=>p.role==='filter'&&(filterView==='all'||p.filterType===filterView));
      const selected=productPicker('filter',state.filterKey,key=>{chooseFilter(key);changed({rebuild:true,focus:'kit-filter',resetOverrides:false});},{items:all,none:'بدون فلتر جديد'});$('kit-panel').append(field('اختر الفلتر','kit-filter',selected,'تغيير الفلتر يعيد اختيار قطع تشغيله، حتى لا تبقى قطع من منظومة سابقة في السعر.'));
      const recommended=all.filter(p=>p.inStock&&suitability(p,byKey.get(state.tankKey)).status==='recommended').sort((a,b)=>a.price-b.price);
      if(recommended.length){const b=make('button','kit-secondary','استخدم أقل الخيارات سعرًا ضمن النطاق الموثق');b.type='button';b.addEventListener('click',()=>{chooseFilter(recommended[0].key);changed({rebuild:true,focus:'kit-filter',resetOverrides:false});});$('kit-panel').append(b);}
      if(state.filterKey){const p=byKey.get(state.filterKey);$('kit-panel').append(...productDetail(p),facts(p));}
    }
    const system=filterSystem(state,catalog),parts=make('div','kit-components');
    if(system.type!=='none'){
      const needRoles=new Set(system.requires.map(r=>r.role));
      system.requires.forEach(req=>equipmentControl(req.role,parts,{required:true,uncertain:req.uncertain,included:req.included}));
      if(state.equipment.airStone||byKey.get(state.filterKey)?.filterType==='sponge'){
        const position=segmentControl('kit-air-position','موضع مضخة الهواء',[{value:'above',label:'أعلى سطح الماء'},{value:'below',label:'أسفل سطح الماء'}],state.airPumpPosition,value=>{state.airPumpPosition=value;afterChoice();});parts.append(field('موضع مضخة الهواء','kit-air-position',position,'عند وضعها أسفل سطح الماء، يلزم صمام عدم رجوع على خط الهواء.'));
        if(!needRoles.has('checkValve'))equipmentControl('checkValve',parts);
        const tube=byKey.get(state.equipment.airline);parts.append(make('p','kit-field-small','لون أنبوب الهواء: '+(tube?.airlineColor||'غير موثّق للخيارات الحالية')+'. لا نعرض لونًا لا تثبته بيانات المنتج.'));
      }
      (system.warnings||[]).forEach(t=>parts.append(make('p','kit-note-warning kit-note',t)));
    }else parts.append(make('p','kit-note','اختَر فلترًا أو جهاز تهوية ليظهر مسار التوصيل وقطع التشغيل الخاصة به.'));
    const more=make('details','kit-catalog-coverage'),moreSummary=make('summary','','مضخة ماء إضافية');more.append(moreSummary);equipmentControl('waterPump',more);if(state.equipment.waterPump||state.ownedComponents.includes('waterPump'))more.open=true;parts.append(more);$('kit-panel').append(parts);
  }
  let extrasPlantFilter=false,extraCategory='all';
  function renderExtras(){
    heading('نباتات ولمسات وعناية.','اختَر ما يكمل تجهيزك. ستجد سبب استخدام المنتج وتعليماته، ويمكنك حذف أي إضافة من شريط التجميعة.');
    const groups={all:'الكل',plant:'نباتات',aquascape:'التنسيق',care:'العناية بالماء',plantCare:'عناية النباتات',feedingAccessory:'أدوات التغذية',lightingAccessory:'ملحقات الإضاءة',equipmentAccessory:'أدوات وتجهيزات',stand:'الطاولات',accessory:'وصلات'};
    const options=[{value:'all',label:'الكل'},...[...new Set(catalog.items.filter(p=>['extra','accessory'].includes(p.role)).map(p=>p.extraGroup||'accessory'))].map(key=>({value:key,label:groups[key]||'إضافات'}))];$('kit-panel').append(field('قسم الإضافات','kit-extra-category',segmentControl('kit-extra-category','قسم الإضافات',options,extraCategory,key=>{extraCategory=key;extrasPlantFilter=false;afterChoice();})));
    if(extrasPlantFilter){$('kit-panel').append(helpBox('نباتات ربط وطافية','نعرض الأنواع المصنفة لهذا الأسلوب. بعض هذه النباتات غير متوفرة في اللقطة الحالية؛ لا تفترض أن كل نبات يمكن دفن جذوره أو ريزومه.'));const reset=make('button','kit-text-button','اعرض جميع الإضافات');reset.type='button';reset.addEventListener('click',()=>{extrasPlantFilter=false;afterChoice();});$('kit-panel').append(reset);}
    const items=catalog.items.filter(p=>['extra','accessory'].includes(p.role)&&!state.extras.includes(p.key)&&(extraCategory==='all'||(p.extraGroup||'accessory')===extraCategory)&&(!extrasPlantFilter||p.plant?.planting?.soilNeed==='not-required'));
    if(state.extras.length<24)$('kit-panel').append(productPicker('extra',null,key=>{if(key&&!state.extras.includes(key)){state.extras.push(key);afterChoice();}},{id:'kit-extra-select',none:null,items}));else $('kit-panel').append(make('p','kit-note','وصلت إلى ٢٤ إضافة. احذف إحداها من شريط التجميعة لتضيف غيرها.'));
    if(state.extras.length){const list=make('ul','kit-extra-chosen');for(const key of state.extras){const p=byKey.get(key),li=make('li');li.append(make('span','',p.name));const b=make('button','kit-text-button','حذف');b.type='button';b.setAttribute('aria-label','حذف '+p.name);b.addEventListener('click',()=>removeFromKit(key));const detail=make('details','kit-extra-guide');detail.append(make('summary','','فائدة المنتج وطريقة اختياره'),facts(p));li.append(b,detail);list.append(li);}$('kit-panel').append(list);}
    const coverage=make('details','kit-specs');coverage.append(make('summary','','جميع المنتجات وملاحظات الاختيار'),make('p','kit-field-small','كل منتجات الكتالوج مفهرسة. نعرض ما يخص التجميعة في موضعه، وتبقى المنتجات ذات البيانات المتعارضة أو الاستخدامات الأخرى في المتجر للمراجعة.'));const link=make('a','','تصفّح المتجر');link.href=pageUrl('shop/');coverage.append(link);$('kit-panel').append(coverage);
  }
  function renderSystemDiagram(){
    const system=filterSystem(state,catalog),host=$('kit-system-diagram');if(!host)return;host.hidden=state.step!==2;
    $('kit-cross-section').hidden=state.step===2;$('kit-plan').hidden=state.step!==1||!state.zones.length;
    if(state.step!==2)return;
    host.dataset.type=system.type;host.dataset.airPosition=state.airPumpPosition;
    host.querySelectorAll('[data-system-type]').forEach(el=>{if(el.dataset.systemType.split(' ').includes(system.type))el.removeAttribute('hidden');else el.setAttribute('hidden','');});
    host.dataset.placement=system.diagramPlacement||'outside-below';host.querySelectorAll('[data-canister-position]').forEach(el=>{const visible=system.type==='canister'&&el.dataset.canisterPosition===(system.diagramPlacement||'outside-below');if(visible)el.removeAttribute('hidden');else el.setAttribute('hidden','');});
    $('kit-system-label').textContent=system.label||'اختر طريقة التشغيل';
    const status=$('kit-system-parts');status.replaceChildren();system.requires.forEach(req=>status.append(make('li',req.satisfied?'is-ready':'is-missing',(req.satisfied?'جاهز: ':'يلزم: ')+(roleLabels[req.role]||req.label)+(req.included?' · مرفق':req.owned?' · عندك':req.selectedKey?' · '+byKey.get(req.selectedKey)?.name:''))));
    $('kit-system-note').textContent=system.type==='none'?'سيظهر مسار الماء أو الهواء بمجرد اختيار المنتج.':'رسم توضيحي لطريقة التشغيل؛ مواضع الأنابيب والتثبيت النهائية حسب دليل المنتج. '+(system.placementVerified?'':'موضع الجهاز ليس مواصفة تركيب مؤكدة لهذا الموديل.');
  }
  function renderPanel(){
    if([1,2].includes(state.step)&&previousPanel!==state.step&&matchMedia('(max-width:760px)').matches){root.classList.add('is-preview-compact');$('kit-compact').textContent='تكبير المعاينة';$('kit-compact').setAttribute('aria-expanded','false');}
    previousPanel=state.step;const intro=$('kit-intro-details');if(intro){intro.open=state.step===0;intro.querySelector('summary').hidden=state.step===0;}$('kit-panel').replaceChildren();announce('');root.dataset.step=String(state.step);
    root.querySelectorAll('[data-kit-step]').forEach(b=>{if(Number(b.dataset.kitStep)===state.step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
    $('kit-back').hidden=state.step===0;$('kit-next').hidden=state.step===6;$('kit-next').firstChild.textContent=state.step<5?'إلى '+labels[state.step+1]+' ':'راجع التجميعة ';
    if(state.step===0)renderTank();else if(state.step===1)renderSubstrate();else if(state.step===2)renderFilter();else if(state.step===5)renderExtras();else if(state.step===6)renderReview();else renderEquipment(state.step===3?'light':'food');previewControl();
  }
  function renderTank(){
    heading('ابدأ بالمقاس، واختر طابع حوضك.','هذه مقاسات المصنع الجاهزة. الخلفية والسيلكون متطابقان، والتجهيزات تختارها بعد ذلك.');
    const tanks=available('tank'),current=byKey.get(state.tankKey),sizes=[];for(const p of tanks){const d=p.dimensions,value=[d.length,d.width,d.height].join('×');if(!sizes.some(s=>s.value===value))sizes.push({value,label:value+' سم',dimensions:d});}sizes.sort((a,b)=>a.dimensions.length-b.dimensions.length||a.dimensions.width-b.dimensions.width||a.dimensions.height-b.dimensions.height);
    const currentSize=[current.dimensions.length,current.dimensions.width,current.dimensions.height].join('×');
    const sizeControl=segmentControl('kit-tank','المقاس الجاهز',sizes,currentSize,value=>{const variants=tanks.filter(p=>[p.dimensions.length,p.dimensions.width,p.dimensions.height].join('×')===value);state.tankKey=(variants.find(p=>p.background===current.background)||variants[0]).key;afterChoice();});$('kit-panel').append(field('المقاس الجاهز','kit-tank',sizeControl,'الأبعاد بالترتيب: الطول × العمق × الارتفاع.'));
    const variants=tankVariants(catalog,state.tankKey),options=['clear','black'].map(color=>{const p=variants.find(p=>p.background===color);return {value:p?.key||color,label:color==='clear'?'شفاف':'خلفية سوداء',detail:color==='clear'?'مع سيلكون شفاف':'مع سيلكون أسود',disabled:!p||!p.inStock};});
    $('kit-panel').append(field('الخلفية والسيلكون','kit-background',segmentControl('kit-background','الخلفية والسيلكون',options,state.tankKey,key=>{state.tankKey=key;afterChoice();})));
    const chosen=make('article','kit-tank-selection'),body=make('div');body.append(make('h3','',current.name),make('strong','',money(Math.round(current.price*100))));chosen.append(image(current),body);$('kit-panel').append(chosen);
    const d=current.dimensions,volume=d.length*d.width*d.height/1000;$('kit-panel').append(helpBox('التجهيز يبدأ من مقاسك',`سعة اسمية نحو ${decimal(volume)} لتر. سنقدّم خيارات ذات مقاس معلن يطابق حوضك، ونوضح بقية الخيارات التي تحتاج مراجعة.`),facts(current));
    const custom=make('a','kit-custom-request','تحتاج مقاسًا أو تشطيبًا خاصًا؟');custom.href=pageUrl('services/#service-brief');$('kit-panel').append(custom);
  }
  function renderSubstrate(){
    heading('أرضية تناسب فكرتك ونباتاتك.','اختر التربة المغذية إن احتجتها، ثم الرمل أو الحصى اختياريًا. العبوات والوزن يحددان الارتفاع الظاهر في الرسم.');
    const soil=productPicker('soil',state.soil.key,key=>{state.soil.key=key;activeGuide='soil';afterChoice();},{id:'kit-soil',none:'بدون تربة مغذية'});$('kit-panel').append(field('التربة المغذية','kit-soil',soil));
    if(state.soil.key){const p=byKey.get(state.soil.key),qty=numberInput(state.soil.packs);qty.inputMode='numeric';qty.addEventListener('input',()=>{state.soil.packs=numeric(qty);activeGuide='soil';changed({resetOverrides:false});});qty.addEventListener('focus',()=>{activeGuide='soil';refresh();});$('kit-panel').append(field('عدد عبوات التربة','kit-soil-packs',qty,`حجم العبوة ${decimal(p.packLitres)} لتر.`));
      const coverage=make('div','kit-soil-coverage');coverage.id='kit-soil-coverage';$('kit-panel').append(coverage);
      const presets=catalog.guidance?.soilPlanning?.presetsCm||[3,4,5,6];$('kit-panel').append(field('اختر ارتفاعًا للتخطيط (سم)','kit-soil-depth-plan',segmentControl('kit-soil-depth-plan','ارتفاع التخطيط',presets.map(n=>({value:n,label:decimal(n)+' سم'})),planningDepth,n=>{planningDepth=n;afterChoice();})),facts(p));
    }else{
      $('kit-panel').append(helpBox('بدون تربة مغذية؟ اختَر النباتات على هذا الأساس','نباتات الربط والطافية لا تحتاج تربة مغذية في القاع. بعض النباتات المزروعة يمكن تغذيتها في أرضية خاملة بوسيلة مناسبة؛ راجع حاجة النبات قبل اختياره.','attention'));
      const browse=make('button','kit-text-button','شوف نباتات الربط والطافية في الإضافات');browse.type='button';browse.addEventListener('click',()=>{extrasPlantFilter=true;extraCategory="all";openStep(5);});$('kit-panel').append(browse);
    }
    const hasSand=state.zones.length>0;$('kit-panel').append(field('الرمل أو الحصى','kit-substrate-mode',segmentControl('kit-substrate-mode','اختيار الرمل أو الحصى',[{value:true,label:'مع رمل أو حصى',detail:'للتنسيق وتثبيت بعض النباتات'},{value:false,label:'بدون رمل أو حصى',detail:'قاع بلا طبقة تشطيب'}],hasSand,enabled=>{state=setSubstrateEnabled(state,catalog,enabled);afterChoice();})));
    if(!hasSand){$('kit-panel').append(helpBox('تقدر تكمل بدون طبقة رمل','لن نضيف رملًا أو حصى إلى السعر. راعِ حاجة الكائنات والنباتات التي تختارها للقاع المناسب.'));return;}
    const top=make('section','kit-subsection');top.append(make('h3','','وزّع أرضيتك كما تحب'));
    state.zones.forEach((zone,index)=>{const section=make('section','kit-zone'),head=make('div','kit-zone-heading');head.append(make('h4','',`المنطقة ${decimal(index+1)}`));const remove=make('button','kit-text-button','حذف المنطقة');remove.type='button';remove.setAttribute('aria-label',`حذف المنطقة ${decimal(index+1)}`);remove.addEventListener('click',()=>{state.zones.splice(index,1);rebalanceZones();distributeAllocation();activeGuide=0;afterChoice();});head.append(remove);section.append(head);
      const picker=productPicker('substrate',zone.key,key=>{if(!key)return;zone.key=key;state.substratePacks[key]??=1;distributeAllocation();activeGuide=index;afterChoice();},{id:'kit-zone-product-'+index,none:null});section.append(field('نوع الأرضية','kit-zone-product-'+index,picker));
      if(state.zones.findIndex(z=>z.key===zone.key)===index){const p=byKey.get(zone.key),bulk=p.ownerBulkEligible&&p.packKg,q=numberInput(bulk?(state.bulkWeightsKg?.[zone.key]??(numberValue(state.substratePacks[zone.key])||1)*p.packKg):(state.substratePacks[zone.key]??1));q.inputMode=bulk?'decimal':'numeric';q.addEventListener('input',()=>{if(bulk){state.bulkWeightsKg??={};state.bulkWeightsKg[zone.key]=numeric(q);}else state.substratePacks[zone.key]=numeric(q);activeGuide=index;changed({resetOverrides:false});});q.addEventListener('focus',()=>{activeGuide=index;refresh();});section.append(field(bulk?'الوزن المطلوب (كجم)':'عدد العبوات',(bulk?'kit-weight-':'kit-packs-')+zone.key,q,bulk?'نصف كيلو ومضاعفاته. سعر الكيلو '+money(Math.round(p.price/p.packKg*100))+'.':''));}
      const share=numberInput(zone.share);share.addEventListener('input',()=>{zone.share=numeric(share);activeGuide=index;changed({resetOverrides:false});});share.addEventListener('focus',()=>{activeGuide=index;refresh();});section.append(field('مساحة المنطقة من قاع الحوض (%)','kit-zone-share-'+index,share));
      if(state.zones.filter(z=>z.key===zone.key).length>1){const allocation=numberInput(zone.allocation);allocation.addEventListener('input',()=>{zone.allocation=numeric(allocation);activeGuide=index;changed({resetOverrides:false});});section.append(field('حصة المنطقة من وزن هذا النوع (%)','kit-zone-allocation-'+index,allocation));}
      const amount=make('p','kit-zone-amount');amount.id='kit-zone-amount-'+index;section.append(amount,facts(byKey.get(zone.key)));top.append(section);
    });
    const row=make('div','kit-zone-add'),add=make('button','kit-secondary','أضف منطقة أرضية');add.type='button';add.id='kit-add-zone';add.disabled=state.zones.length>=3;add.addEventListener('click',()=>{const p=available('substrate').find(p=>!state.zones.some(z=>z.key===p.key))||available('substrate')[0];state.zones.push({id:'zone-'+(state.zones.length+1),key:p.key,share:0,allocation:100});state.substratePacks[p.key]??=1;rebalanceZones();distributeAllocation();activeGuide=state.zones.length-1;afterChoice();});const sum=make('span','kit-share-total');sum.id='kit-share-total';row.append(add,sum);top.append(row);$('kit-panel').append(top);
    const detail=make('details','kit-specs');detail.append(make('summary','','كيف نحسب ارتفاع الرمل والحصى؟'),make('p','kit-field-small','تربة اللتر تحسب من حجم العبوة. الرمل والحصى الكثيف لهما تقدير مرجعي بالكثافة، وليس قياسًا للمنتج. المواد البركانية والمختلفة لا تأخذ تحويلًا تلقائيًا.'));const a=make('a','','مرجع حساب الرمل والحصى');a.href='https://www.sera.de/en/service/faq/faq-detail/sand-and-gravel-in-combination-how-much-sand-is-required/';a.target='_blank';a.rel='noopener noreferrer';detail.append(a);$('kit-panel').append(detail);
  }
  function rebalanceZones(){const length=state.zones.length;if(!length)return;state.zones.forEach((zone,i)=>{zone.id=`zone-${i+1}`;zone.share=i===length-1?100-Math.floor(100/length)*(length-1):Math.floor(100/length);});}
  function renderEquipment(role){
    heading(role==='light'?'نور مناسب لحوضك ونباتاتك.':'الغذاء على حسب الكائن، وليس حجم الحوض.',role==='light'?'اختَر الإضاءة وشاهد طريقة تثبيتها في الرسم. نوضّح المقاسات المعلنة، بينما احتياج النباتات يحتاج مراجعة أيضًا.':'اختر النوع الذي ستربيه لتظهر الأغذية المذكورة له في بيانات منتجاتك.');
    let choices=null;if(role==='food'){const targets={community:'مجتمعية',bottom:'أسماك القاع',shrimp:'شرمب',betta:'فايتر',guppy:'جوبي',cichlid:'سيكلد',fry:'صغار الأسماك',koi:'كوي',goldfish:'ذهبي',crab:'سرطانات مائية'},options=[{value:'all',label:'كل الأنواع'},...[...new Set(catalog.items.filter(p=>p.role==='food').flatMap(p=>p.foodFor||[]))].map(key=>({value:key,label:targets[key]||'نوع آخر'}))];$('kit-panel').append(field('الكائن الذي تريد إطعامه','kit-food-target',segmentControl('kit-food-target','نوع الكائن',options,foodView,key=>{foodView=key;if(state.foodKey&&key!=='all'&&!byKey.get(state.foodKey).foodFor?.includes(key))state.foodKey=null;afterChoice();})));choices=catalog.items.filter(p=>p.role==='food'&&(foodView==='all'||p.foodFor?.includes(foodView)));}
    $('kit-panel').append(field(role==='light'?'اختَر الإضاءة':'اختَر الغذاء','kit-'+role,productPicker(role,state[role+'Key'],key=>{state[role+'Key']=key;afterChoice();},{items:choices})));
    if(state[role+'Key'])$('kit-panel').append(facts(byKey.get(state[role+'Key'])));else $('kit-panel').append(helpBox(role==='light'?'عندك إضاءة؟':'تقدر تضيف الغذاء لاحقًا',role==='light'?'اختيار «بدون منتج جديد» يفترض أنك ستوفّر إضاءة مناسبة لنباتاتك. تأكد من طول التثبيت واحتياج النباتات؛ صورة الجهاز وحدها لا تثبت الملاءمة.':'لو الحوض ما زال في التجهيز، اختر الغذاء بعد تحديد الكائنات. لا نجمع أطعمة عشوائية بحسب سعة الحوض.'));
  }
  function renderReview(){
    heading('تجميعتك جاهزة للمراجعة.','كل منتج وعدده وسعره أمامك. راجع أيضًا القطع التي عندك والتوصيلات التي تحتاج تأكيدًا.');
    const kit=calculateKit(state,catalog),list=make('div','kit-review-list');list.setAttribute('role','list');
    kit.lines.forEach(line=>{
      const row=make('article','kit-review-item');row.setAttribute('role','listitem');const body=make('div');body.append(make('h3','',line.product.name),make('p','',line.weightKg?decimal(line.weightKg)+' كجم × '+money(line.pricePerKgMinor)+' للكيلو':money(line.unitMinor)+' للعبوة'));
      const total=make('p','kit-review-line-total',line.totalMinor===null?'راجع العدد':money(line.totalMinor));total.id='kit-line-total-'+line.key;body.append(total);
      const quantity=make('label','kit-review-quantity',line.weightKg?'حصة موزونة':'العدد'),input=numberInput(line.pricingUnit==='kg'?(line.weightKg??''):(line.quantity??''));input.id='kit-quantity-'+line.key;input.inputMode='numeric';input.setAttribute('aria-label',(line.pricingUnit==='kg'?'وزن بالكيلو ':'عدد ')+line.product.name);
      if(['tank','soil','substrate'].includes(line.product.role)){input.readOnly=true;body.append(make('p','kit-field-small',line.product.role==='tank'?'حوض واحد للتجميعة':'لتغيير العبوات وتحديث الارتفاع، ارجع لخطوة الأرضية.'));}
      else input.addEventListener('input',()=>{state.quantityOverrides[line.key]=numeric(input);changed({resetOverrides:false});updateReviewTotals();});quantity.append(input);row.append(image(line.product),body,quantity,errorGroup(input.id));list.append(row);
    });
    const total=make('div','kit-review-total');total.append(make('span','','مجموع المنتجات المرجعي'));const number=make('strong','',money(kit.totalMinor));number.id='kit-review-total';total.append(number);$('kit-panel').append(list,total);
    if(state.ownedComponents.length)$('kit-panel').append(make('p','kit-note','قطع أكّدت توفرها لديك أو أنها مرفقة: '+state.ownedComponents.map(r=>roleLabels[r]).join('، ')+'. لا تُضاف إلى السعر.'));
    if(kit.warnings.length){const notes=make('ul','kit-product-notes');[...new Set(kit.warnings)].forEach(t=>notes.append(make('li','',t)));$('kit-panel').append(notes);}
    $('kit-panel').append(make('p','kit-field-small',runtime?'السعر والتوفر يُراجعان في WooCommerce عند الإضافة للسلة التجريبية. لا يوجد دفع في هذه الخطوة.':'القائمة تجريبية وتُحفظ في هذا المتصفح. الأسعار والتوفر مرجعيان، والشراء غير متاح من الرابط العام.'));
    const actions=make('div','kit-review-actions'),finish=make('button','kit-primary',runtime?'أضف التجميعة إلى السلة':'احفظ قائمة التجهيز');finish.id='kit-finish';finish.type='button';finish.addEventListener('click',finishKit);const copy=make('button','kit-secondary','انسخ ملخص التجميعة والتوصيلات');copy.type='button';copy.addEventListener('click',copySummary);actions.append(finish,copy);$('kit-panel').append(actions);
    const fallback=make('div','kit-copy-fallback');fallback.id='kit-copy-fallback';fallback.hidden=true;const label=make('label','','حدّد الملخص وانسخه يدويًا.');label.htmlFor='kit-copy-text';const text=make('textarea');text.id='kit-copy-text';text.readOnly=true;text.rows=8;fallback.append(label,text);$('kit-panel').append(fallback);
  }
  function updateReviewTotals(){const kit=calculateKit(state,catalog);$('kit-review-total').textContent=money(kit.totalMinor);kit.lines.forEach(line=>{const total=$('kit-line-total-'+line.key);if(total)total.textContent=line.totalMinor===null?'حدّد العدد':money(line.totalMinor);const note=$('kit-under-'+line.key);if(note)note.hidden=!line.underRequired;});}
  function materialTone(key){return key.includes('black')?'black':key.includes('volcanic')?'volcanic':key.includes('gold')?'gold':'sand';}
  function refresh(){
    const tank=byKey.get(state.tankKey),dims=tank.dimensions,kit=calculateKit(state,catalog),g=kit.geometry;
    $('kit-tank-frame').style.setProperty('--kit-ratio',String(dims.length/dims.height));$('kit-tank-frame').dataset.background=tank.background||'clear';
    $('kit-preview-dimensions').textContent=`${dims.length} × ${dims.width} × ${dims.height} سم`;$('kit-preview-length').textContent=`الطول ${decimal(dims.length)} سم`;$('kit-preview-volume').textContent=decimal(kit.volumeLitres)+' لتر اسميًا';$('kit-preview-total').textContent=money(kit.totalMinor);$('kit-preview-substrate').textContent=kit.substrateVolume===null?'الحجم غير مكتمل التوثيق':(g.hasEstimates?'نحو ':'')+decimal(kit.substrateVolume)+' لتر';
    const soil=$('kit-soil-fill'),soilDepth=g.soilDepthCm;soil.hidden=state.step===0||!state.soil.key;soil.style.setProperty('--kit-fill',String(soilDepth===null?.035:Math.min(1,soilDepth/dims.height)));soil.classList.toggle('is-unmeasured',!!state.soil.key&&soilDepth===null);
    const fillHost=$('kit-zone-fills'),plan=$('kit-plan');while(fillHost.children.length>state.zones.length)fillHost.lastElementChild.remove();plan.replaceChildren();let left=0;
    g.zones.forEach((zone,index)=>{
      const source=state.zones[index],share=Math.max(0,Math.min(100,numberValue(source.share)||0));let fill=fillHost.children[index];if(!fill){fill=make('div','kit-zone-fill');fillHost.append(fill);}fill.style.left=left+'%';fill.style.width=Math.min(share,100-left)+'%';fill.style.bottom=soilDepth===null?'3.5%':Math.min(100,(soilDepth||0)/dims.height*100)+'%';fill.style.setProperty('--kit-fill',String(zone.depthCm===null?.065:Math.min(1,Math.max(0,zone.depthCm)/dims.height)));fill.dataset.tone=materialTone(source.key);fill.classList.toggle('is-unmeasured',zone.depthCm===null);fill.style.backgroundImage='none';
      const patch=make('span','',`${decimal(index+1)} · ${decimal(share)}٪`);patch.style.width=share+'%';patch.dataset.tone=materialTone(source.key);patch.title=byKey.get(source.key).name;plan.append(patch);left+=share;
      const amount=$('kit-zone-amount-'+index);if(amount)amount.textContent=zone.depthCm===null?'ارتفاع هذا النوع غير موثق؛ لا توجد تغطية أو كثافة مرجعية مناسبة له.':`${zone.estimated?'تقدير مرجعي، غير مقاس للمنتج: ':''}حجم موزّع ${decimal(zone.litres)} لتر · ارتفاع ${decimal(zone.depthCm)} سم${zone.totalDepthCm!==null?' · إجمالي الطبقات '+decimal(zone.totalDepthCm)+' سم':''}`;
    });
    const soilAmount=$('kit-soil-amount');if(soilAmount)soilAmount.textContent=soilDepth===null?'ارتفاع التربة غير محدد دون تغطية موثقة.':`${decimal(numberValue(state.soil.packs)||0)} عبوة · ارتفاع تقريبي ${decimal(soilDepth)} سم على كامل أرضية الحوض`;
    const sum=state.zones.reduce((n,z)=>n+(numberValue(z.share)||0),0),shareTotal=$('kit-share-total');if(shareTotal){shareTotal.textContent='مجموع المساحة: '+decimal(sum)+'٪';shareTotal.classList.toggle('is-invalid',state.zones.length>0&&Math.abs(sum-100)>.01);}plan.hidden=state.step!==1||!state.zones.length;
    const active=g.zones[typeof activeGuide==='number'?activeGuide:0],level=activeGuide==='soil'&&state.soil.key?soilDepth:active?.totalDepthCm;$('kit-height-guide').classList.toggle('is-high',(level||0)/dims.height>.65);
    $('kit-height-guide').hidden=state.step!==1||level===null||level===undefined||level<=0;$('kit-height-guide').style.setProperty('--kit-guide',String(Math.max(0,Math.min(1,(level||0)/dims.height))));$('kit-guide-label').textContent=(activeGuide==='soil'?'التربة ':active?.estimated?'نحو ':'السطح ')+decimal(level||0)+' سم';
    $('kit-preview-caption').textContent=g.hasEstimates?'الارتفاع تقدير مرجعي بكثافة رمل وحصى كثيف، وليس قياسًا للمنتج.':g.allKnown?'ارتفاعات تقريبية من الأبعاد الاسمية وحجم العبوات. ليست مخطط تصنيع.':'المناطق ذات الخط المتقطع توضيحية فقط؛ لا تعبّر عن ارتفاع حتى يوثّق حجم العبوة.';
    $('kit-cross-section').setAttribute('aria-label','حوض '+dims.length+' في '+dims.width+' في '+dims.height+' سم. '+(g.allKnown?'ارتفاعات محسوبة من العبوات.':'بعض ارتفاعات الأرضيات غير موثقة.'));
    fillHost.hidden=state.step===0;
    $('kit-preview-substrate').closest('div').hidden=state.step!==1;
    $('kit-preview-caption').textContent=state.step===0?'رسم مقاسات توضيحي. الخلفية والسيلكون حسب تشطيب المصنع.':state.step===1?$('kit-preview-caption').textContent:state.step>=3&&state.lightKey?'شكل الإضاءة وطريقة تثبيتها توضيحيان، وليسا رسمًا بأبعاد الجهاز.':'معاينة للتجميعة؛ تفاصيل الارتفاع في خطوة الأرضية.';
    if(state.step!==1)$('kit-cross-section').setAttribute('aria-label','رسم الحوض بمقاس '+dims.length+' في '+dims.width+' في '+dims.height+' سم');
    const sync=(id,value)=>{const input=$(id);if(input&&document.activeElement!==input)input.value=value??'';};
    sync('kit-soil-packs',state.soil.packs);kit.lines.forEach(line=>{sync('kit-weight-'+line.key,line.pricingUnit==='kg'?line.weightKg:(numberValue(state.substratePacks[line.key])||1)*line.product.packKg);sync('kit-packs-'+line.key,state.substratePacks[line.key]);sync('kit-quantity-'+line.key,line.pricingUnit==='kg'?line.weightKg:line.quantity);});
    if(state.step===6)updateReviewTotals();
    renderSystemDiagram();renderLightVisual();updateBeginnerFacts();refreshTray();
  }
  function paintErrors(errors,focus){
    root.querySelectorAll('[aria-invalid=true]').forEach(el=>el.removeAttribute('aria-invalid'));root.querySelectorAll('.kit-field-error').forEach(el=>{el.hidden=true;el.textContent='';});
    errors.forEach(error=>{const input=$(error.field),description=$(error.field+'-error');if(input)input.setAttribute('aria-invalid','true');if(description){description.textContent=error.message;description.hidden=false;}});
    if(errors.length){announce(errors[0].message);if(focus){const first=errors[0];if(first.step!==state.step){state.step=first.step;renderPanel();refresh();paintErrors(errors,false);}const fallback=first.field.startsWith('kit-equipment-')?$('kit-owned-'+first.field.slice(14)):null;($(first.field)||fallback||$('kit-step-title'))?.focus();}}
  }
  function goStep(next){
    if(cartBusy)return;if(next>state.step){const errors=validateState(state,catalog,next-1).errors;if(errors.length){paintErrors(errors,true);return;}}
    state.step=next;renderPanel();refresh();remember();$('kit-step-title').focus({preventScroll:true});const top=root.getBoundingClientRect().top+scrollY-90;window.scrollTo({top:Math.max(0,top),behavior:'instant'});
  }
  function renderTray(){
    const bar=make('aside','kit-tray');bar.id='kit-tray';bar.setAttribute('aria-label','منتجات تجميعتك');const strip=make('div','kit-tray-strip'),toggle=make('button','kit-tray-toggle','تجميعتك');toggle.type='button';toggle.id='kit-tray-toggle';toggle.setAttribute('aria-controls','kit-tray-content');toggle.addEventListener('click',()=>{trayOpen=!trayOpen;refreshTray();});const total=make('div','kit-tray-total');total.append(make('span','','مجموع المنتجات'));const amount=make('strong','',money(0));amount.id='kit-tray-total';total.append(amount);const next=make('button','kit-primary');next.type='button';next.id='kit-tray-next';next.addEventListener('click',()=>{trayOpen=false;if(state.step===6)finishKit();else openStep(state.step+1);});strip.append(toggle,total,next);
    const content=make('section','kit-tray-content');content.id='kit-tray-content';content.hidden=true;const header=make('div','kit-tray-heading');header.append(make('h2','','منتجاتك، قطعة بقطعة'));const close=make('button','kit-text-button','إغلاق');close.type='button';close.addEventListener('click',()=>{trayOpen=false;refreshTray();toggle.focus({preventScroll:true});});header.append(close);const list=make('div','kit-tray-list');list.id='kit-tray-list';content.append(header,list);bar.append(content,strip);root.append(bar);
  }
  function refreshTray(){
    if(!$('kit-tray'))return;const kit=calculateKit(state,catalog),list=$('kit-tray-list');$('kit-tray-content').hidden=!trayOpen;$('kit-tray-toggle').setAttribute('aria-expanded',String(trayOpen));$('kit-tray-toggle').textContent='تجميعتك ('+decimal(kit.lines.length)+')';$('kit-tray-total').textContent=money(kit.totalMinor);$('kit-tray-next').textContent=state.step===6?(runtime?'أضف للسلة':'احفظ التجميعة'):state.step===5?'راجع التجميعة':'التالي';
    const signature=kit.lines.map(l=>l.key+':'+l.pricingUnit).join('|');if(signature!==traySignature){traySignature=signature;list.replaceChildren();kit.lines.forEach(line=>{const row=make('article','kit-tray-row');row.dataset.key=line.key;const text=make('div','kit-tray-row-copy');text.append(make('h3','',line.product.name));const price=make('p');price.id='kit-tray-line-'+line.key;text.append(price);const actions=make('div','kit-tray-row-actions'),edit=make('button','kit-text-button','تعديل');edit.type='button';edit.setAttribute('aria-label','تعديل '+line.product.name);edit.addEventListener('click',()=>openStep(editStepForProduct(catalog,line.key)??0));actions.append(edit);
      if(line.product.role!=='tank'){const quantity=numberInput(line.pricingUnit==='kg'?(line.weightKg??''):(line.quantity??''));quantity.id='kit-tray-qty-'+line.key;quantity.setAttribute('aria-label',(line.product.role==='substrate'&&line.pricingUnit==='kg'?'وزن بالكيلو ':'عدد ')+line.product.name);quantity.addEventListener('input',()=>{const value=numeric(quantity);if(line.product.role==='soil')state.soil.packs=value;else if(line.product.role==='substrate'&&line.pricingUnit==='kg'){state.bulkWeightsKg??={};state.bulkWeightsKg[line.key]=value;}else if(line.product.role==='substrate')state.substratePacks[line.key]=value;else state.quantityOverrides[line.key]=value;changed({resetOverrides:false});});actions.append(quantity);const remove=make('button','kit-text-button','حذف');remove.type='button';remove.setAttribute('aria-label','حذف '+line.product.name);remove.addEventListener('click',()=>removeFromKit(line.key));actions.append(remove);}
      row.append(image(line.product),text,actions);list.append(row);
    });}
    kit.lines.forEach(line=>{const price=$('kit-tray-line-'+line.key);if(price)price.textContent=(line.weightKg?decimal(line.weightKg)+' كجم · ':'')+(line.totalMinor===null?'راجع الكمية':money(line.totalMinor));const input=$('kit-tray-qty-'+line.key);if(input&&document.activeElement!==input)input.value=line.pricingUnit==='kg'?(line.weightKg??''):(line.quantity??'');});
  }
  function renderLightVisual(){const host=$('kit-light-view'),p=byKey.get(state.lightKey);if(!host)return;host.hidden=!p||state.step<3;const form=p?.diagram?.form||'unknown',mount=p?.diagram?.mount||'unknown';host.dataset.lengthClass=p?.diagram?.lengthClass||'unknown';host.dataset.form=form;host.dataset.mount=mount;host.querySelectorAll('[data-light-form]').forEach(g=>{if(g.dataset.lightForm.split(' ').includes(form))g.removeAttribute('hidden');else g.setAttribute('hidden','');});host.querySelectorAll('[data-light-mount]').forEach(g=>{if(g.dataset.lightMount===mount)g.removeAttribute('hidden');else g.setAttribute('hidden','');});host.setAttribute('aria-label',p?'رسم توضيحي لشكل تثبيت '+p.name:'الإضاءة');}
  function summary(){const kit=calculateKit(state,catalog),tank=byKey.get(state.tankKey),system=filterSystem(state,catalog);return ['أكوا هافن — تجميعة الحوض',`المقاس: ${tank.dimensions.length} × ${tank.dimensions.width} × ${tank.dimensions.height} سم`,`الخلفية: ${tank.background||'غير موثقة'}`,...kit.lines.map(l=>l.weightKg?`${l.product.name} — ${decimal(l.weightKg)} كجم × ${money(l.pricePerKgMinor)} للكيلو = ${money(l.totalMinor)}`:`${l.product.name} — ${l.quantity??'راجع العدد'} × ${money(l.unitMinor)}`),`التشغيل: ${system.label||'بدون جهاز جديد'}`,...state.ownedComponents.map(role=>'عندي/مرفق: '+roleLabels[role]),...new Set(kit.warnings),`المجموع المرجعي: ${money(kit.totalMinor)}`,'قائمة تجريبية؛ السعر والتوفر يراجعان عند الشراء.'].join('\n');}
  async function copySummary(){
    $('kit-success')?.remove();const text=summary();try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(text);announce('نُسخ ملخص التجميعة.');}
    catch{const host=$('kit-copy-fallback'),area=$('kit-copy-text');host.hidden=false;area.value=text;area.focus();area.select();announce('تعذّر النسخ التلقائي. حدّد الملخص الظاهر وانسخه يدويًا.');}
  }
  function requestIdentifier(){return globalThis.crypto?.randomUUID?.()||'kit-'+Date.now()+'-'+Math.random().toString(36).slice(2);}
  async function finishKit(){
    if(cartBusy)return;
    const errors=calculateKit(state,catalog).errors;if(errors.length){paintErrors(errors,true);return;}
    requestId??=requestIdentifier();let payload;try{payload=buildCartPayload(state,catalog,requestId);}catch(error){announce(error.message);return;}
    const button=$('kit-finish'),controls=[...root.querySelectorAll('input,select,textarea,button')],disabledBefore=controls.map(e=>e.disabled);cartBusy=true;controls.forEach(e=>{e.disabled=true;});root.setAttribute('aria-busy','true');$('kit-success')?.remove();announce(runtime?'نراجع المنتجات ونضيفها إلى السلة…':'نحفظ قائمة التجهيز في هذا المتصفح…');
    try{
      if(runtime){
        const response=await fetch(runtime.cartEndpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-WP-Nonce':runtime.nonce},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
        const result=await response.json();if(!response.ok||result.success!==true)throw Error(typeof result.message==='string'?result.message:'تعذّرت إضافة التجميعة. بقيت اختياراتك هنا؛ حاول مجددًا.');
        const target=new URL(result.cartUrl,location.href);if(target.origin!==location.origin)throw Error('تعذّر فتح السلة. احتفظنا باختياراتك في الصفحة.');location.assign(target.href);
      }else{
        const raw=localStorage.getItem(KIT_LIST_KEY);if(raw!==null){let prior;try{prior=JSON.parse(raw);}catch{throw Error('تعذّر قراءة قائمة التجهيز السابقة؛ لم نستبدلها. انسخ ملخصك للاحتفاظ به.');}if(prior?.version!==2||!Array.isArray(prior.lines))throw Error('صيغة قائمة التجهيز السابقة مختلفة؛ لم نستبدلها. انسخ ملخصك.');}
        if(localStorage.getItem(KIT_LIST_KEY)!==raw)throw Error('تغيّرت القائمة في تبويب آخر. أعد المحاولة بعد مراجعتها، أو انسخ ملخصك.');
        try{localStorage.setItem(KIT_LIST_KEY,JSON.stringify({version:2,savedAt:new Date().toISOString(),lines:payload.lines,design:payload.design,totalMinor:calculateKit(state,catalog).totalMinor}));}catch{throw Error('تعذّر حفظ قائمة التجهيز في المتصفح. بقيت اختياراتك هنا؛ انسخ الملخص للاحتفاظ بها.');}
        announce('حُفظت قائمة التجهيز في هذا المتصفح.');const success=make('div','kit-success');success.id='kit-success';success.append(make('strong','','تجميعتك محفوظة.'),make('p','','يمكنك العودة إلى هذه الصفحة وتعديل اختياراتك. هذه قائمة تجريبية، ولم تُرسل كطلب شراء.'));$('kit-panel').append(success);
      }
    }catch(error){announce(['TimeoutError','AbortError'].includes(error?.name)?'تعذّر التأكد من رد السلة في الوقت المحدد. أعد المحاولة بنفس الاختيارات.':error instanceof TypeError?'تعذّر الاتصال بالسلة أو التخزين. بقيت اختياراتك هنا؛ أعد المحاولة أو انسخ الملخص.':error instanceof SyntaxError?'تعذّر قراءة رد السلة. اختياراتك باقية؛ أعد المحاولة.':error instanceof Error&&error.message?error.message:'تعذّر إتمام العملية. اختياراتك باقية هنا؛ انسخ الملخص أو حاول مجددًا.',true);}
    finally{cartBusy=false;controls.forEach((e,i)=>{e.disabled=disabledBefore[i];});root.removeAttribute('aria-busy');}
  }
  async function load(){
    $('kit-loading').hidden=false;$('kit-retry').hidden=true;
    try{const response=await fetch(root.dataset.catalogUrl,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error();catalog=checkedCatalog(await response.json());byKey=new Map(catalog.items.map(p=>[p.key,p]));if(!available('tank').length||!available('substrate').length)throw Error();readState();filterView=state.equipment.airStone&&!state.filterKey?'airStone':(['sponge','canister','hob','internal'].includes(byKey.get(state.filterKey)?.filterType)?byKey.get(state.filterKey).filterType:'all');
      $('kit-mode-note').textContent=runtime?'تجهيز من منتجات المتجر. السعر والتوفر يُراجعان عند الإضافة إلى السلة.':'قائمة تجهيز تجريبية — الشراء غير متاح في هذه المعاينة.';
      $('kit-app').hidden=false;$('kit-loading').hidden=true;if(!$('kit-tray'))renderTray();renderPanel();refresh();ready=true;
    }catch{$('kit-loading').textContent='تعذّر تحميل منتجات التجهيز. أعد المحاولة، أو تصفّح المتجر من القائمة.';$('kit-retry').hidden=false;}
  }
  $('kit-retry').addEventListener('click',load);$('kit-form').addEventListener('submit',event=>event.preventDefault());
  $('kit-next').addEventListener('click',()=>goStep(Math.min(6,state.step+1)));$('kit-back').addEventListener('click',()=>goStep(Math.max(0,state.step-1)));
  root.querySelectorAll('[data-kit-step]').forEach(button=>button.addEventListener('click',()=>goStep(Number(button.dataset.kitStep))));
  $('kit-compact').addEventListener('click',()=>{const compact=root.classList.toggle('is-preview-compact');previewControl();});
  document.addEventListener('click',event=>{if(cartBusy&&event.target.closest('a'))event.preventDefault();},true);
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{root.style.setProperty('--kit-preview-height',Math.ceil(root.querySelector('.kit-workbench').getBoundingClientRect().height)+'px');}).observe(root.querySelector('.kit-workbench'));
  const viewportChanged=()=>root.classList.toggle('is-short-viewport',(window.visualViewport?.height||innerHeight)<620);viewportChanged();window.visualViewport?.addEventListener('resize',viewportChanged);window.addEventListener('resize',viewportChanged,{passive:true});
  window.addEventListener('storage',event=>{if(ready&&(event.key===SETUP_STORAGE_KEY||event.key===null)){storageWritable=false;storageNote('تغيّرت التجميعة في تبويب آخر. احتفظنا باختيارات هذه الصفحة؛ انسخ الملخص قبل المغادرة.');}});
  load();
}
