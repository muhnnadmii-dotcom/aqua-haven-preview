export const SETUP_STORAGE_KEY='aqua-haven.setup.v1';
export const KIT_LIST_KEY='aqua-haven.setup-list.v1';
const roles=['tank','soil','substrate','filter','light','food'];
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
export function numberValue(value){
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value!=='string'||value.length>12)return null;
  const normalized=value.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-0x660)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-0x6f0)).replace('٫','.');
  return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)&&Number.isFinite(Number(normalized))?Number(normalized):null;
}
export function checkedCatalog(value){
  if(value?.version!==20||!Array.isArray(value.items)||!value.items.length)throw Error('Catalog format');
  const keys=new Set(),sku=new Set();
  for(const item of value.items){
    const identity=item.sourceId+'|'+(item.sourceVariantId||'');
    if(!/^[a-z0-9-]{1,80}$/.test(item.key)||keys.has(item.key)||sku.has(identity)||!roles.includes(item.role)||typeof item.name!=='string'||!item.name.length||item.name.length>250||!Number.isFinite(item.price)||item.price<0||item.price>1000000||typeof item.sourceId!=='string'||!/^assets\/[a-z0-9_./-]+$/i.test(item.image)||item.image.includes('..'))throw Error('Catalog item');
    if(item.role==='tank'&&!['length','width','height'].every(k=>Number.isFinite(item.dimensions?.[k])&&item.dimensions[k]>0&&item.dimensions[k]<=300))throw Error('Tank dimensions');
    keys.add(item.key);sku.add(identity);
  }
  return value;
}
export function initialState(catalog){
  const tanks=catalog.items.filter(p=>p.role==='tank'&&p.inStock),substrates=catalog.items.filter(p=>p.role==='substrate'&&p.inStock);
  return {version:1,step:0,tankKey:(tanks.find(p=>p.dimensions.length===60)||tanks[0]).key,soil:{key:null,depthCm:2},zones:substrates.length?[{id:'zone-1',key:substrates[0].key,share:100,depthCm:4}]:[],filterKey:null,lightKey:null,foodKey:null,manualPacks:{},quantityOverrides:{}};
}
export function restorableState(state,catalog){
  if(!plain(state)||state.version!==1||!Number.isInteger(state.step)||state.step<0||state.step>5||!plain(state.soil)||!Array.isArray(state.zones)||state.zones.length>3||!plain(state.manualPacks)||!plain(state.quantityOverrides))return false;
  const allowed=['version','step','tankKey','soil','zones','filterKey','lightKey','foodKey','manualPacks','quantityOverrides'];
  if(Object.keys(state).some(k=>!allowed.includes(k)))return false;
  const items=new Map(catalog.items.map(p=>[p.key,p]));
  if(items.get(state.tankKey)?.role!=='tank'||(state.soil.key!==null&&items.get(state.soil.key)?.role!=='soil'))return false;
  if(['filter','light','food'].some(role=>state[role+'Key']!==null&&items.get(state[role+'Key'])?.role!==role))return false;
  const scalar=x=>(typeof x==='number'&&Number.isFinite(x))||(typeof x==='string'&&x.length<=12);
  if(!scalar(state.soil.depthCm)||state.zones.some((z,i)=>!plain(z)||z.id!==`zone-${i+1}`||items.get(z.key)?.role!=='substrate'||!scalar(z.share)||!scalar(z.depthCm)))return false;
  return [state.manualPacks,state.quantityOverrides].every(map=>Object.entries(map).every(([key,v])=>items.has(key)&&scalar(v)));
}
export function validateState(state,catalog,throughStep=5){
  const errors=[],warnings=[],byKey=new Map(catalog.items.map(p=>[p.key,p]));
  const add=(field,step,message)=>{if(step<=throughStep)errors.push({field,step,message});};
  if(!restorableState(state,catalog))return {errors:[{field:'kit-tank',step:0,message:'تعذّر قراءة اختيارات التجميعة. ابدأ اختيارًا جديدًا.'}],warnings};
  const tank=byKey.get(state.tankKey);
  if(!tank?.inStock)add('kit-tank',0,'هذا الحوض غير متوفر في الكتالوج المرجعي. اختر حوضًا آخر.');
  const base=state.soil.key?numberValue(state.soil.depthCm):0;
  if(state.soil.key&&(!(base>=0.5)||base>12))add('kit-soil-depth',1,'حدّد ارتفاع التربة بين ٠٫٥ و١٢ سم.');
  if(state.soil.key&&!byKey.get(state.soil.key)?.inStock)add('kit-soil',1,'اختر تربة متوفرة في الكتالوج.');
  let sum=0;
  state.zones.forEach((zone,i)=>{
    const share=numberValue(zone.share),depth=numberValue(zone.depthCm),product=byKey.get(zone.key);
    if(!(share>0)||share>100)add(`kit-zone-share-${i}`,1,'حدّد نسبة أكبر من صفر وحتى ١٠٠٪.');else sum+=share;
    if(!(depth>=0.5)||depth>20)add(`kit-zone-depth-${i}`,1,'حدّد ارتفاع الأرضية بين ٠٫٥ و٢٠ سم.');
    if(base!==null&&depth!==null&&base+depth>=tank.dimensions.height)add(`kit-zone-depth-${i}`,1,'ارتفاع الطبقات يجب أن يبقى أقل من ارتفاع الحوض.');
    if(!product?.inStock)add(`kit-zone-product-${i}`,1,'اختر أرضية متوفرة في الكتالوج.');
  });
  if(state.zones.length&&Math.abs(sum-100)>0.01)add('kit-zone-share-0',1,'مجموع مساحات الأرضيات يجب أن يساوي ١٠٠٪.');
  const needsManual=[...new Set(state.zones.map(z=>z.key))].filter(key=>!byKey.get(key)?.packLitres);
  for(const key of needsManual){const n=numberValue(state.manualPacks[key]);if(!Number.isInteger(n)||n<1||n>99)add('kit-manual-'+key,1,'حدّد عدد العبوات بنفسك من ١ إلى ٩٩؛ وزن العبوة لا يحدد حجم تغطيتها.');}
  for(const [role,step] of [['filter',2],['light',3],['food',4]])if(state[role+'Key']&&!byKey.get(state[role+'Key'])?.inStock)add('kit-'+role,step,'المنتج غير متوفر في الكتالوج المرجعي. اختر آخر أو تابع بدونه.');
  const light=byKey.get(state.lightKey),fit=light?.fitTankLengthCm;
  if(fit&&(tank.dimensions.length<fit.min||tank.dimensions.length>fit.max))add('kit-light',3,'نطاق طول الحوض الموثق لهذه الإضاءة لا يشمل الحوض المختار. اختر إضاءة أخرى أو تابع بدونها.');
  if(state.filterKey)warnings.push('التدفق معلومة من الكتالوج، ولا يثبت وحده ملاءمة الفلتر لتجميعتك.');
  if(state.lightKey&&!fit)warnings.push('توافق الإضاءة مع طول الحوض يحتاج مراجعة؛ نطاق التثبيت غير موثق.');
  const selectedKeys=new Set([state.tankKey,state.soil.key,...state.zones.map(z=>z.key),state.filterKey,state.lightKey,state.foodKey].filter(Boolean));
  for(const [key,value] of Object.entries(state.quantityOverrides)){if(!selectedKeys.has(key))continue;const n=numberValue(value);if(!Number.isInteger(n)||n<1||n>99)add('kit-quantity-'+key,5,'عدد العبوات يجب أن يكون رقمًا صحيحًا من ١ إلى ٩٩.');}
  if(state.quantityOverrides[state.tankKey]!==undefined&&numberValue(state.quantityOverrides[state.tankKey])!==1)add('kit-quantity-'+state.tankKey,5,'هذه التجميعة لحوض واحد؛ كمية الحوض ثابتة عند واحد.');
  return {errors,warnings};
}
export function calculateKit(state,catalog){
  const validation=validateState(state,catalog),byKey=new Map(catalog.items.map(p=>[p.key,p])),tank=byKey.get(state.tankKey);
  if(!tank)return {...validation,lines:[],totalMinor:0,requiredLitres:0,volumeLitres:0,substrateVolume:0};
  const area=tank.dimensions.length*tank.dimensions.width,base=state.soil.key?(numberValue(state.soil.depthCm)||0):0,volumes=new Map();
  const addVolume=(key,volume)=>{if(volume>0)volumes.set(key,(volumes.get(key)||0)+volume);};
  if(state.soil.key)addVolume(state.soil.key,area*base/1000);
  for(const zone of state.zones){const share=numberValue(zone.share),depth=numberValue(zone.depthCm);if(share!==null&&depth!==null)addVolume(zone.key,area*share/100*depth/1000);}
  const lines=[];
  const line=(key,autoQuantity,requiredLitres=0,manual=false)=>{
    const product=byKey.get(key);if(!product)return;
    const override=state.quantityOverrides[key],quantity=override!==undefined?numberValue(override):autoQuantity;
    const validQuantity=Number.isInteger(quantity)&&quantity>=1&&quantity<=99;
    lines.push({key,product,quantity:validQuantity?quantity:null,autoQuantity,requiredLitres,manual,unitMinor:Math.round(product.price*100),totalMinor:validQuantity?Math.round(product.price*100)*quantity:null,underRequired:!!product.packLitres&&validQuantity&&quantity*product.packLitres+1e-8<requiredLitres});
  };
  line(tank.key,1);
  for(const [key,volume] of volumes){const p=byKey.get(key);const quantity=p.packLitres?Math.ceil(volume/p.packLitres-1e-9):numberValue(state.manualPacks[key]);line(key,quantity,volume,!p.packLitres);}
  for(const role of ['filter','light','food'])if(state[role+'Key'])line(state[role+'Key'],1);
  const substrateVolume=[...volumes.values()].reduce((a,b)=>a+b,0);
  const quantityErrors=lines.filter(l=>l.quantity===null).map(l=>({field:'kit-quantity-'+l.key,step:5,message:'حدّد عددًا صحيحًا من ١ إلى ٩٩.'}));
  if(lines.reduce((sum,line)=>sum+(line.quantity||0),0)>500)quantityErrors.push({field:'kit-finish',step:5,message:'مجموع كميات التجميعة يتجاوز ٥٠٠ وحدة. خفّض الكميات قبل الإضافة.'});
  return {...validation,errors:[...validation.errors,...quantityErrors],lines,totalMinor:lines.reduce((n,l)=>n+(l.totalMinor||0),0),volumeLitres:area*tank.dimensions.height/1000,substrateVolume,requiredLitres:substrateVolume};
}
export function buildCartPayload(state,catalog,requestId){
  const kit=calculateKit(state,catalog);
  if(kit.errors.length)throw Error(kit.errors[0].message);
  if(typeof requestId!=='string'||!/^[A-Za-z0-9_-]{16,80}$/.test(requestId))throw Error('Request identifier');
  const design=structuredClone(state);
  design.soil.depthCm=state.soil.key?numberValue(design.soil.depthCm):2;
  design.zones=design.zones.map(zone=>({...zone,share:numberValue(zone.share),depthCm:numberValue(zone.depthCm)}));
  const manualKeys=new Set(state.zones.filter(zone=>!catalog.items.find(p=>p.key===zone.key)?.packLitres).map(zone=>zone.key));
  const selectedKeys=new Set(kit.lines.map(line=>line.key));
  design.manualPacks=Object.fromEntries(Object.entries(design.manualPacks).filter(([key])=>manualKeys.has(key)).map(([key,value])=>[key,numberValue(value)]));
  design.quantityOverrides=Object.fromEntries(Object.entries(design.quantityOverrides).filter(([key])=>selectedKeys.has(key)).map(([key,value])=>[key,numberValue(value)]));
  return {requestId,lines:kit.lines.map(line=>({sourceId:line.product.sourceId,sourceVariantId:line.product.sourceVariantId||null,quantity:line.quantity})),design};
}
