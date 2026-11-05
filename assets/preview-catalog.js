(()=>{'use strict';
  const tag=document.getElementById('aq-preview-data');if(!tag)return;
  let data;try{data=JSON.parse(tag.textContent);}catch{return;}
  const $=id=>document.getElementById(id),format=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2});
  const money=value=>value===null||!Number.isFinite(Number(value))?'السعر غير محدد':format.format(Number(value))+' ر.س';
  const node=(name,className,text)=>{const el=document.createElement(name);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
  if(data.mode==='product'){
    const select=$('aq-variant');if(!select)return;
    select.addEventListener('change',()=>{const variant=select.value===''?null:data.variants[Number(select.value)];$('aq-reference-price').textContent=variant?money(variant.effectivePrice??variant.price):data.initialPrice;$('aq-variant-details').textContent=variant?(variant.attributes.map(a=>`${a.name}: ${a.value}`).join(' · ')||variant.name)+' — للمعاينة فقط.':'اختيارك هنا للمعاينة فقط.';});
    return;
  }
  if(data.mode!=='shop')return;
  const products=Array.isArray(data.products)?data.products:[],categories=Array.isArray(data.categories)?data.categories:[],base=data.base||'../',pageSize=16;
  const search=$('aq-search'),category=$('aq-category'),sort=$('aq-sort'),grid=$('aq-product-grid'),pagination=$('aq-pagination'),clear=$('aq-clear-filters');
  if(!search||!category||!sort||!grid)return;
  const normalize=s=>String(s||'').toLocaleLowerCase('ar').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');
  const searchText=new Map(products.map(p=>[p.id,normalize([p.name,p.summary,...p.categories.map(c=>c.name)].join(' '))]));
  const params=new URLSearchParams(location.search);let page=Math.max(1,parseInt(params.get('page')||'1',10)||1);
  search.value=params.get('s')||'';category.value=params.get('category')||'';sort.value=['price','price-desc','name'].includes(params.get('orderby'))?params.get('orderby'):'default';
  const href=p=>base+'products/'+encodeURIComponent(p.id)+'/';
  function tile(p){
    const article=node('article','ah-product aq-preview-card'),photo=node('a','ah-product-image');photo.href=href(p);
    if(typeof p.image==='string'&&/^assets\/[a-z0-9_./-]+$/i.test(p.image)&&!p.image.includes('..')){const img=node('img');img.src=base+p.image;img.alt=p.name;img.loading='lazy';img.decoding='async';img.width=700;img.height=700;photo.append(img);}else{const empty=node('div','aq-preview-placeholder');empty.append(node('span','','AQUA HAVEN'),node('small','','صورة المنتج غير متاحة'));photo.append(empty);}
    if(!p.inStock)photo.append(node('span','aq-preview-stock-tag','غير متوفر في اللقطة'));
    const body=node('div','ah-product-body'),title=node('h2'),link=node('a','',p.name);link.href=href(p);title.append(link);
    const bottom=node('div','ah-product-bottom'),details=node('a','ah-add','اكتشف التفاصيل ');details.href=href(p);const arrow=node('span','','←');arrow.setAttribute('aria-hidden','true');details.append(arrow);bottom.append(node('span','ah-price',money(p.effectivePrice??p.price)),details);
    body.append(node('p','ah-product-kicker',p.categories?.[0]?.name||'AQUA HAVEN'),title,bottom);article.append(photo,body);return article;
  }
  function selectedCategories(id){
    const ids=new Set(id?[id]:[]);let changed=true;while(changed){changed=false;for(const c of categories)if(!ids.has(c.id)&&c.parentIds.some(parent=>ids.has(parent))){ids.add(c.id);changed=true;}}return ids;
  }
  function pageButton(label,value,disabled,current=false){const b=node('button','',label);b.type='button';b.disabled=disabled;if(current)b.setAttribute('aria-current','page');b.addEventListener('click',()=>{page=value;render(true);});return b;}
  function render(scroll=false){
    const query=normalize(search.value.trim()),terms=query.split(/\s+/).filter(Boolean),ids=selectedCategories(category.value);
    let filtered=products.filter(p=>(!ids.size||p.categories.some(c=>ids.has(c.id)))&&terms.every(term=>searchText.get(p.id).includes(term)));
    if(sort.value==='price'||sort.value==='price-desc'){const direction=sort.value==='price'?1:-1;filtered.sort((a,b)=>{const pa=a.effectivePrice??a.price,pb=b.effectivePrice??b.price;return pa===null?pb===null?0:1:pb===null?-1:(pa-pb)*direction;});}
    else if(sort.value==='name')filtered.sort((a,b)=>a.name.localeCompare(b.name,'ar'));
    const pages=Math.max(1,Math.ceil(filtered.length/pageSize));page=Math.min(Math.max(1,page),pages);const start=(page-1)*pageSize;
    grid.replaceChildren(...filtered.slice(start,start+pageSize).map(tile));$('aq-no-results').hidden=filtered.length!==0;
    $('aq-result-count').textContent=filtered.length?`${format.format(start+1)}–${format.format(Math.min(start+pageSize,filtered.length))} من ${format.format(filtered.length)} قطعة`:'لا توجد نتائج مطابقة';
    clear.hidden=!search.value.trim()&&!category.value&&sort.value==='default';
    document.querySelectorAll('[data-category]').forEach(a=>{if(a.dataset.category===category.value)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');});
    pagination.replaceChildren();if(pages>1){pagination.append(pageButton('السابق',page-1,page===1));const visible=[...new Set([1,...Array.from({length:5},(_,i)=>page+i-2).filter(x=>x>1&&x<pages),pages])].sort((a,b)=>a-b);let previous=0;for(const n of visible){if(n-previous>1)pagination.append(node('span','','…'));pagination.append(pageButton(format.format(n),n,false,n===page));previous=n;}pagination.append(pageButton('التالي',page+1,page===pages));}
    const next=new URLSearchParams();if(search.value.trim())next.set('s',search.value.trim());if(category.value)next.set('category',category.value);if(sort.value!=='default')next.set('orderby',sort.value);if(page>1)next.set('page',page);const queryString=next.toString();history.replaceState(null,'',location.pathname+(queryString?'?'+queryString:'')+location.hash);
    if(scroll)grid.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  }
  let searchTimer;const changed=()=>{page=1;render();};search.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(changed,180);});category.addEventListener('change',changed);sort.addEventListener('change',changed);
  $('aq-catalog-form').addEventListener('submit',event=>{event.preventDefault();clearTimeout(searchTimer);changed();});
  clear.addEventListener('click',()=>{search.value='';category.value='';sort.value='default';changed();search.focus();});
  document.querySelectorAll('[data-category]').forEach(a=>a.addEventListener('click',event=>{event.preventDefault();category.value=a.dataset.category;changed();}));
  render();
})();
