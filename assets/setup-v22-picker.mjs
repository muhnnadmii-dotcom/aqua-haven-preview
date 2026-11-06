/* Inline, image-led product choices for the Aqua Haven assembly workbench. */

const FIT_ORDER={recommended:0,unverified:1,incompatible:2,neutral:3,unavailable:4};
const FIT_LABEL={recommended:'ضمن نطاق المقاس المعلن',unverified:'يحتاج مراجعة التوافق',incompatible:'خارج النطاق المعلن'};

export function normalizeChoiceSearch(value){
  return String(value??'').toLocaleLowerCase('ar').normalize('NFKC').replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x660)).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-0x6f0)).replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();
}

export function filterChoiceItems(items,query){
  const terms=normalizeChoiceSearch(query).split(' ').filter(Boolean);
  if(!terms.length)return items;
  return items.filter(product=>{
    const text=normalizeChoiceSearch([product.name,product.model,...(Array.isArray(product.notes)?product.notes:[])].filter(Boolean).join(' '));
    return terms.every(term=>text.includes(term));
  });
}

/**
 * @param {Object} options
 * @param {string} options.id Unique field id, e.g. kit-filter.
 * @param {string} options.label Accessible group label.
 * @param {Array<Object>} options.items Validated catalog products for this field.
 * @param {string|null} options.value Selected product key.
 * @param {(key:string|null)=>void} options.onChange Receives only a listed key or null.
 * @param {(priceSAR:number)=>string} options.formatPrice Receives product.price in SAR.
 * @param {(product:Object)=>string} options.assetUrl Receives the product, not an image path.
 * @param {(product:Object)=>Object} [options.fitFor] Documented-fit result; omit for non-size fields.
 * @param {string|null} [options.noneLabel] A real "no new product" choice, not a placeholder.
 * @param {string} [options.roleLabel] Short name used in search labels.
 * @param {number} [options.limit=6] Initial and incremental product count, clamped to 2–12.
 * @param {boolean} [options.initiallyExpanded] Defaults to true only without a selected product.
 * @returns {HTMLDivElement}
 */
export function createProductPicker({id,label,items,value=null,onChange,formatPrice,assetUrl,fitFor,noneLabel=null,roleLabel='',limit=6,initiallyExpanded}={}){
  if(typeof id!=='string'||!/^[a-z][a-z0-9:_.-]*$/i.test(id)||typeof label!=='string'||!Array.isArray(items)||typeof onChange!=='function')throw new TypeError('Invalid product picker configuration');
  const unique=new Map();
  for(const product of items){if(product&&typeof product.key==='string'&&!unique.has(product.key))unique.set(product.key,product);}
  const products=[...unique.values()],pageSize=Math.max(2,Math.min(12,Number.isInteger(limit)?limit:6));
  const price=typeof formatPrice==='function'?formatPrice:n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(n)+' ر.س';
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined){let end=0;const value=String(text);for(const match of value.matchAll(/\d+(?:\.\d+)?\s*×\s*\d+(?:\.\d+)?(?:\s*×\s*\d+(?:\.\d+)?)?/g)){node.append(document.createTextNode(value.slice(end,match.index)));const run=document.createElement('bdi');run.dir='ltr';run.textContent=match[0];node.append(run);end=match.index+match[0].length;}node.append(document.createTextNode(value.slice(end)));}return node;};
  const productName=product=>product.name+(product.model&&!product.name.toLowerCase().includes(String(product.model).toLowerCase())?' · '+product.model:'');
  const fit=product=>{
    if(typeof fitFor!=='function')return {status:'neutral',hardIncompatible:false};
    const result=fitFor(product)||{};
    return {status:Object.hasOwn(FIT_LABEL,result.status)?result.status:'unverified',hardIncompatible:result.hardIncompatible===true};
  };
  const fitMap=new Map(products.map(product=>[product.key,fit(product)]));
  const category=product=>product.inStock===false?'unavailable':fitMap.get(product.key).status;
  const sorted=[...products].sort((a,b)=>FIT_ORDER[category(a)]-FIT_ORDER[category(b)]||a.price-b.price||String(a.name).localeCompare(String(b.name),'ar'));
  const wrapper=el('div','kit-choice');wrapper.id=id;wrapper.tabIndex=-1;wrapper.setAttribute('role','group');wrapper.setAttribute('aria-labelledby',id+'-label');wrapper.dataset.productPicker='';
  const groupLabel=el('span','kit-choice-label',label);groupLabel.id=id+'-label';wrapper.append(groupLabel);
  let selected=value??null,shown=pageSize,query='',expanded=initiallyExpanded??!unique.has(selected);

  function photo(product,cls='kit-choice-photo'){
    const frame=el('span',cls);
    if(typeof assetUrl!=='function'){frame.classList.add('is-unavailable');frame.textContent='صورة المنتج';return frame;}
    let href;
    try{const url=new URL(assetUrl(product),document.baseURI);if(!['http:','https:'].includes(url.protocol))throw Error();href=url.href;}catch{frame.classList.add('is-unavailable');frame.textContent='صورة المنتج';return frame;}
    const image=el('img');image.src=href;image.alt='';image.width=88;image.height=88;image.loading='lazy';image.decoding='async';
    image.addEventListener('error',()=>{image.remove();frame.classList.add('is-unavailable');frame.textContent='الصورة غير متاحة';},{once:true});frame.append(image);return frame;
  }

  const selectedRow=el('div','kit-choice-current'),selectedBody=el('div','kit-choice-current-body');
  const toggle=el('button','kit-choice-toggle');toggle.type='button';toggle.setAttribute('aria-controls',id+'-options');
  const panel=el('div','kit-choice-options');panel.id=id+'-options';
  const searchLabel=el('label','kit-choice-search-label','ابحث بين الخيارات');searchLabel.htmlFor=id+'-search';
  const search=el('input','kit-choice-search');search.type='search';search.id=id+'-search';search.autocomplete='off';search.placeholder='اسم المنتج أو الموديل';search.setAttribute('aria-label','ابحث في '+(roleLabel||label));
  const resultCount=el('p','kit-choice-count');resultCount.setAttribute('role','status');resultCount.setAttribute('aria-live','polite');resultCount.setAttribute('aria-atomic','true');
  const none=noneLabel?el('button','kit-choice-none',noneLabel):null;
  if(none){none.type='button';none.dataset.choiceNone='';none.addEventListener('click',()=>choose(null));}
  const list=el('div','kit-choice-list');list.setAttribute('role','list');
  const more=el('button','kit-choice-more');more.type='button';
  const choiceStatus=el('p','kit-choice-status');choiceStatus.setAttribute('role','status');choiceStatus.setAttribute('aria-live','polite');choiceStatus.setAttribute('aria-atomic','true');
  selectedRow.append(selectedBody,toggle);panel.append(searchLabel,search,resultCount);if(none)panel.append(none);panel.append(list,more);wrapper.append(selectedRow,panel,choiceStatus);

  function refreshSummary(){
    selectedBody.replaceChildren();
    wrapper.dataset.value=selected??'';
    const product=unique.get(selected);
    if(product){
      const body=el('span','kit-choice-current-copy'),name=el('strong','kit-choice-current-name',productName(product));
      const detail=el('span','kit-choice-current-meta',price(product.price));body.append(name,detail);
      const result=fitMap.get(product.key);if(FIT_LABEL[result.status])body.append(el('small','kit-choice-fit is-'+result.status,FIT_LABEL[result.status]));
      if(product.inStock===false)body.append(el('small','kit-choice-stock','غير متوفر'));
      selectedBody.append(photo(product,'kit-choice-current-photo'),body);
    }else{
      const title=selected!==null?'الاختيار الحالي خارج القائمة المعروضة':noneLabel||'اختر المنتج المناسب لك';
      selectedBody.append(el('span','kit-choice-current-empty',title));
    }
    toggle.textContent=expanded?'إخفاء الخيارات':product?'تغيير المنتج':'استعرض الخيارات';
    toggle.setAttribute('aria-expanded',String(expanded));panel.hidden=!expanded;
  }

  function refreshPressed(){
    list.querySelectorAll('[data-choice-key]').forEach(button=>{const active=button.dataset.choiceKey===selected;button.setAttribute('aria-pressed',String(active));button.classList.toggle('is-selected',active);const selectedText=button.querySelector('.kit-choice-selected');if(selectedText)selectedText.hidden=!active;});
    if(none){none.setAttribute('aria-pressed',String(selected===null));none.classList.toggle('is-selected',selected===null);}
  }

  function choose(key){
    const product=key===null?null:unique.get(key);
    if(key!==null&&(!product||product.inStock===false||fitMap.get(key).hardIncompatible))return;
    if(key===selected)return;
    selected=key;refreshSummary();refreshPressed();choiceStatus.textContent=product?'تم اختيار '+product.name+'.':'تم اختيار '+noneLabel+'.';
    // No focus, click, collapse or deferred effect follows this callback. A parent may rebuild safely.
    onChange(key);
  }

  function renderList(){
    const matching=filterChoiceItems(sorted,query),visible=matching.slice(0,shown);list.replaceChildren();
    resultCount.textContent=matching.length?'عرض '+new Intl.NumberFormat('ar-SA').format(visible.length)+' من '+new Intl.NumberFormat('ar-SA').format(matching.length)+' خيار':'لا توجد خيارات مطابقة. جرّب اسمًا أقصر أو اسم الموديل.';
    let previousGroup=null;
    for(const product of visible){
      const group=category(product);
      if(group!==previousGroup){
        const label=group==='unavailable'?'غير متوفر':FIT_LABEL[group];
        if(label){const heading=el('p','kit-choice-group-label',label);heading.setAttribute('role','presentation');list.append(heading);}
        previousGroup=group;
      }
      const result=fitMap.get(product.key),row=el('div','kit-choice-row');row.setAttribute('role','listitem');
      const button=el('button','kit-choice-card');button.type='button';button.dataset.choiceKey=product.key;
      button.disabled=product.inStock===false||result.hardIncompatible;
      const body=el('span','kit-choice-copy'),name=el('strong','kit-choice-name',productName(product)),amount=el('span','kit-choice-price',price(product.price));body.append(name,amount);
      if(FIT_LABEL[result.status])body.append(el('small','kit-choice-fit is-'+result.status,FIT_LABEL[result.status]));
      if(product.inStock===false)body.append(el('small','kit-choice-stock','غير متوفر'));
      else if(result.hardIncompatible)body.append(el('small','kit-choice-stock','نطاق التثبيت لا يشمل الحوض المختار'));
      const activeText=el('small','kit-choice-selected','اختيارك الحالي');activeText.hidden=product.key!==selected;body.append(activeText);
      button.setAttribute('aria-label',(product.key===selected?'اختيارك الحالي: ':'اختر ')+productName(product)+'، '+price(product.price)+(button.disabled?'، '+(product.inStock===false?'غير متوفر':'خارج نطاق التثبيت') :''));
      button.append(photo(product),body);button.addEventListener('click',()=>choose(product.key));row.append(button);list.append(row);
    }
    const remaining=matching.length-visible.length;more.hidden=remaining<=0;more.textContent='عرض '+new Intl.NumberFormat('ar-SA').format(Math.min(pageSize,Math.max(0,remaining)))+' خيارات أخرى';refreshPressed();
  }

  toggle.addEventListener('click',()=>{expanded=!expanded;if(expanded)renderList();refreshSummary();});
  search.addEventListener('input',()=>{query=search.value;shown=pageSize;renderList();});
  more.addEventListener('click',()=>{shown+=pageSize;renderList();});
  refreshSummary();if(expanded)renderList();
  return wrapper;
}
