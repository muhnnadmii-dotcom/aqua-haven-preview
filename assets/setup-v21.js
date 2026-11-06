import {SETUP_STORAGE_KEY,KIT_LIST_KEY,checkedCatalog,initialState,restorableState,numberValue,validateState,calculateKit,buildCartPayload,suitability,recommendations,filterSystem,tankVariants} from './setup-v21-core.mjs?v=21.1';

const root=document.querySelector('[data-kit-builder]');
if(root)boot(root);
function boot(root){
  const $=id=>root.querySelector('#'+id),make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const money=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(n/100)+' ر.س';
  const decimal=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(n);
  const labels=['الحوض والزجاج','الأرضية','الفلترة','الإضاءة','الغذاء','الإضافات','المراجعة'];
  const base=root.dataset.base||'../';let catalog,state,byKey,storageRaw=null,storageWritable=false,requestId=null,activeGuide=0,ready=false,previousPanel=null,cartBusy=false;
  let runtime=null;try{const candidate=JSON.parse(document.querySelector('#aqh-kit-runtime')?.textContent||'null');if(root.dataset.mode==='woo'&&candidate&&typeof candidate.nonce==='string'&&new URL(candidate.cartEndpoint,location.href).origin===location.origin)runtime=candidate;}catch{}
  const asset=p=>new URL(base+p.image,location.href).href;
  const image=p=>{const img=make('img');img.src=asset(p);img.alt='';img.loading='lazy';img.decoding='async';img.width=112;img.height=112;img.addEventListener('error',()=>{img.hidden=true;},{once:true});return img;};
  const available=role=>catalog.items.filter(p=>p.role===role&&p.inStock);
  const numeric=(input)=>{const n=numberValue(input.value);return n===null?input.value:n;};
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
    if(rebuild){renderPanel();if(focus)$(focus)?.focus({preventScroll:true});}
    paintErrors([],false);refresh();remember();
  }
  function field(label,id,control,help){
    const wrap=make('div','kit-field'),name=make('label','',label);name.htmlFor=id;control.id=id;
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
  function productDetail(p){
    const row=make('div','kit-selected-product'),body=make('div');body.append(make('h3','',p.name),make('p','',money(Math.round(p.price*100))));
    const href=runtime?runtime.productUrls?.[p.sourceId]:new URL(base+'products/'+p.sourceId+'/',location.href).href;
    if(typeof href==='string'){try{const url=new URL(href,location.href);if(url.origin===location.origin){const a=make('a','','تفاصيل المنتج');a.href=url.href;body.append(a);}}catch{}}
    row.append(image(p),body);const notes=make('ul','kit-product-notes');(p.notes||[]).slice(0,4).forEach(text=>notes.append(make('li','',text)));return [row];
  }
  const roleLabels={airPump:'مضخة الهواء',airline:'أنبوب الهواء',airStone:'حجر الهواء',media:'إسفنج ووسائط الترشيح',hose:'خراطيم الماء',waterPump:'مضخة الماء',checkValve:'صمام عدم الرجوع'};
  const roleCatalog={media:'media'};
  let filterView='all';
  let foodView='all';
  function option(value,text,disabled=false){const o=make('option','',text);o.value=value;o.disabled=disabled;return o;}
  function choiceName(p){return p.name+(p.model&&!p.name.toLowerCase().includes(String(p.model).toLowerCase())?' · '+p.model:'');}
  function previewControl(){const compact=root.classList.contains('is-preview-compact');$('kit-compact').textContent=state.step===2?(compact?'تفاصيل التوصيل':'إخفاء التفاصيل'):(compact?'تكبير المعاينة':'تصغير المعاينة');$('kit-compact').setAttribute('aria-expanded',String(!compact));}
  function pageUrl(relative){const candidate=new URL(runtime?.homeUrl||(runtime?'/':base),location.href);return new URL(relative,candidate.origin===location.origin?candidate:new URL('/',location.href)).href;}
  function facts(product){
    const list=make('ul','kit-product-notes');
    [...new Set([...(product.notes||[]),...(product.unknowns||[]).map(t=>typeof t==='string'?t:'')])].filter(Boolean).slice(0,7).forEach(t=>list.append(make('li','',t)));
    const fit=suitability(product,byKey.get(state.tankKey));
    if(['filter','light'].includes(product.role))list.prepend(make('li','',fit.status==='recommended'?'مقاس حوضك ضمن النطاق الموثق لهذا المنتج.':fit.status==='incompatible'?'مقاس حوضك خارج النطاق المعلن؛ راجع سبب الاختيار والتثبيت.':'لا تتوفر بيانات كافية لتأكيد ملاءمته لمقاس حوضك.'));
    return list;
  }
  function productPicker(role,value,onChange,{id='kit-'+role,none='بدون منتج جديد',items=null}={}){
    const select=make('select'),groups=recommendations(catalog,role,state),all=items||catalog.items.filter(p=>p.role===role);
    select.id=id;select.append(option('',none));
    const statusLabels={recommended:'ضمن النطاق الموثق للمقاس',unverified:'يحتاج مراجعة التوافق',incompatible:'خارج النطاق المعلن'};
    for(const status of ['recommended','unverified','incompatible']){
      const choices=all.filter(p=>suitability(p,byKey.get(state.tankKey)).status===status);
      if(!choices.length)continue;
      const group=make('optgroup');group.label=statusLabels[status];
      choices.forEach(p=>group.append(option(p.key,choiceName(p)+' — '+money(Math.round(p.price*100))+(p.inStock?'':' · غير متوفر مرجعيًا'),!p.inStock)));
      select.append(group);
    }
    select.value=value||'';select.addEventListener('change',()=>onChange(select.value||null));return select;
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
    const mode=make('select');const typeNames={all:'كل أنواع الفلاتر',sponge:'فلتر إسفنجي يعمل بالهواء',canister:'كانستر خارجي',hob:'شلال معلّق على الحافة',internal:'فلتر داخلي',airStone:'حجر هواء للتهوية'};
    Object.entries(typeNames).forEach(([key,name])=>mode.append(option(key,name)));mode.value=filterView;
    mode.addEventListener('change',()=>{filterView=mode.value;const chosen=byKey.get(state.filterKey);if((filterView==='airStone'&&state.filterKey)||(filterView!=='airStone'&&state.equipment.airStone)||(filterView!=='all'&&chosen&&chosen.filterType!==filterView))chooseFilter(null);changed({rebuild:true,focus:'kit-filter-type',resetOverrides:false});});$('kit-panel').append(field('طريقة الفلترة أو التهوية','kit-filter-type',mode));
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
        const position=make('select');position.append(option('above','أعلى من سطح الماء'),option('below','أسفل من سطح الماء'));position.value=state.airPumpPosition;position.addEventListener('change',()=>{state.airPumpPosition=position.value;changed({rebuild:true,focus:'kit-air-position',resetOverrides:false});});parts.append(field('موضع مضخة الهواء','kit-air-position',position,'عند وضعها أسفل سطح الماء، يلزم صمام عدم رجوع على خط الهواء.'));
        if(!needRoles.has('checkValve'))equipmentControl('checkValve',parts);
        const tube=byKey.get(state.equipment.airline);parts.append(make('p','kit-field-small','لون أنبوب الهواء: '+(tube?.airlineColor||'غير موثّق للخيارات الحالية')+'. لا نعرض لونًا لا تثبته بيانات المنتج.'));
      }
      (system.warnings||[]).forEach(t=>parts.append(make('p','kit-note-warning kit-note',t)));
    }else parts.append(make('p','kit-note','اختَر فلترًا أو جهاز تهوية ليظهر مسار التوصيل وقطع التشغيل الخاصة به.'));
    const more=make('details','kit-catalog-coverage'),moreSummary=make('summary','','مضخة ماء إضافية');more.append(moreSummary);equipmentControl('waterPump',more);if(state.equipment.waterPump||state.ownedComponents.includes('waterPump'))more.open=true;parts.append(more);$('kit-panel').append(parts);
  }
  function renderExtras(){
    heading('اللمسات والعناية، حسب احتياجك.','أضف نباتات أو أدوات وعناية من المنتجات المتاحة. هذه إضافات اختيارية، ومراجعة بيانات كل منتج تساعدك تختار ما يلائم تجميعتك.');
    const search=make('input');search.type='search';search.placeholder='اسم المنتج أو استخدامه';$('kit-panel').append(field('ابحث في الإضافات','kit-extra-search',search));
    const category=make('select'),groups={all:'كل الإضافات',plant:'نباتات',plants:'نباتات',care:'العناية بالماء',decor:'التنسيق والديكور',aquascape:'التنسيق والديكور',plantCare:'العناية بالنباتات',feedingAccessory:'أدوات التغذية',lightingAccessory:'ملحقات الإضاءة',equipmentAccessory:'أدوات وتجهيزات',stand:'طاولات الأحواض',tools:'أدوات وصيانة',equipment:'تجهيزات',accessory:'وصلات وإكسسوارات'};category.append(option('all','كل الإضافات'));for(const key of new Set(catalog.items.filter(p=>['extra','accessory'].includes(p.role)).map(p=>p.extraGroup||'accessory')))category.append(option(key,groups[key]||'إضافات متنوعة'));$('kit-panel').append(field('قسم الإضافات','kit-extra-category',category));
    const select=make('select');select.id='kit-extra-select';const selected=make('div','kit-extra-list');
    function populate(){select.replaceChildren(option('','اختر منتجًا لإضافته'));const q=search.value.trim().toLowerCase(),products=catalog.items.filter(p=>['extra','accessory'].includes(p.role)&&p.inStock&&!state.extras.includes(p.key)&&(category.value==='all'||(p.extraGroup||'accessory')===category.value)&&(!q||(p.name+' '+(p.notes||[]).join(' ')).toLowerCase().includes(q)));products.forEach(p=>select.append(option(p.key,p.name+' — '+money(Math.round(p.price*100)))));if(!products.length)select.append(option('','لا توجد إضافات مطابقة',true));select.disabled=state.extras.length>=24;}
    search.addEventListener('input',populate);category.addEventListener('change',populate);select.addEventListener('change',()=>{if(select.value&&state.extras.length<24){state.extras.push(select.value);changed({rebuild:true,focus:'kit-extra-search',resetOverrides:false});}});populate();$('kit-panel').append(field('الإضافات المتاحة','kit-extra-select',select),make('p','kit-field-small','اخترت '+decimal(state.extras.length)+' من ٢٤ إضافة متاحة لكل تجميعة.'));
    state.extras.forEach(key=>{const p=byKey.get(key),row=make('article','kit-extra-item');row.append(...productDetail(p),facts(p));const remove=make('button','kit-text-button','أزل '+p.name);remove.type='button';remove.addEventListener('click',()=>{state.extras=state.extras.filter(k=>k!==key);delete state.quantityOverrides[key];changed({rebuild:true,resetOverrides:false});});row.append(remove);selected.append(row);});$('kit-panel').append(selected);
    const coverage=make('details','kit-catalog-coverage'),summary=make('summary','','تغطية الكتالوج والمنتجات التي تحتاج مراجعة');coverage.append(summary,make('p','kit-field-small','راجعنا كتالوج المتجر كاملًا. تظهر المنتجات في خطواتها المناسبة؛ المنتجات ذات البيانات المتعارضة أو التي لا تخص هذه التجميعة تبقى متاحة في صفحاتها الأصلية.'));
    const count=make('p','kit-field-small');count.textContent=decimal(catalog.allProducts?.length||405)+' منتجًا في الفهرس · '+decimal(catalog.items.length)+' خيارًا في التجهيز والإضافات.';coverage.append(count);
    const link=make('a','','تصفّح جميع منتجات المتجر');link.href=pageUrl('shop/');coverage.append(link);$('kit-panel').append(coverage);
  }
  function renderSystemDiagram(){
    const system=filterSystem(state,catalog),host=$('kit-system-diagram');if(!host)return;host.hidden=state.step!==2;
    $('kit-cross-section').hidden=state.step===2;$('kit-plan').hidden=state.step===2||!state.zones.length;
    if(state.step!==2)return;
    host.dataset.type=system.type;host.dataset.airPosition=state.airPumpPosition;
    host.querySelectorAll('[data-system-type]').forEach(el=>{if(el.dataset.systemType.split(' ').includes(system.type))el.removeAttribute('hidden');else el.setAttribute('hidden','');});
    $('kit-system-label').textContent=system.label||'اختر طريقة التشغيل';
    const status=$('kit-system-parts');status.replaceChildren();system.requires.forEach(req=>status.append(make('li',req.satisfied?'is-ready':'is-missing',(req.satisfied?'جاهز: ':'يلزم: ')+(roleLabels[req.role]||req.label)+(req.included?' · مرفق':req.owned?' · عندك':req.selectedKey?' · '+byKey.get(req.selectedKey)?.name:''))));
    $('kit-system-note').textContent=system.type==='none'?'سيظهر مسار الماء أو الهواء بمجرد اختيار المنتج.':'رسم توضيحي لطريقة التشغيل؛ مواضع الأنابيب والتثبيت النهائية حسب دليل المنتج. '+(system.placementVerified?'':'موضع الجهاز ليس مواصفة تركيب مؤكدة لهذا الموديل.');
  }
  function renderPanel(){
    if([1,2].includes(state.step)&&previousPanel!==state.step&&matchMedia('(max-width:760px)').matches){root.classList.add('is-preview-compact');$('kit-compact').textContent='تكبير المعاينة';$('kit-compact').setAttribute('aria-expanded','false');}
    previousPanel=state.step;$('kit-panel').replaceChildren();announce('');root.dataset.step=String(state.step);
    root.querySelectorAll('[data-kit-step]').forEach(b=>{if(Number(b.dataset.kitStep)===state.step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
    $('kit-back').hidden=state.step===0;$('kit-next').hidden=state.step===6;$('kit-next').firstChild.textContent=state.step<5?'إلى '+labels[state.step+1]+' ':'راجع التجميعة ';
    if(state.step===0)renderTank();else if(state.step===1)renderSubstrate();else if(state.step===2)renderFilter();else if(state.step===5)renderExtras();else if(state.step===6)renderReview();else renderEquipment(state.step===3?'light':'food');previewControl();
  }
  function renderTank(){
    heading('مقاس الحوض أولًا.','اختَر من المقاسات الجاهزة، ثم نرتّب خيارات التجهيز حول حوضك.');
    const tanks=catalog.items.filter(p=>p.role==='tank'),current=byKey.get(state.tankKey),sizes=[];
    tanks.forEach(p=>{const d=p.dimensions,key=[d.length,d.width,d.height].join('×');if(!sizes.some(s=>s.value===key))sizes.push({value:key,dimensions:d});});sizes.sort((a,b)=>a.dimensions.length-b.dimensions.length||a.dimensions.width-b.dimensions.width||a.dimensions.height-b.dimensions.height);
    const size=make('select');sizes.forEach(s=>size.append(option(s.value,s.value+' سم')));size.value=Object.values(current.dimensions).length?[current.dimensions.length,current.dimensions.width,current.dimensions.height].join('×'):sizes[0].value;
    size.addEventListener('change',()=>{const group=tanks.filter(p=>[p.dimensions.length,p.dimensions.width,p.dimensions.height].join('×')===size.value);state.tankKey=(group.find(p=>p.background===current.background&&p.inStock)||group.find(p=>p.inStock)||group[0]).key;changed({rebuild:true,focus:'kit-tank',resetOverrides:false});});
    $('kit-panel').append(field('المقاس الجاهز','kit-tank',size,'الطول × العمق × الارتفاع. الأبعاد اسميّة من بيانات المنتج.'));
    const backgrounds=make('select'),variants=tankVariants(catalog,state.tankKey),backgroundNames={clear:'شفافة',black:'سوداء',white:'بيضاء'};
    ['clear','black','white'].forEach(color=>{const p=variants.find(p=>p.background===color);backgrounds.append(option(p?.key||'unavailable-'+color,backgroundNames[color]+(!p?' — تحتاج طلب تخصيص':!p.inStock?' — غير متوفرة مرجعيًا':''),!p||!p.inStock));});backgrounds.value=state.tankKey;
    backgrounds.addEventListener('change',()=>{state.tankKey=backgrounds.value;changed({rebuild:true,focus:'kit-background',resetOverrides:false});});
    const silicone=make('select');silicone.append(option('factory','لون المصنع — غير موثّق في بيانات هذا المنتج'));silicone.disabled=true;
    const pair=make('div','kit-inline-fields');pair.append(field('خلفية الحوض','kit-background',backgrounds),field('لون السيلكون','kit-silicone',silicone));$('kit-panel').append(pair);
    $('kit-panel').append(make('p','kit-field-small','الخلفية البيضاء ولون السيلكون حسب طلبك يحتاجان تأكيد تصنيع وتسعير منفصل؛ لا نغيّر مواصفات منتج جاهز بدون توثيق.'));
    const custom=make('a','kit-custom-request','اطلب مقاسًا أو لون سيلكون خاصًا');custom.href=pageUrl('services/#service-brief');$('kit-panel').append(custom,...productDetail(current),facts(current));
    const snapshot=calculateKit(state,catalog);$('kit-panel').append(make('p','kit-note','سعة حوضك الاسمية '+decimal(snapshot.volumeLitres)+' لتر. في كل خطوة ستجد الخيارات ذات النطاق الموثق أولًا، مع بقية المنتجات متاحة للمراجعة.'));
  }
  function renderSubstrate(){
    heading('اختَر عبواتك، وشاهد ارتفاعها.','ابدأ بالنوع وعدد العبوات، ثم وزّعها على مساحة الحوض. الارتفاع يُحسب عندما يكون حجم العبوة باللتر موثقًا.');
    const soil=selector(available('soil'),state.soil.key,'بدون تربة زراعية');soil.addEventListener('change',()=>{state.soil.key=soil.value||null;activeGuide='soil';changed({rebuild:true,focus:'kit-soil',resetOverrides:false});});
    $('kit-panel').append(field('التربة الزراعية تحت الأرضية','kit-soil',soil));
    if(state.soil.key){
      const packs=numberInput(state.soil.packs);packs.inputMode='numeric';packs.addEventListener('input',()=>{state.soil.packs=numeric(packs);activeGuide='soil';changed({resetOverrides:false});});packs.addEventListener('focus',()=>{activeGuide='soil';refresh();});
      $('kit-panel').append(field('عدد عبوات التربة','kit-soil-packs',packs),make('p','kit-zone-amount',''));
      $('kit-panel').lastElementChild.id='kit-soil-amount';$('kit-panel').append(...productDetail(byKey.get(state.soil.key)),facts(byKey.get(state.soil.key)));
    }
    const top=make('div','kit-subsection');top.append(make('h3','','الرمل والحصى: النوع ثم العدد'));
    const unique=[...new Set(state.zones.map(z=>z.key))];
    state.zones.forEach((zone,index)=>{
      const section=make('section','kit-zone'),head=make('div','kit-zone-heading');head.append(make('h4','',`المنطقة ${decimal(index+1)}`));
      const remove=make('button','kit-text-button','حذف المنطقة');remove.type='button';remove.setAttribute('aria-label',`حذف المنطقة ${decimal(index+1)}`);remove.addEventListener('click',()=>{state.zones.splice(index,1);rebalanceZones();distributeAllocation();activeGuide=0;changed({rebuild:true,focus:'kit-add-zone',resetOverrides:false});});head.append(remove);section.append(head);
      const product=selector(available('substrate'),zone.key);product.addEventListener('change',()=>{zone.key=product.value;state.substratePacks[zone.key]??=1;distributeAllocation();activeGuide=index;changed({rebuild:true,focus:'kit-zone-product-'+index,resetOverrides:false});});section.append(field('نوع الأرضية',`kit-zone-product-${index}`,product));
      if(state.zones.findIndex(z=>z.key===zone.key)===index){const p=byKey.get(zone.key),bulk=p.ownerBulkEligible&&p.packKg,quantity=numberInput(bulk?(state.bulkWeightsKg?.[zone.key]??(numberValue(state.substratePacks[zone.key])||1)*p.packKg):(state.substratePacks[zone.key]??1));quantity.inputMode=bulk?'decimal':'numeric';quantity.addEventListener('input',()=>{if(bulk){state.bulkWeightsKg??={};state.bulkWeightsKg[zone.key]=numeric(quantity);}else state.substratePacks[zone.key]=numeric(quantity);activeGuide=index;changed({resetOverrides:false});});quantity.addEventListener('focus',()=>{activeGuide=index;refresh();});section.append(field(bulk?'الوزن المطلوب (كجم)':'عدد عبوات هذا النوع',(bulk?'kit-weight-':'kit-packs-')+zone.key,quantity,bulk?'نصف كيلو ومضاعفاته، مثل ١٫٥ كجم. سعر الكيلو المرجعي: '+money(Math.round(p.price/p.packKg*100))+'؛ يُوزّع الوزن نفسه بين مناطق هذا النوع.':'عدد واحد للتجميعة؛ إذا تكرر النوع نوزّع نفس العبوات بين مناطقه.'));}
      const share=numberInput(zone.share);share.addEventListener('input',()=>{zone.share=numeric(share);activeGuide=index;changed({resetOverrides:false});});share.addEventListener('focus',()=>{activeGuide=index;refresh();});section.append(field('حصة هذه المنطقة من أرضية الحوض (%)',`kit-zone-share-${index}`,share));
      if(state.zones.filter(z=>z.key===zone.key).length>1){const allocation=numberInput(zone.allocation);allocation.addEventListener('input',()=>{zone.allocation=numeric(allocation);activeGuide=index;changed({resetOverrides:false});});section.append(field('حصة المنطقة من عبوات هذا النوع (%)',`kit-zone-allocation-${index}`,allocation,'مجموع توزيع عبوات النوع نفسه يجب أن يساوي ١٠٠٪.'));}
      const amount=make('p','kit-zone-amount');amount.id=`kit-zone-amount-${index}`;section.append(amount,facts(byKey.get(zone.key)));top.append(section);
    });
    const addRow=make('div','kit-zone-add'),add=make('button','kit-secondary','أضف نوع أرضية');add.type='button';add.id='kit-add-zone';add.disabled=state.zones.length>=3;
    add.addEventListener('click',()=>{const items=available('substrate');if(state.zones.length>=3||!items.length)return;const selected=items.find(p=>!state.zones.some(z=>z.key===p.key))||items[0];state.zones.push({id:'zone-'+(state.zones.length+1),key:selected.key,share:0,allocation:100});state.substratePacks[selected.key]??=1;rebalanceZones();distributeAllocation();activeGuide=state.zones.length-1;changed({rebuild:true,focus:'kit-zone-product-'+(state.zones.length-1),resetOverrides:false});});
    const total=make('span','kit-share-total');total.id='kit-share-total';addRow.append(add,total);top.append(addRow,make('p','kit-field-small','حتى ثلاث مناطق. إضافة منطقة أو حذفها يعيد توزيع المساحة بالتساوي، ويمكنك تعديل النسب بعدها.'));$('kit-panel').append(top);
    const estimate=make('details','kit-catalog-coverage'),summary=make('summary','','كيف نحسب الارتفاع من الوزن؟');estimate.append(summary,make('p','kit-field-small','للرمل والحصى الكثيف نعرض تقديرًا مرجعيًا بكثافة ١٫٦٥ كجم/لتر، ضمن نطاق ١٫٦–١٫٧. الارتفاع = الوزن ÷ الكثافة ÷ مساحة المنطقة × ١٠٠٠. هذا افتراض تخطيطي، وليس قياسًا لمنتجك؛ سماكة الزجاج والتنسيق يؤثران في النتيجة. المواد البركانية والمختلفة لا تُحوّل تلقائيًا.'));const source=make('a','','طريقة الحساب ومرجع الكثافة من سيرا');source.href='https://www.sera.de/en/service/faq/faq-detail/sand-and-gravel-in-combination-how-much-sand-is-required/';source.target='_blank';source.rel='noopener noreferrer';estimate.append(source);$('kit-panel').append(estimate);
  }
  function rebalanceZones(){const length=state.zones.length;if(!length)return;state.zones.forEach((zone,i)=>{zone.id=`zone-${i+1}`;zone.share=i===length-1?100-Math.floor(100/length)*(length-1):Math.floor(100/length);});}
  function renderEquipment(role){
    heading(role==='light'?'إضاءة تناسب طريقة تنسيقك.':'غذاء يناسب الكائنات التي ستربيها.',role==='light'?'نقدّم نطاقات التثبيت الموثقة أولًا؛ احتياج النباتات يعتمد أيضًا على نوعها وعمق الحوض.':'مقاس الحوض وحده لا يحدد الغذاء. اختر غذاء الكائن الصحيح، أو أكمل دون عبوة جديدة.');
    let choices=null;
    if(role==='food'){
      const targets={community:'أسماك مجتمعية',bottom:'أسماك القاع',shrimp:'شرمب',betta:'فايتر',guppy:'جوبي',cichlid:'سيكلد',fry:'صغار الأسماك',koi:'كوي',goldfish:'سمك ذهبي',crab:'سرطانات مائية'},target=make('select');target.append(option('all','كل الأنواع — راجع النوع المناسب لك'));for(const key of new Set(catalog.items.filter(p=>p.role==='food').flatMap(p=>p.foodFor||[])))target.append(option(key,targets[key]||'نوع آخر حسب وصف المنتج'));target.value=foodView;
      target.addEventListener('change',()=>{foodView=target.value;if(state.foodKey&&foodView!=='all'&&!byKey.get(state.foodKey).foodFor?.includes(foodView))state.foodKey=null;changed({rebuild:true,focus:'kit-food-target',resetOverrides:false});});$('kit-panel').append(field('الكائن الذي تريد إطعامه','kit-food-target',target,'الترشيح حسب الأنواع المذكورة في وصف المنتج؛ الغذاء التكميلي لا يصبح غذاءً أساسيًا تلقائيًا.'));choices=catalog.items.filter(p=>p.role==='food'&&(foodView==='all'||p.foodFor?.includes(foodView)));
    }
    const select=productPicker(role,state[role+'Key'],key=>{state[role+'Key']=key;changed({rebuild:true,focus:'kit-'+role,resetOverrides:false});},{items:choices});$('kit-panel').append(field(role==='light'?'اختر الإضاءة':'اختر الغذاء','kit-'+role,select));
    if(state[role+'Key']){const p=byKey.get(state[role+'Key']);$('kit-panel').append(...productDetail(p),facts(p));}
    if(role==='light'){
      const group=recommendations(catalog,role,state).recommended.filter(p=>p.inStock).sort((a,b)=>a.price-b.price);
      if(group.length){const b=make('button','kit-secondary','اختَر أقل إضاءة سعرًا ضمن نطاق التثبيت');b.type='button';b.addEventListener('click',()=>{state.lightKey=group[0].key;changed({rebuild:true,focus:'kit-light',resetOverrides:false});});$('kit-panel').append(b);}
    }
  }
  function renderReview(){
    heading('تجميعتك جاهزة للمراجعة.','كل منتج وعدده وسعره أمامك. راجع أيضًا القطع التي عندك والتوصيلات التي تحتاج تأكيدًا.');
    const kit=calculateKit(state,catalog),list=make('div','kit-review-list');list.setAttribute('role','list');
    kit.lines.forEach(line=>{
      const row=make('article','kit-review-item');row.setAttribute('role','listitem');const body=make('div');body.append(make('h3','',line.product.name),make('p','',line.weightKg?decimal(line.weightKg)+' كجم × '+money(line.pricePerKgMinor)+' للكيلو':money(line.unitMinor)+' للعبوة'));
      const total=make('p','kit-review-line-total',line.totalMinor===null?'راجع العدد':money(line.totalMinor));total.id='kit-line-total-'+line.key;body.append(total);
      const quantity=make('label','kit-review-quantity',line.weightKg?'حصة موزونة':'العدد'),input=numberInput(line.quantity??'');input.id='kit-quantity-'+line.key;input.inputMode='numeric';input.setAttribute('aria-label','عدد '+line.product.name);
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
    const soil=$('kit-soil-fill'),soilDepth=g.soilDepthCm;soil.hidden=!state.soil.key;soil.style.setProperty('--kit-fill',String(soilDepth===null?.035:Math.min(1,soilDepth/dims.height)));soil.classList.toggle('is-unmeasured',!!state.soil.key&&soilDepth===null);
    const fillHost=$('kit-zone-fills'),plan=$('kit-plan');while(fillHost.children.length>state.zones.length)fillHost.lastElementChild.remove();plan.replaceChildren();let left=0;
    g.zones.forEach((zone,index)=>{
      const source=state.zones[index],share=Math.max(0,Math.min(100,numberValue(source.share)||0));let fill=fillHost.children[index];if(!fill){fill=make('div','kit-zone-fill');fillHost.append(fill);}fill.style.left=left+'%';fill.style.width=Math.min(share,100-left)+'%';fill.style.bottom=soilDepth===null?'3.5%':Math.min(100,(soilDepth||0)/dims.height*100)+'%';fill.style.setProperty('--kit-fill',String(zone.depthCm===null?.065:Math.min(1,Math.max(0,zone.depthCm)/dims.height)));fill.dataset.tone=materialTone(source.key);fill.classList.toggle('is-unmeasured',zone.depthCm===null);fill.style.backgroundImage='none';
      const patch=make('span','',`${decimal(index+1)} · ${decimal(share)}٪`);patch.style.width=share+'%';patch.dataset.tone=materialTone(source.key);patch.title=byKey.get(source.key).name;plan.append(patch);left+=share;
      const amount=$('kit-zone-amount-'+index);if(amount)amount.textContent=zone.depthCm===null?'ارتفاع هذا النوع غير موثق؛ لا توجد تغطية أو كثافة مرجعية مناسبة له.':`${zone.estimated?'تقدير مرجعي، غير مقاس للمنتج: ':''}حجم موزّع ${decimal(zone.litres)} لتر · ارتفاع ${decimal(zone.depthCm)} سم${zone.totalDepthCm!==null?' · إجمالي الطبقات '+decimal(zone.totalDepthCm)+' سم':''}`;
    });
    const soilAmount=$('kit-soil-amount');if(soilAmount)soilAmount.textContent=soilDepth===null?'ارتفاع التربة غير محدد دون تغطية موثقة.':`${decimal(numberValue(state.soil.packs)||0)} عبوة · ارتفاع تقريبي ${decimal(soilDepth)} سم على كامل أرضية الحوض`;
    const sum=state.zones.reduce((n,z)=>n+(numberValue(z.share)||0),0),shareTotal=$('kit-share-total');if(shareTotal){shareTotal.textContent='مجموع المساحة: '+decimal(sum)+'٪';shareTotal.classList.toggle('is-invalid',state.zones.length>0&&Math.abs(sum-100)>.01);}plan.hidden=!state.zones.length;
    const active=g.zones[typeof activeGuide==='number'?activeGuide:0],level=activeGuide==='soil'&&state.soil.key?soilDepth:active?.totalDepthCm;$('kit-height-guide').classList.toggle('is-high',(level||0)/dims.height>.65);
    $('kit-height-guide').hidden=level===null||level===undefined||level<=0;$('kit-height-guide').style.setProperty('--kit-guide',String(Math.max(0,Math.min(1,(level||0)/dims.height))));$('kit-guide-label').textContent=(activeGuide==='soil'?'التربة ':active?.estimated?'نحو ':'السطح ')+decimal(level||0)+' سم';
    $('kit-preview-caption').textContent=g.hasEstimates?'الارتفاع تقدير مرجعي بكثافة رمل وحصى كثيف، وليس قياسًا للمنتج.':g.allKnown?'ارتفاعات تقريبية من الأبعاد الاسمية وحجم العبوات. ليست مخطط تصنيع.':'المناطق ذات الخط المتقطع توضيحية فقط؛ لا تعبّر عن ارتفاع حتى يوثّق حجم العبوة.';
    $('kit-cross-section').setAttribute('aria-label','حوض '+dims.length+' في '+dims.width+' في '+dims.height+' سم. '+(g.allKnown?'ارتفاعات محسوبة من العبوات.':'بعض ارتفاعات الأرضيات غير موثقة.'));
    renderSystemDiagram();
  }
  function paintErrors(errors,focus){
    root.querySelectorAll('[aria-invalid=true]').forEach(el=>el.removeAttribute('aria-invalid'));root.querySelectorAll('.kit-field-error').forEach(el=>{el.hidden=true;el.textContent='';});
    errors.forEach(error=>{const input=$(error.field),description=$(error.field+'-error');if(input)input.setAttribute('aria-invalid','true');if(description){description.textContent=error.message;description.hidden=false;}});
    if(errors.length){announce(errors[0].message);if(focus){const first=errors[0];if(first.step!==state.step){state.step=first.step;renderPanel();refresh();paintErrors(errors,false);}const fallback=first.field.startsWith('kit-equipment-')?$('kit-owned-'+first.field.slice(14)):null;($(first.field)||fallback||$('kit-step-title'))?.focus();}}
  }
  function goStep(next){
    if(cartBusy)return;
    if(next>state.step){const errors=validateState(state,catalog,next-1).errors;if(errors.length){paintErrors(errors,true);return;}}
    state.step=next;renderPanel();refresh();remember();$('kit-step-title').focus();
  }
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
      $('kit-app').hidden=false;$('kit-loading').hidden=true;renderPanel();refresh();ready=true;
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
