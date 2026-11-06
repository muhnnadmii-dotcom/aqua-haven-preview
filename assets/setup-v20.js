import {SETUP_STORAGE_KEY,KIT_LIST_KEY,checkedCatalog,initialState,restorableState,numberValue,validateState,calculateKit,buildCartPayload} from './setup-v20-core.mjs?v=20';

const root=document.querySelector('[data-kit-builder]');
if(root)boot(root);
function boot(root){
  const $=id=>root.querySelector('#'+id),make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const money=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(n/100)+' ر.س';
  const decimal=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(n);
  const labels=['الحوض والزجاج','الأرضية','الفلتر','الإضاءة','الغذاء','المراجعة'];
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
    row.append(image(p),body);const notes=make('ul','kit-product-notes');(p.notes||[]).slice(0,4).forEach(text=>notes.append(make('li','',text)));return [row,notes];
  }
  function renderPanel(){
    if(state.step===1&&previousPanel!==1&&matchMedia('(max-width:760px)').matches){root.classList.add('is-preview-compact');$('kit-compact').textContent='تكبير المعاينة';$('kit-compact').setAttribute('aria-expanded','false');}
    previousPanel=state.step;
    $('kit-panel').replaceChildren();$('kit-form-status').textContent='';root.dataset.step=String(state.step);
    root.querySelectorAll('[data-kit-step]').forEach(button=>{if(Number(button.dataset.kitStep)===state.step)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});
    $('kit-back').hidden=state.step===0;$('kit-next').hidden=state.step===5;
    $('kit-next').firstChild.textContent=state.step<4?'إلى '+labels[state.step+1]+' ':'راجع التجميعة ';
    if(state.step===0)renderTank();else if(state.step===1)renderSubstrate();else if(state.step===5)renderReview();else renderEquipment(['','','filter','light','food'][state.step]);
  }
  function renderTank(){
    heading('ابدأ بالحوض الزجاجي.','مقاسات جاهزة من المتجر؛ التجهيزات تختارها في الخطوات التالية.');
    const select=selector(available('tank'),state.tankKey);select.addEventListener('change',()=>{state.tankKey=select.value;changed({rebuild:true,focus:'kit-tank'});});
    $('kit-panel').append(field('المقاس الجاهز','kit-tank',select,'الأبعاد بالترتيب: الطول × العمق × الارتفاع.'));
    $('kit-panel').append(...productDetail(byKey.get(state.tankKey)));
    $('kit-panel').append(make('p','kit-note','الخيارات هنا أحواض زجاجية فارغة بخلفية شفافة كما في الكتالوج. المقاس الخاص والتصنيع لهما مسار تسعير منفصل.'));
  }
  function renderSubstrate(){
    heading('وزّع أرضيتك، طبقة بطبقة.','تربة زراعية اختيارية تحت الأرضية، ورمل أو حصى في مناطق تختار مساحتها وارتفاعها.');
    const soil=selector(available('soil'),state.soil.key,'بدون تربة زراعية');soil.addEventListener('change',()=>{state.soil.key=soil.value||null;activeGuide='soil';changed({rebuild:true,focus:'kit-soil'});});
    $('kit-panel').append(field('طبقة التربة الزراعية','kit-soil',soil));
    if(state.soil.key){
      const depth=numberInput(state.soil.depthCm);depth.addEventListener('input',()=>{state.soil.depthCm=numeric(depth);activeGuide='soil';changed();});depth.addEventListener('focus',()=>{activeGuide='soil';refresh();});
      const range=make('input');range.type='range';range.id='kit-soil-range';range.min='.5';range.max='12';range.step='.5';range.value=numberValue(state.soil.depthCm)||2;range.setAttribute('aria-label','ارتفاع التربة الزراعية بالسنتيمتر');range.addEventListener('input',()=>{state.soil.depthCm=Number(range.value);depth.value=range.value;activeGuide='soil';changed();});
      $('kit-panel').append(field('ارتفاع التربة الزراعية (سم)','kit-soil-depth',depth),range);
      const amount=make('p','kit-zone-amount');amount.id='kit-soil-amount';$('kit-panel').append(amount);
    }
    const top=make('div','kit-subsection');top.append(make('h3','','طبقة الرمل والحصى'));
    if(!state.zones.length)top.append(make('p','kit-field-small','بدون طبقة تشطيب حاليًا. أضف أرضية إذا رغبت.'));
    state.zones.forEach((zone,index)=>{
      const section=make('section','kit-zone'),head=make('div','kit-zone-heading');
      head.append(make('h4','',`المنطقة ${decimal(index+1)}`));
      const remove=make('button','kit-text-button','حذف المنطقة');remove.type='button';remove.setAttribute('aria-label',`حذف المنطقة ${decimal(index+1)}`);remove.addEventListener('click',()=>{state.zones.splice(index,1);rebalanceZones();activeGuide=0;changed({rebuild:true,focus:'kit-add-zone'});});head.append(remove);section.append(head);
      const controls=make('div','kit-zone-controls'),product=selector(available('substrate'),zone.key);
      product.addEventListener('change',()=>{zone.key=product.value;activeGuide=index;changed({rebuild:true,focus:`kit-zone-product-${index}`});});product.addEventListener('focus',()=>{activeGuide=index;refresh();});
      const share=numberInput(zone.share);share.inputMode='decimal';share.addEventListener('input',()=>{zone.share=numeric(share);activeGuide=index;changed();});share.addEventListener('focus',()=>{activeGuide=index;refresh();});
      const depth=numberInput(zone.depthCm);depth.addEventListener('input',()=>{zone.depthCm=numeric(depth);activeGuide=index;changed();});depth.addEventListener('focus',()=>{activeGuide=index;refresh();});
      controls.append(field('نوع الأرضية',`kit-zone-product-${index}`,product),field('من المساحة (%)',`kit-zone-share-${index}`,share),field('ارتفاعها (سم)',`kit-zone-depth-${index}`,depth));
      const range=make('input');range.type='range';range.min='.5';range.max='20';range.step='.5';range.value=numberValue(zone.depthCm)||4;range.id=`kit-zone-range-${index}`;range.setAttribute('aria-label',`ارتفاع أرضية المنطقة ${decimal(index+1)} بالسنتيمتر`);range.addEventListener('input',()=>{zone.depthCm=Number(range.value);depth.value=range.value;activeGuide=index;changed();});
      const amount=make('p','kit-zone-amount');amount.id=`kit-zone-amount-${index}`;section.append(controls,range,amount);top.append(section);
    });
    const addRow=make('div','kit-zone-add'),add=make('button','kit-secondary','أضف نوع أرضية');add.type='button';add.id='kit-add-zone';add.disabled=state.zones.length>=3;
    add.addEventListener('click',()=>{if(state.zones.length>=3)return;const products=available('substrate');state.zones.push({id:`zone-${state.zones.length+1}`,key:products[state.zones.length%products.length].key,share:0,depthCm:4});rebalanceZones();activeGuide=state.zones.length-1;changed({rebuild:true,focus:`kit-zone-product-${state.zones.length-1}`});});
    const total=make('span','kit-share-total');total.id='kit-share-total';addRow.append(add,total);top.append(addRow,make('p','kit-field-small','إضافة أو حذف منطقة يعيد توزيع المساحة بالتساوي؛ عدّل النسب بعدها كما تريد. حتى ثلاثة أنواع.'));$('kit-panel').append(top);
    const manualKeys=[...new Set(state.zones.map(z=>z.key))].filter(key=>!byKey.get(key).packLitres);
    if(manualKeys.length){
      const manual=make('section','kit-manual-packs');manual.append(make('h3','','كم عبوة تريد من كل نوع؟'),make('p','kit-field-small','نحسب احتياج الأرضية باللتر. حجم تغطية العبوات المباعة بالوزن غير موثق؛ حدّد عددها يدويًا.'));
      manualKeys.forEach(key=>{const p=byKey.get(key),input=numberInput(state.manualPacks[key]);input.inputMode='numeric';input.placeholder='العدد';input.addEventListener('input',()=>{state.manualPacks[key]=numeric(input);changed();});manual.append(field(p.name,'kit-manual-'+key,input));});$('kit-panel').append(manual);
    }
    $('kit-panel').append(make('p','kit-note','حساب تقريبي بالأبعاد الاسمية؛ الكمية الفعلية تتأثر بالتنسيق والأبعاد الداخلية. طريقة ترتيب طبقات التربة تعتمد على المنتج المختار.'));
  }
  function rebalanceZones(){const length=state.zones.length;if(!length)return;state.zones.forEach((zone,i)=>{zone.id=`zone-${i+1}`;zone.share=i===length-1?100-Math.floor(100/length)*(length-1):Math.floor(100/length);});}
  function renderEquipment(role){
    const content={filter:['اختر الفلتر.','قارن التدفق المعلن ومواصفات المنتج. يمكنك المتابعة بدون إضافة فلتر.'],light:['اختر الإضاءة.','اعتمد نطاق مقاس الحوض الموثق إن وُجد. نطاق التثبيت غير المعروف يحتاج مراجعة.'],food:['اختر الغذاء المناسب.','اختر بحسب الكائنات التي ستربيها. يمكنك تأجيل الغذاء والمتابعة بدونه.']}[role];heading(...content);
    const fieldset=make('fieldset','kit-product-options');fieldset.id='kit-'+role;fieldset.tabIndex=-1;fieldset.setAttribute('aria-label',content[0]);fieldset.setAttribute('aria-describedby','kit-'+role+'-error');
    const addChoice=(p)=>{
      const label=make('label','kit-product-option'+(!p?' is-none':'')),input=make('input');input.type='radio';input.name='kit-'+role;input.value=p?.key||'';input.checked=(state[role+'Key']||'')===input.value;
      if(input.checked)label.classList.add('is-selected');const body=make('span');body.append(make('strong','',p?p.name:'أتابع بدون '+({filter:'فلتر',light:'إضاءة',food:'غذاء'}[role])));
      if(p){body.append(make('small','',money(Math.round(p.price*100))));
        if(p.flowLph)body.append(make('small','',`التدفق المعلن: ${decimal(p.flowLph)} لتر/ساعة`));
        if(p.fitTankLengthCm)body.append(make('small','',`نطاق طول الحوض الموثق: ${decimal(p.fitTankLengthCm.min)}–${decimal(p.fitTankLengthCm.max)} سم`));
        (p.notes||[]).slice(0,2).forEach(note=>body.append(make('small','',note)));
      }
      input.addEventListener('change',()=>{state[role+'Key']=input.value||null;fieldset.querySelectorAll('label').forEach(l=>l.classList.toggle('is-selected',l.querySelector('input').checked));changed();refreshEquipmentWarning(role);});
      label.append(input);if(p)label.append(image(p));label.append(body);fieldset.append(label);
    };
    addChoice(null);available(role).forEach(addChoice);$('kit-panel').append(fieldset,errorGroup('kit-'+role));
    const warning=make('p','kit-note kit-selected-warning');warning.id='kit-equipment-warning';$('kit-panel').append(warning);refreshEquipmentWarning(role);
  }
  function refreshEquipmentWarning(role){
    const p=byKey.get(state[role+'Key']),warning=$('kit-equipment-warning');if(!warning)return;
    warning.hidden=!p;if(!p)return;
    if(role==='filter')warning.textContent='التدفق المعلن لا يكفي وحده لتأكيد التوافق؛ راجع احتياج الكائنات وطريقة تركيب الفلتر.';
    else if(role==='light'){
      const fit=p.fitTankLengthCm,length=byKey.get(state.tankKey).dimensions.length;
      warning.classList.toggle('kit-note-warning',!fit||length<fit.min||length>fit.max);
      warning.textContent=fit?(length>=fit.min&&length<=fit.max?'طول حوضك يقع ضمن نطاق التثبيت الموثق. احتياج النباتات للإضاءة يحتاج مراجعة مستقلة.':'طول حوضك خارج نطاق التثبيت الموثق لهذه الإضاءة. اختر أخرى قبل المتابعة.'):'نطاق طول الحوض المناسب لهذه الإضاءة غير موثق. يلزم التحقق من التثبيت قبل الشراء.';
    }else warning.textContent='نوع الغذاء مرتبط بالكائنات التي تختار تربيتها، وليس بمقاس الحوض. راجع تعليمات المنتج.';
  }
  function renderReview(){
    heading('تجميعتك، قطعة بقطعة.','راجع المنتجات والكميات. يمكنك الرجوع لأي خطوة لتغيير توزيع الحوض أو تجهيزاته.');
    const kit=calculateKit(state,catalog),list=make('div','kit-review-list');list.setAttribute('role','list');
    kit.lines.forEach(line=>{
      const row=make('article','kit-review-item');row.setAttribute('role','listitem');const body=make('div'),title=make('h3','',line.product.name);title.id='kit-review-name-'+line.key;
      body.append(title,make('p','',`للعبوة: ${money(line.unitMinor)}`));if(line.requiredLitres)body.append(make('p','',`الاحتياج الحجمي: ${decimal(line.requiredLitres)} لتر${line.manual?' · العدد تحدّده يدويًا':''}`));
      const total=make('p','kit-review-line-total',line.totalMinor===null?'حدّد العدد':money(line.totalMinor));total.id='kit-line-total-'+line.key;body.append(total);
      const quantity=make('label','kit-review-quantity','العدد'),input=numberInput(state.quantityOverrides[line.key]??line.quantity??'');input.id='kit-quantity-'+line.key;input.inputMode='numeric';input.setAttribute('aria-label','عدد عبوات '+line.product.name);input.setAttribute('aria-describedby',input.id+'-error');if(line.product.role==='tank'){input.value='1';input.readOnly=true;input.setAttribute('aria-label','حوض واحد لهذه التجميعة');}else input.addEventListener('input',()=>{state.quantityOverrides[line.key]=numeric(input);changed({resetOverrides:false});updateReviewTotals();});quantity.append(input);
      row.append(image(line.product),body,quantity,errorGroup(input.id));
      const note=make('p','kit-review-note');note.id='kit-under-'+line.key;note.hidden=!line.underRequired;note.textContent='العدد المختار يغطي حجمًا أقل من الأرضية المرسومة.';row.append(note);list.append(row);
    });
    const total=make('div','kit-review-total');total.append(make('span','','مجموع المنتجات المرجعي'));const totalNumber=make('strong','',money(kit.totalMinor));totalNumber.id='kit-review-total';total.append(totalNumber);
    $('kit-panel').append(list,total,make('p','kit-field-small',runtime?'يُراجع السعر والتوفر من WooCommerce عند الإضافة. لا تتضمن هذه الخطوة إرسال طلب أو دفع.':'الأسعار والتوفر مرجعيان. هذه قائمة تجهيز تجريبية في متصفحك، وليست سلة شراء متصلة بالمتجر.'));
    if(kit.warnings.length){const notes=make('ul','kit-product-notes');kit.warnings.forEach(note=>notes.append(make('li','',note)));$('kit-panel').append(notes);}
    const actions=make('div','kit-review-actions'),finish=make('button','kit-primary',runtime?'أضف التجميعة إلى السلة':'احفظ قائمة التجهيز');finish.type='button';finish.id='kit-finish';finish.addEventListener('click',finishKit);
    const copy=make('button','kit-secondary','انسخ الملخص');copy.type='button';copy.addEventListener('click',copySummary);actions.append(finish,copy);$('kit-panel').append(actions);
    const fallback=make('div','kit-copy-fallback');fallback.id='kit-copy-fallback';fallback.hidden=true;const label=make('label','','حدّد الملخص وانسخه يدويًا.');label.htmlFor='kit-copy-text';const text=make('textarea');text.id='kit-copy-text';text.readOnly=true;text.rows=8;fallback.append(label,text);$('kit-panel').append(fallback);
  }
  function updateReviewTotals(){const kit=calculateKit(state,catalog);$('kit-review-total').textContent=money(kit.totalMinor);kit.lines.forEach(line=>{const total=$('kit-line-total-'+line.key);if(total)total.textContent=line.totalMinor===null?'حدّد العدد':money(line.totalMinor);const note=$('kit-under-'+line.key);if(note)note.hidden=!line.underRequired;});}
  function materialTone(key){return key.includes('black')?'black':key.includes('volcanic')?'volcanic':key.includes('gold')?'gold':'sand';}
  function refresh(){
    const tank=byKey.get(state.tankKey),dims=tank.dimensions,kit=calculateKit(state,catalog),baseDepth=state.soil.key?(numberValue(state.soil.depthCm)||0):0;
    $('kit-tank-frame').style.setProperty('--kit-ratio',String(dims.length/dims.height));
    $('kit-preview-dimensions').textContent=`${dims.length} × ${dims.width} × ${dims.height} سم`;$('kit-preview-length').textContent=`الطول ${decimal(dims.length)} سم`;$('kit-preview-volume').textContent=`${decimal(kit.volumeLitres)} لتر اسميًا`;
    $('kit-preview-substrate').textContent=decimal(kit.substrateVolume)+' لتر';$('kit-preview-total').textContent=money(kit.totalMinor);
    $('kit-cross-section').setAttribute('aria-label',`حوض ${dims.length} في ${dims.width} في ${dims.height} سنتيمتر. ${state.soil.key?'طبقة تربة '+decimal(baseDepth)+' سم. ':''}${state.zones.map((z,i)=>'المنطقة '+decimal(i+1)+' '+decimal(numberValue(z.share)||0)+' بالمئة، ارتفاع '+decimal(numberValue(z.depthCm)||0)+' سم').join('. ')}`);
    const soil=$('kit-soil-fill');soil.hidden=!state.soil.key;soil.style.setProperty('--kit-fill',String(Math.min(1,baseDepth/dims.height)));
    const grainTexture=byKey.get('sand-white-1kg')||available('substrate')[0];
    if(state.soil.key)soil.style.backgroundImage=`url("${asset(grainTexture)}")`;
    const fillHost=$('kit-zone-fills'),plan=$('kit-plan');while(fillHost.children.length>state.zones.length)fillHost.lastElementChild.remove();plan.replaceChildren();let left=0;
    state.zones.forEach((zone,index)=>{
      const share=Math.max(0,Math.min(100,numberValue(zone.share)||0)),depth=Math.max(0,numberValue(zone.depthCm)||0),product=byKey.get(zone.key);let fill=fillHost.children[index];if(!fill){fill=make('div','kit-zone-fill');fillHost.append(fill);}
      fill.style.left=left+'%';fill.style.width=Math.min(share,Math.max(0,100-left))+'%';fill.style.bottom=Math.min(100,baseDepth/dims.height*100)+'%';fill.style.setProperty('--kit-fill',String(Math.min(1,depth/dims.height)));fill.style.backgroundImage=`url("${asset(grainTexture)}")`;fill.dataset.tone=materialTone(zone.key);
      const patch=make('span','',`${decimal(index+1)} · ${decimal(share)}٪`);patch.style.width=Math.min(share,Math.max(0,100-left))+'%';patch.dataset.tone=materialTone(zone.key);patch.title=product.name;plan.append(patch);left+=share;
      const volume=dims.length*dims.width*share/100*depth/1000,amount=$('kit-zone-amount-'+index);if(amount)amount.textContent=`حجم المنطقة التقريبي: ${decimal(volume)} لتر`;
      const range=$('kit-zone-range-'+index);if(range&&document.activeElement!==range&&numberValue(zone.depthCm)!==null)range.value=String(zone.depthCm);
    });
    const soilRange=$('kit-soil-range');if(soilRange&&document.activeElement!==soilRange&&numberValue(state.soil.depthCm)!==null)soilRange.value=String(state.soil.depthCm);
    const soilAmount=$('kit-soil-amount');if(soilAmount){const line=kit.lines.find(l=>l.key===state.soil.key);soilAmount.textContent=line?`احتياج التربة: ${decimal(line.requiredLitres)} لتر · ${decimal(line.autoQuantity)} عبوة بحجم ${decimal(line.product.packLitres)} لتر`:'—';}
    const total=$('kit-share-total');if(total){const sum=state.zones.reduce((n,z)=>n+(numberValue(z.share)||0),0);total.textContent='مجموع المساحة: '+decimal(sum)+'٪';total.classList.toggle('is-invalid',state.zones.length>0&&Math.abs(sum-100)>.01);}
    plan.hidden=!state.zones.length;
    const zone=state.zones[typeof activeGuide==='number'?activeGuide:0];
    const level=activeGuide==='soil'&&state.soil.key?baseDepth:zone?baseDepth+(numberValue(zone.depthCm)||0):baseDepth;
    $('kit-height-guide').style.setProperty('--kit-guide',String(Math.max(0,Math.min(1,level/dims.height))));
    $('kit-guide-label').textContent=(activeGuide==='soil'&&state.soil.key?'التربة ':'السطح ')+decimal(level)+' سم';$('kit-height-guide').hidden=level===0;
  }
  function paintErrors(errors,focus){
    root.querySelectorAll('[aria-invalid=true]').forEach(el=>el.removeAttribute('aria-invalid'));root.querySelectorAll('.kit-field-error').forEach(el=>{el.hidden=true;el.textContent='';});
    errors.forEach(error=>{const input=$(error.field),description=$(error.field+'-error');if(input)input.setAttribute('aria-invalid','true');if(description){description.textContent=error.message;description.hidden=false;}});
    if(errors.length){announce(errors[0].message);if(focus){const first=errors[0];if(first.step!==state.step){state.step=first.step;renderPanel();refresh();paintErrors(errors,false);}$(first.field)?.focus();}}
  }
  function goStep(next){
    if(cartBusy)return;
    if(next>state.step){const errors=validateState(state,catalog,next-1).errors;if(errors.length){paintErrors(errors,true);return;}}
    state.step=next;renderPanel();refresh();remember();$('kit-step-title').focus();
  }
  function summary(){const kit=calculateKit(state,catalog),tank=byKey.get(state.tankKey);return ['أكوا هافن — قائمة تجهيز الحوض',`المقاس: ${tank.dimensions.length} × ${tank.dimensions.width} × ${tank.dimensions.height} سم`,...kit.lines.map(l=>`${l.product.name} — ${l.quantity??'العدد غير محدد'} × ${money(l.unitMinor)}${l.requiredLitres?' · الاحتياج الحجمي '+decimal(l.requiredLitres)+' لتر':''}`),`المجموع المرجعي: ${money(kit.totalMinor)}`,'الأسعار والتوفر مرجعيان؛ القياسات اسميّة والكميات الحجمية تقريبية.'].join('\n');}
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
        const raw=localStorage.getItem(KIT_LIST_KEY);if(raw!==null){let prior;try{prior=JSON.parse(raw);}catch{throw Error('تعذّر قراءة قائمة التجهيز السابقة؛ لم نستبدلها. انسخ ملخصك للاحتفاظ به.');}if(prior?.version!==1||!Array.isArray(prior.lines))throw Error('صيغة قائمة التجهيز السابقة مختلفة؛ لم نستبدلها. انسخ ملخصك.');}
        if(localStorage.getItem(KIT_LIST_KEY)!==raw)throw Error('تغيّرت القائمة في تبويب آخر. أعد المحاولة بعد مراجعتها، أو انسخ ملخصك.');
        try{localStorage.setItem(KIT_LIST_KEY,JSON.stringify({version:1,savedAt:new Date().toISOString(),lines:payload.lines,design:payload.design,totalMinor:calculateKit(state,catalog).totalMinor}));}catch{throw Error('تعذّر حفظ قائمة التجهيز في المتصفح. بقيت اختياراتك هنا؛ انسخ الملخص للاحتفاظ بها.');}
        announce('حُفظت قائمة التجهيز في هذا المتصفح.');const success=make('div','kit-success');success.id='kit-success';success.append(make('strong','','تجميعتك محفوظة.'),make('p','','يمكنك العودة إلى هذه الصفحة وتعديل اختياراتك. هذه قائمة تجريبية، ولم تُرسل كطلب شراء.'));$('kit-panel').append(success);
      }
    }catch(error){announce(['TimeoutError','AbortError'].includes(error?.name)?'تعذّر التأكد من رد السلة في الوقت المحدد. أعد المحاولة بنفس الاختيارات.':error instanceof TypeError?'تعذّر الاتصال بالسلة أو التخزين. بقيت اختياراتك هنا؛ أعد المحاولة أو انسخ الملخص.':error instanceof SyntaxError?'تعذّر قراءة رد السلة. اختياراتك باقية؛ أعد المحاولة.':error instanceof Error&&error.message?error.message:'تعذّر إتمام العملية. اختياراتك باقية هنا؛ انسخ الملخص أو حاول مجددًا.',true);}
    finally{cartBusy=false;controls.forEach((e,i)=>{e.disabled=disabledBefore[i];});root.removeAttribute('aria-busy');}
  }
  async function load(){
    $('kit-loading').hidden=false;$('kit-retry').hidden=true;
    try{const response=await fetch(root.dataset.catalogUrl,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error();catalog=checkedCatalog(await response.json());byKey=new Map(catalog.items.map(p=>[p.key,p]));if(!available('tank').length||!available('substrate').length)throw Error();readState();
      $('kit-mode-note').textContent=runtime?'تجهيز من منتجات المتجر. السعر والتوفر يُراجعان عند الإضافة إلى السلة.':'قائمة تجهيز تجريبية — الشراء غير متاح في هذه المعاينة.';
      $('kit-app').hidden=false;$('kit-loading').hidden=true;renderPanel();refresh();ready=true;
    }catch{$('kit-loading').textContent='تعذّر تحميل منتجات التجهيز. أعد المحاولة، أو تصفّح المتجر من القائمة.';$('kit-retry').hidden=false;}
  }
  $('kit-retry').addEventListener('click',load);$('kit-form').addEventListener('submit',event=>event.preventDefault());
  $('kit-next').addEventListener('click',()=>goStep(Math.min(5,state.step+1)));$('kit-back').addEventListener('click',()=>goStep(Math.max(0,state.step-1)));
  root.querySelectorAll('[data-kit-step]').forEach(button=>button.addEventListener('click',()=>goStep(Number(button.dataset.kitStep))));
  $('kit-compact').addEventListener('click',()=>{const compact=root.classList.toggle('is-preview-compact');$('kit-compact').textContent=compact?'تكبير المعاينة':'تصغير المعاينة';$('kit-compact').setAttribute('aria-expanded',String(!compact));});
  root.addEventListener('click',event=>{if(cartBusy&&event.target.closest('a'))event.preventDefault();},true);
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{root.style.setProperty('--kit-preview-height',Math.ceil(root.querySelector('.kit-workbench').getBoundingClientRect().height)+'px');}).observe(root.querySelector('.kit-workbench'));
  const viewportChanged=()=>root.classList.toggle('is-short-viewport',(window.visualViewport?.height||innerHeight)<620);viewportChanged();window.visualViewport?.addEventListener('resize',viewportChanged);window.addEventListener('resize',viewportChanged,{passive:true});
  window.addEventListener('storage',event=>{if(ready&&(event.key===SETUP_STORAGE_KEY||event.key===null)){storageWritable=false;storageNote('تغيّرت التجميعة في تبويب آخر. احتفظنا باختيارات هذه الصفحة؛ انسخ الملخص قبل المغادرة.');}});
  load();
}
