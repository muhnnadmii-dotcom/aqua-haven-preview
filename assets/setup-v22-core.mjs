export const SETUP_STORAGE_KEY='aqua-haven.setup.v2';
export const KIT_LIST_KEY='aqua-haven.setup-list.v2';
export const EQUIPMENT_ROLES=['airPump','airline','airStone','media','waterPump','hose','checkValve'];
export const OWNED_ROLES=['airPump','airline','media','waterPump','hose','checkValve'];
const ROLES=['tank','soil','substrate','filter','light','food',...EQUIPMENT_ROLES,'accessory','extra'];
const STATE_KEYS=['version','step','tankKey','soil','zones','substratePacks','bulkWeightsKg','filterKey','lightKey','foodKey','equipment','ownedComponents','airPumpPosition','extras','quantityOverrides'];
const LABELS={airPump:'مضخة هواء',airline:'أنبوب هواء',airStone:'حجر هواء',media:'إسفنج أو وسط ترشيح',waterPump:'مضخة ماء',hose:'خراطيم الماء',checkValve:'صمام عدم رجوع'};
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const scalar=value=>(typeof value==='number'&&Number.isFinite(value))||(typeof value==='string'&&value.length<=12);
const quantity=value=>{const n=numberValue(value);return Number.isInteger(n)&&n>=1&&n<=99?n:null;};
const keyValid=value=>typeof value==='string'&&/^[a-z0-9-]{1,100}$/.test(value);
const roundMinor=value=>Math.round(value*100);
const mapFor=catalog=>new Map(catalog.items.map(p=>[p.key,p]));
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);
const knownRange=range=>plain(range)&&(range.min===undefined||Number.isFinite(range.min))&&(range.max===undefined||Number.isFinite(range.max))&&(range.min!==undefined||range.max!==undefined)&&(range.min===undefined||range.min>=0)&&(range.max===undefined||range.max>0)&&(range.min===undefined||range.max===undefined||range.max>=range.min);

export function numberValue(value){
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value!=='string'||value.length>12)return null;
  const normalized=value.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-0x660)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-0x6f0)).replace('٫','.');
  return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)&&Number.isFinite(Number(normalized))?Number(normalized):null;
}

export function bulkWeightValue(value){const n=numberValue(value);return n!==null&&n>=0.5&&n<=99.5&&Math.abs(n*2-Math.round(n*2))<1e-8?Math.round(n*2)/2:null;}
export function isBulkEligible(product){return product?.role==='substrate'&&product.ownerBulkEligible===true&&Number.isFinite(product.packKg)&&product.packKg>0;}
const hasBulkWeight=(state,product)=>isBulkEligible(product)&&own(state.bulkWeightsKg,product.key);
const referenceDensity=product=>{const e=product.coverageEstimate;return plain(e)&&e.basis==='reference-dense-sand-gravel'&&e.notProductMeasured===true&&e.requiresReferenceAssumption===true&&Number.isFinite(e.densityKgPerL)&&Number.isFinite(e.min)&&Number.isFinite(e.max)&&e.min>0&&e.min<=e.densityKgPerL&&e.max>=e.densityKgPerL?e:null;};

export function checkedCatalog(value){
  if(value?.version!==22||!Array.isArray(value.items)||!value.items.length)throw Error('Catalog format');
  const keys=new Set(),identities=new Set();
  for(const item of value.items){
    const identity=item.sourceId+'|'+(item.sourceVariantId||'');
    if(!keyValid(item.key)||keys.has(item.key)||identities.has(identity)||!ROLES.includes(item.role)||typeof item.name!=='string'||!item.name.length||item.name.length>300||!Number.isFinite(item.price)||item.price<0||item.price>1000000||typeof item.sourceId!=='string'||!item.sourceId.length||typeof item.image!=='string'||!/^assets\/[a-z0-9_./-]+$/i.test(item.image)||item.image.includes('..')||typeof item.inStock!=='boolean')throw Error('Catalog item');
    if(item.role==='tank'&&!['length','width','height'].every(k=>Number.isFinite(item.dimensions?.[k])&&item.dimensions[k]>0&&item.dimensions[k]<=300))throw Error('Tank dimensions');
    for(const field of ['packLitres','packKg'])if(item[field]!==undefined&&(!Number.isFinite(item[field])||item[field]<=0))throw Error('Package fact');
    if(item.ownerBulkEligible!==undefined&&(typeof item.ownerBulkEligible!=='boolean'||(item.ownerBulkEligible&&!isBulkEligible(item))))throw Error('Owner bulk policy');
    if(item.coverageEstimate!==undefined&&!referenceDensity(item))throw Error('Reference density');
    for(const field of ['fitTankLengthCm','fitTankVolumeLitres'])if(item[field]!==undefined&&!knownRange(item[field]))throw Error('Documented fit range');
    if(item.equipmentFacts!==undefined){
      if(!plain(item.equipmentFacts))throw Error('Equipment facts');
      for(const field of ['requires','included'])if(item.equipmentFacts[field]!==undefined&&(!Array.isArray(item.equipmentFacts[field])||item.equipmentFacts[field].some(role=>!EQUIPMENT_ROLES.includes(role))))throw Error('Equipment role');
    }
    keys.add(item.key);identities.add(identity);
  }
  if(!value.items.some(p=>p.role==='tank'&&p.inStock))throw Error('No available tank');
  return value;
}

export function initialState(catalog){
  const tanks=catalog.items.filter(p=>p.role==='tank'&&p.inStock),substrates=catalog.items.filter(p=>p.role==='substrate'&&p.inStock);
  const tank=tanks.find(p=>p.dimensions.length===60&&(p.background==='clear'||p.key.endsWith('-clear')))||tanks[0];
  const first=substrates[0],bulkWeightsKg=first&&isBulkEligible(first)?{[first.key]:Math.max(.5,Math.min(99.5,Math.round(first.packKg*2)/2))}:{};
  return {version:2,step:0,tankKey:tank.key,soil:{key:null,packs:1},zones:first?[{id:'zone-1',key:first.key,share:100,allocation:100}]:[],substratePacks:first?{[first.key]:1}:{},bulkWeightsKg,filterKey:null,lightKey:null,foodKey:null,equipment:Object.fromEntries(EQUIPMENT_ROLES.map(role=>[role,null])),ownedComponents:[],airPumpPosition:'above',extras:[],quantityOverrides:{}};
}

export function tankVariants(catalog,tankKey){
  const tank=catalog.items.find(p=>p.key===tankKey&&p.role==='tank');
  if(!tank)return [];
  return catalog.items.filter(p=>p.role==='tank'&&['length','width','height'].every(k=>p.dimensions[k]===tank.dimensions[k]));
}

export function suitability(product,tank){
  const reasons=[];let documented=false,outside=false,hardIncompatible=false;
  if(!product||!tank?.dimensions)return {status:'unverified',hardIncompatible:false,reasons:['بيانات المقاس غير مكتملة.']};
  const volume=tank.dimensions.length*tank.dimensions.width*tank.dimensions.height/1000;
  for(const [field,actual,label] of [['fitTankLengthCm',tank.dimensions.length,'طول الحوض'],['fitTankVolumeLitres',volume,'الحجم الاسمي للحوض']]){
    const range=product[field];if(!knownRange(range))continue;documented=true;
    if((range.min!==undefined&&actual<range.min)||(range.max!==undefined&&actual>range.max)){outside=true;if(product.role==='light'&&field==='fitTankLengthCm')hardIncompatible=true;reasons.push(label+' خارج النطاق المعلن لهذا المنتج.');}
    else reasons.push(label+' ضمن النطاق المعلن لهذا المنتج.');
  }
  if(!documented)reasons.push('لا يوجد نطاق مقاس موثق؛ راجع مواصفات المنتج قبل اعتماده.');
  if(documented&&!outside)reasons.push('تطابق المقاس لا يؤكد وحده ملاءمة التجميعة كاملة.');
  return {status:outside?'incompatible':documented?'recommended':'unverified',hardIncompatible,reasons};
}

export function recommendations(catalog,role,state){
  const tank=catalog.items.find(p=>p.key===state.tankKey),groups={recommended:[],unverified:[],incompatible:[],all:[]};
  for(const product of catalog.items.filter(p=>p.role===role)){const result=suitability(product,tank);groups[result.status].push(product);}
  for(const group of ['recommended','unverified','incompatible'])groups[group].sort((a,b)=>Number(b.inStock)-Number(a.inStock)||a.price-b.price||a.key.localeCompare(b.key));
  groups.all=[...groups.recommended,...groups.unverified,...groups.incompatible];return groups;
}

export function restorableState(state,catalog){
  if(!plain(state)||state.version!==2||Object.keys(state).some(k=>!STATE_KEYS.includes(k))||!Number.isInteger(state.step)||state.step<0||state.step>6||!plain(state.soil)||Object.keys(state.soil).some(k=>!['key','packs'].includes(k))||!scalar(state.soil.packs)||!Array.isArray(state.zones)||state.zones.length>3||!plain(state.substratePacks)||!plain(state.equipment)||!Array.isArray(state.ownedComponents)||!Array.isArray(state.extras)||state.extras.length>100||!plain(state.quantityOverrides)||!['above','below'].includes(state.airPumpPosition))return false;
  const byKey=mapFor(catalog);
  if(byKey.get(state.tankKey)?.role!=='tank'||(state.soil.key!==null&&byKey.get(state.soil.key)?.role!=='soil'))return false;
  if(['filter','light','food'].some(role=>state[role+'Key']!==null&&byKey.get(state[role+'Key'])?.role!==role))return false;
  if(Object.keys(state.equipment).some(k=>!EQUIPMENT_ROLES.includes(k))||EQUIPMENT_ROLES.some(role=>!(role in state.equipment)||(state.equipment[role]!==null&&byKey.get(state.equipment[role])?.role!==role)))return false;
  if(new Set(state.ownedComponents).size!==state.ownedComponents.length||state.ownedComponents.some(role=>!OWNED_ROLES.includes(role)))return false;
  if(new Set(state.extras).size!==state.extras.length||state.extras.some(key=>!['extra','accessory'].includes(byKey.get(key)?.role)))return false;
  if(state.zones.some((zone,index)=>!plain(zone)||Object.keys(zone).some(k=>!['id','key','share','allocation'].includes(k))||zone.id!==`zone-${index+1}`||byKey.get(zone.key)?.role!=='substrate'||!scalar(zone.share)||!scalar(zone.allocation)))return false;
  if(!Object.entries(state.substratePacks).every(([key,value])=>byKey.get(key)?.role==='substrate'&&scalar(value)))return false;
  if(state.bulkWeightsKg!==undefined&&(!plain(state.bulkWeightsKg)||!Object.entries(state.bulkWeightsKg).every(([key,value])=>isBulkEligible(byKey.get(key))&&scalar(value))))return false;
  return Object.entries(state.quantityOverrides).every(([key,value])=>byKey.has(key)&&scalar(value));
}

export function geometryFor(state,catalog){
  const byKey=mapFor(catalog),tank=byKey.get(state.tankKey),areaCm2=tank.dimensions.length*tank.dimensions.width,unknownKeys=new Set(),estimatedKeys=new Set();
  const soil=byKey.get(state.soil.key),soilPacks=quantity(state.soil.packs),soilLitres=soil&&soil.packLitres&&soilPacks!==null?soil.packLitres*soilPacks:soil?null:0;
  if(soil&&soilLitres===null)unknownKeys.add(soil.key);
  const soilDepthCm=soilLitres===null?null:soilLitres*1000/areaCm2;
  const zones=state.zones.map((zone,index)=>{
    const product=byKey.get(zone.key),bulk=hasBulkWeight(state,product),packs=bulk?null:quantity(state.substratePacks[zone.key]),weightKg=bulk?bulkWeightValue(state.bulkWeightsKg[zone.key]):packs!==null&&product.packKg?packs*product.packKg:null,share=numberValue(zone.share),allocation=numberValue(zone.allocation),density=referenceDensity(product);
    let stockLitres=null,stockLitresMin=null,stockLitresMax=null,estimated=false;
    if(product.packLitres&&(bulk?weightKg!==null:packs!==null))stockLitres=bulk?product.packLitres/product.packKg*weightKg:product.packLitres*packs;
    else if(weightKg!==null&&density){stockLitres=weightKg/density.densityKgPerL;stockLitresMin=weightKg/density.max;stockLitresMax=weightKg/density.min;estimated=true;estimatedKeys.add(zone.key);}
    if(stockLitres!==null&&!estimated)stockLitresMin=stockLitresMax=stockLitres;
    const litres=stockLitres!==null&&allocation!==null?stockLitres*allocation/100:null,litresMin=stockLitresMin!==null&&allocation!==null?stockLitresMin*allocation/100:null,litresMax=stockLitresMax!==null&&allocation!==null?stockLitresMax*allocation/100:null;
    if(litres===null)unknownKeys.add(zone.key);
    const depthCm=litres!==null&&share>0?litres*1000/(areaCm2*share/100):null;
    const depthCmMin=litresMin!==null&&share>0?litresMin*1000/(areaCm2*share/100):null,depthCmMax=litresMax!==null&&share>0?litresMax*1000/(areaCm2*share/100):null;
    return {id:zone.id,key:zone.key,index,share,allocation,packs,weightKg,bulk,litres,litresMin,litresMax,estimated,densityKgPerL:estimated?density.densityKgPerL:null,densitySourceUrl:estimated?density.sourceUrl:null,depthCm,depthCmMin,depthCmMax,totalDepthCm:depthCm!==null&&soilDepthCm!==null?depthCm+soilDepthCm:null,totalDepthCmMin:depthCmMin!==null&&soilDepthCm!==null?depthCmMin+soilDepthCm:null,totalDepthCmMax:depthCmMax!==null&&soilDepthCm!==null?depthCmMax+soilDepthCm:null};
  });
  return {areaCm2,soilLitres,soilDepthCm,soilKnown:soilDepthCm!==null,zones,unknownKeys:[...unknownKeys],estimatedKeys:[...estimatedKeys],hasEstimates:estimatedKeys.size>0,allKnown:unknownKeys.size===0,allDocumented:unknownKeys.size===0&&estimatedKeys.size===0};
}

export function filterSystem(state,catalog){
  const byKey=mapFor(catalog),filter=byKey.get(state.filterKey),facts=filter?.equipmentFacts||{},type=filter?.filterType||(!filter&&state.equipment?.airStone?'aeration':'none');
  const owned=new Set(state.ownedComponents||[]),included=new Set(facts.included||[]),requires=new Set(facts.requires||[]),uncertain=new Set();
  const warnings=[];
  if(type==='sponge'||type==='aeration'||state.equipment?.airStone){requires.add('airPump');requires.add('airline');}
  if(type==='canister')for(const role of ['hose','media'])if(!included.has(role)){requires.add(role);if(!(facts.requires||[]).includes(role))uncertain.add(role);}
  if(state.equipment?.airPump)requires.add('airline');
  const airDriven=type==='sponge'||type==='aeration'||requires.has('airPump')||!!state.equipment?.airPump||!!state.equipment?.airStone;
  if(airDriven&&state.airPumpPosition==='below')requires.add('checkValve');
  const dependencies=[...requires].map(role=>({role,label:LABELS[role]||role,selectedKey:state.equipment?.[role]||null,included:included.has(role),owned:owned.has(role),satisfied:included.has(role)||owned.has(role)||!!state.equipment?.[role],uncertain:uncertain.has(role)}));
  if(type==='aeration')warnings.push('حجر الهواء يهوّي الماء؛ لا يحل وحده محل فلتر ترشيح.');
  if(type==='canister')warnings.push('تحقق من قطر الخراطيم ووصلات السحب والرجوع وموضع الفلتر في دليل الطراز. الرسم يوضح المسار فقط.');
  if(type==='sponge')warnings.push('المضخة خارج الماء، والفلتر الإسفنجي داخل الحوض. حجر هواء إضافي ليس شرطًا لكل فلتر إسفنجي.');
  if(type==='hob')warnings.push('الفلتر المعلّق يثبت على الحافة؛ لا تضف مضخة هواء لتشغيله إلا إذا نصّ طرازه على ذلك.');
  if(type==='internal')warnings.push('الفلتر الداخلي يعمل داخل الحوض حسب تعليمات طرازه؛ التوصيل المرسوم إرشادي.');
  if(type==='undergravel')warnings.push('تحقق من طريقة تشغيل الفلتر الأرضي: مضخة هواء أم مضخة ماء، ومن مقاس الأنابيب واللوح.');
  if(type==='unknown')warnings.push('طريقة تشغيل هذا الفلتر غير موثقة بما يكفي؛ راجع محتويات العبوة والتوصيلات قبل اعتماده.');
  if(dependencies.some(d=>d.uncertain))warnings.push('محتويات علبة الفلتر غير مكتملة التوثيق. اختر القطعة، أو أكد أنها متوفرة لديك بعد مراجعة العلبة.');
  if(airDriven&&state.airPumpPosition==='below')warnings.push('عند وضع مضخة الهواء أسفل مستوى الماء، استخدم صمام عدم رجوع مناسبًا واتبع تعليمات المضخة.');
  const placement=facts.placement||({sponge:'inside',canister:'outside-below',hob:'rim',internal:'inside',undergravel:'floor',aeration:'inside'}[type]||'unknown');
  const labels={sponge:'فلتر إسفنجي بالهواء',canister:'فلتر خارجي كانستر',hob:'فلتر معلّق',internal:'فلتر داخلي',undergravel:'فلتر أرضي',aeration:'تهوية بحجر هواء',unknown:'فلتر يحتاج مراجعة',none:'بدون فلتر مختار'};
  const diagramPlacement=type==='canister'&&['outside-side','outside-below'].includes(filter?.diagramPlacement)?filter.diagramPlacement:placement;
  return {type,label:labels[type]||labels.unknown,placement,placementVerified:facts.placementVerified===true,diagramPlacement,requires:dependencies,included:[...included],warnings,diagram:{type,placement:diagramPlacement,airDriven,airPumpPosition:state.airPumpPosition,hasAirStone:!!state.equipment?.airStone,hasWaterPump:!!state.equipment?.waterPump,connections:type==='canister'?['intake','return']:airDriven?['airline']:['water-flow']}};
}

export function validateState(state,catalog,throughStep=6){
  const errors=[],warnings=[],byKey=mapFor(catalog),add=(field,step,message)=>{if(step<=throughStep)errors.push({field,step,message});};
  if(!restorableState(state,catalog))return {errors:[{field:'kit-tank',step:0,message:'تعذّر قراءة اختيارات التجميعة. ابدأ اختيارًا جديدًا.'}],warnings};
  const tank=byKey.get(state.tankKey);if(!tank.inStock)add('kit-tank',0,'هذا الحوض غير متوفر في الكتالوج المرجعي. اختر حوضًا آخر.');
  if(state.soil.key){if(!quantity(state.soil.packs))add('kit-soil-packs',1,'حدّد عدد عبوات التربة من ١ إلى ٩٩.');if(!byKey.get(state.soil.key).inStock)add('kit-soil',1,'اختر تربة متوفرة في الكتالوج المرجعي.');}
  let shareSum=0;const allocations=new Map();
  state.zones.forEach((zone,index)=>{
    const share=numberValue(zone.share),allocation=numberValue(zone.allocation),product=byKey.get(zone.key);
    if(!(share>0)||share>100)add('kit-zone-share-'+index,1,'حدّد مساحة أكبر من صفر وحتى ١٠٠٪.');else shareSum+=share;
    if(!(allocation>0)||allocation>100)add('kit-zone-allocation-'+index,1,'حدّد حصة صحيحة من كمية المنتج أكبر من صفر وحتى ١٠٠٪.');else allocations.set(zone.key,(allocations.get(zone.key)||0)+allocation);
    if(!product.inStock)add('kit-zone-product-'+index,1,'اختر أرضية متوفرة في الكتالوج المرجعي.');
    if(hasBulkWeight(state,product)){if(bulkWeightValue(state.bulkWeightsKg[zone.key])===null)add('kit-weight-'+zone.key,1,'حدّد وزنًا من ٠٫٥ إلى ٩٩٫٥ كجم بزيادة نصف كيلو.');}
    else if(!quantity(state.substratePacks[zone.key]))add('kit-packs-'+zone.key,1,'حدّد عدد عبوات الأرضية من ١ إلى ٩٩.');
  });
  if(state.zones.length&&Math.abs(shareSum-100)>.01)add('kit-zone-share-0',1,'مجموع مساحات الأرضيات يجب أن يساوي ١٠٠٪.');
  for(const [key,sum] of allocations)if(Math.abs(sum-100)>.01)add('kit-zone-allocation-'+state.zones.findIndex(zone=>zone.key===key),1,'وزّع كامل كمية المنتج بين مناطقه؛ مجموع حصصه يجب أن يساوي ١٠٠٪.');
  const geometry=geometryFor(state,catalog);
  if(geometry.soilDepthCm!==null&&geometry.soilDepthCm>=tank.dimensions.height)add('kit-soil-packs',1,'عدد العبوات يرفع التربة إلى ارتفاع الحوض أو أكثر. قلّل عددها.');
  for(const zone of geometry.zones)if((zone.depthCm!==null&&zone.depthCm>=tank.dimensions.height)||(zone.totalDepthCm!==null&&zone.totalDepthCm>=tank.dimensions.height))add('kit-zone-share-'+zone.index,1,'كمية الأرضية على هذه المساحة تتجاوز ارتفاع الحوض. قلّل العبوات أو وسّع المنطقة.');
  if(!geometry.allKnown)warnings.push('ارتفاع بعض الأرضيات غير محدد: العبوة بالكيلو أو بلا حجم تغطية موثق. لا نحول الوزن إلى لتر دون بيانات.');
  if(geometry.hasEstimates)warnings.push('ارتفاع الرمل والحصى تقديري باستخدام كثافة مرجعية ١٫٦٥ كجم/لتر ضمن نطاق ١٫٦–١٫٧؛ ليست كثافة مقاسة لهذا المنتج.');
  for(const [role,step] of [['filter',2],['light',3],['food',4]]){
    const product=byKey.get(state[role+'Key']);if(!product)continue;
    if(!product.inStock)add('kit-'+role,step,'المنتج غير متوفر في الكتالوج المرجعي. اختر آخر أو تابع بدونه.');
    const fit=suitability(product,tank);if(fit.hardIncompatible)add('kit-'+role,step,'نطاق طول الحوض الموثق لهذه الإضاءة لا يشمل الحوض المختار. اختر أخرى أو تابع بدونها.');
    if(fit.status==='incompatible'&&!fit.hardIncompatible)warnings.push(product.name+': '+fit.reasons[0]+' يمكنك تعديل الترشيح بعد مراجعة المواصفات.');
    if(fit.status==='unverified'&&role!=='food')warnings.push(product.name+': ملاءمة المقاس غير موثقة.');
  }
  const system=filterSystem(state,catalog);warnings.push(...system.warnings);
  for(const dependency of system.requires)if(!dependency.satisfied)add('kit-equipment-'+dependency.role,2,'أكمل '+dependency.label+'، أو أكد أنها متوفرة لديك.');
  for(const role of EQUIPMENT_ROLES){const product=byKey.get(state.equipment[role]);if(product&&!product.inStock)add('kit-equipment-'+role,2,'القطعة غير متوفرة في الكتالوج المرجعي. اختر قطعة أخرى.');}
  if(state.extras.length>24)add('kit-extra-'+state.extras[24],5,'يمكن إضافة ٢٤ منتجًا إضافيًا كحد أقصى للتجميعة الواحدة.');
  for(const key of state.extras)if(!byKey.get(key).inStock)add('kit-extra-'+key,5,'هذا المنتج الإضافي غير متوفر في الكتالوج المرجعي.');
  const selected=new Set([state.tankKey,state.soil.key,...state.zones.map(z=>z.key),state.filterKey,state.lightKey,state.foodKey,...Object.values(state.equipment),...state.extras].filter(Boolean));
  for(const [key,value] of Object.entries(state.quantityOverrides)){
    if(!selected.has(key))continue;const product=byKey.get(key),n=quantity(value);
    if(['soil','substrate'].includes(product.role))add('kit-quantity-'+key,6,'عدّل عدد عبوات الأرضية في خطوة الأرضيات حتى يتحدث الارتفاع معها.');
    else if(product.role==='tank'&&numberValue(value)!==1)add('kit-quantity-'+key,6,'هذه التجميعة لحوض واحد؛ كمية الحوض ثابتة عند واحد.');
    else if(n===null)add('kit-quantity-'+key,6,'حدّد عددًا صحيحًا من ١ إلى ٩٩.');
  }
  return {errors,warnings:[...new Set(warnings)]};
}

export function calculateKit(state,catalog){
  const validation=validateState(state,catalog),byKey=mapFor(catalog);
  if(!restorableState(state,catalog))return {...validation,lines:[],totalMinor:0,volumeLitres:0,substrateVolume:null,geometry:null,system:null};
  const tank=byKey.get(state.tankKey),geometry=geometryFor(state,catalog),counts=new Map();
  const add=(key,count,origin)=>{if(!key)return;const previous=counts.get(key);if(previous){previous.quantity=count===null||previous.quantity===null?null:previous.quantity+count;previous.origins.push(origin);}else counts.set(key,{quantity:count,origins:[origin]});};
  add(tank.key,1,'tank');if(state.soil.key)add(state.soil.key,quantity(state.soil.packs),'soil');
  for(const key of new Set(state.zones.map(zone=>zone.key))){const product=byKey.get(key);if(hasBulkWeight(state,product)){add(key,1,'substrate');counts.get(key).weightKg=bulkWeightValue(state.bulkWeightsKg[key]);counts.get(key).bulk=true;}else add(key,quantity(state.substratePacks[key]),'substrate');}
  for(const role of ['filter','light','food'])if(state[role+'Key'])add(state[role+'Key'],quantity(state.quantityOverrides[state[role+'Key']]??1),role);
  for(const role of EQUIPMENT_ROLES)if(state.equipment[role])add(state.equipment[role],quantity(state.quantityOverrides[state.equipment[role]]??1),role);
  for(const key of state.extras)add(key,quantity(state.quantityOverrides[key]??1),'extra');
  const lines=[...counts].map(([key,count])=>{const product=byKey.get(key),n=count.quantity,bulk=count.bulk===true,valid=Number.isInteger(n)&&n>=1&&n<=99&&(!bulk||count.weightKg!==null),unitMinor=bulk&&count.weightKg!==null?roundMinor(product.price/product.packKg*count.weightKg):roundMinor(product.price);return {key,product,quantity:valid?n:null,autoQuantity:n,origins:count.origins,packDriven:['soil','substrate'].includes(product.role),pricingUnit:bulk?'kg':'item',...(bulk?{weightKg:count.weightKg,pricePerKgMinor:roundMinor(product.price/product.packKg)}:{}),unitMinor,totalMinor:valid?unitMinor*n:null};});
  const quantityErrors=lines.filter(line=>line.quantity===null).map(line=>({field:'kit-quantity-'+line.key,step:6,message:'حدّد عددًا صحيحًا من ١ إلى ٩٩ لكل منتج.'}));
  if(lines.reduce((sum,line)=>sum+(line.quantity||0),0)>500)quantityErrors.push({field:'kit-finish',step:6,message:'مجموع كميات التجميعة يتجاوز ٥٠٠ وحدة. خفّض الكميات قبل الإضافة.'});
  const knownLitres=(geometry.soilLitres||0)+geometry.zones.reduce((sum,zone)=>sum+(zone.estimated?0:zone.litres||0),0),estimatedLitres=geometry.zones.reduce((sum,zone)=>sum+(zone.estimated?zone.litres||0:0),0),combinedLitres=knownLitres+estimatedLitres;
  return {...validation,errors:[...validation.errors,...quantityErrors],lines,totalMinor:lines.reduce((sum,line)=>sum+(line.totalMinor||0),0),volumeLitres:geometry.areaCm2*tank.dimensions.height/1000,substrateVolume:geometry.allKnown?combinedLitres:null,knownSubstrateLitres:knownLitres,estimatedSubstrateLitres:estimatedLitres,requiredLitres:geometry.allKnown?combinedLitres:null,geometry,system:filterSystem(state,catalog)};
}

export function buildCartPayload(state,catalog,requestId){
  const kit=calculateKit(state,catalog);if(kit.errors.length)throw Error(kit.errors[0].message);
  if(typeof requestId!=='string'||!/^[A-Za-z0-9_-]{16,80}$/.test(requestId))throw Error('Request identifier');
  const design=structuredClone(state),selected=new Set(kit.lines.map(line=>line.key)),zoneKeys=new Set(state.zones.map(zone=>zone.key)),byKey=mapFor(catalog);
  design.soil.packs=state.soil.key?quantity(state.soil.packs):1;
  design.zones=design.zones.map(zone=>({...zone,share:numberValue(zone.share),allocation:numberValue(zone.allocation)}));
  design.substratePacks=Object.fromEntries(Object.entries(state.substratePacks).filter(([key])=>zoneKeys.has(key)&&!hasBulkWeight(state,byKey.get(key))).map(([key,value])=>[key,quantity(value)]));
  design.bulkWeightsKg=Object.fromEntries(Object.entries(state.bulkWeightsKg||{}).filter(([key])=>zoneKeys.has(key)&&isBulkEligible(byKey.get(key))).map(([key,value])=>[key,bulkWeightValue(value)]));
  design.quantityOverrides=Object.fromEntries(Object.entries(state.quantityOverrides).filter(([key])=>selected.has(key)&&!['soil','substrate','tank'].includes(byKey.get(key).role)).map(([key,value])=>[key,quantity(value)]));
  design.ownedComponents=OWNED_ROLES.filter(role=>state.ownedComponents.includes(role));
  return {requestId,lines:kit.lines.map(line=>({sourceId:line.product.sourceId,sourceVariantId:line.product.sourceVariantId||null,quantity:line.quantity,...(line.pricingUnit==='kg'?{weightKg:line.weightKg}:{})})),design};
}

const cloneEditableState=(state,catalog)=>{
  if(!restorableState(state,catalog))throw Error('تعذّر قراءة التجميعة لتعديلها. افتح خطوة الحوض واختر المنتجات مجددًا.');
  return structuredClone(state);
};
function normaliseZoneAmounts(zones){
  const normalise=(items,field)=>{
    if(!items.length)return;
    const entered=items.map(item=>numberValue(item[field]));
    const weights=entered.every(value=>value!==null&&value>0)?entered:items.map(()=>1);
    const sum=weights.reduce((a,b)=>a+b,0);let assigned=0;
    items.forEach((item,index)=>{const value=index===items.length-1?100-assigned:Math.round(weights[index]/sum*100*1e10)/1e10;item[field]=value;assigned+=value;});
  };
  zones.forEach((zone,index)=>zone.id='zone-'+(index+1));
  normalise(zones,'share');
  for(const key of new Set(zones.map(zone=>zone.key)))normalise(zones.filter(zone=>zone.key===key),'allocation');
}
function pruneUnselectedAmounts(state){
  const selected=new Set([state.tankKey,state.soil.key,...state.zones.map(zone=>zone.key),state.filterKey,state.lightKey,state.foodKey,...Object.values(state.equipment),...state.extras].filter(Boolean));
  const zoneKeys=new Set(state.zones.map(zone=>zone.key));
  state.substratePacks=Object.fromEntries(Object.entries(state.substratePacks).filter(([key])=>zoneKeys.has(key)));
  if(state.bulkWeightsKg!==undefined)state.bulkWeightsKg=Object.fromEntries(Object.entries(state.bulkWeightsKg).filter(([key])=>zoneKeys.has(key)));
  state.quantityOverrides=Object.fromEntries(Object.entries(state.quantityOverrides).filter(([key])=>selected.has(key)));
  return state;
}

/** Immutable tray removal. A tank is edited, never removed from its own kit. */
export function removeKitProduct(state,catalog,key){
  const next=cloneEditableState(state,catalog);
  if(key===next.tankKey)throw Error('هذه التجميعة لحوض واحد. لتغييره افتح خطوة الحوض بدل حذفه.');
  if(next.soil.key===key)next.soil={key:null,packs:1};
  const zoneCount=next.zones.length;next.zones=next.zones.filter(zone=>zone.key!==key);
  if(next.zones.length!==zoneCount)normaliseZoneAmounts(next.zones);
  if(next.filterKey===key){
    next.filterKey=null;next.equipment=Object.fromEntries(EQUIPMENT_ROLES.map(role=>[role,null]));next.ownedComponents=[];
  }
  for(const role of ['light','food'])if(next[role+'Key']===key)next[role+'Key']=null;
  for(const role of EQUIPMENT_ROLES)if(next.equipment[role]===key){next.equipment[role]=null;next.ownedComponents=next.ownedComponents.filter(ownedRole=>ownedRole!==role);}
  next.extras=next.extras.filter(extraKey=>extraKey!==key);
  delete next.substratePacks[key];if(next.bulkWeightsKg!==undefined)delete next.bulkWeightsKg[key];delete next.quantityOverrides[key];
  return pruneUnselectedAmounts(next);
}

/** Toggle the surface sand/gravel, retaining the independently chosen soil base. */
export function setSubstrateEnabled(state,catalog,enabled){
  const next=cloneEditableState(state,catalog);
  if(!enabled){next.zones=[];return pruneUnselectedAmounts(next);}
  if(next.zones.length)return next;
  const product=catalog.items.find(item=>item.role==='substrate'&&item.inStock);
  if(!product)throw Error('لا توجد أرضية متوفرة للاختيار حاليًا؛ يمكنك إكمال التجميعة بدون رمل أو حصى.');
  next.zones=[{id:'zone-1',key:product.key,share:100,allocation:100}];next.substratePacks[product.key]=1;
  if(isBulkEligible(product)){next.bulkWeightsKg??={};next.bulkWeightsKg[product.key]=Math.max(.5,Math.min(99.5,Math.round(product.packKg*2)/2));}
  return pruneUnselectedAmounts(next);
}

/** Return the existing workflow step used to edit a purchased product. */
export function editStepForProduct(catalog,key){
  const product=catalog.items.find(item=>item.key===key);if(!product)return null;
  if(product.role==='tank')return 0;
  if(['soil','substrate'].includes(product.role))return 1;
  if(product.role==='filter'||EQUIPMENT_ROLES.includes(product.role))return 2;
  if(product.role==='light')return 3;
  if(product.role==='food')return 4;
  return ['extra','accessory'].includes(product.role)?5:null;
}

/** Pure volume planning; a selected depth is a visitor target, not a plant-fit guarantee. */
export function soilCoverageRecommendation(state,catalog,product,targetDepth){
  const byKey=mapFor(catalog),tank=byKey.get(state.tankKey),soil=byKey.get(typeof product==='string'?product:product?.key);
  const planning=catalog.guidance?.soilPlanning||{};
  const presetsCm=Array.isArray(planning.presetsCm)?planning.presetsCm.filter(value=>Number.isFinite(value)&&value>0&&value<tank?.dimensions?.height):[];
  const base={available:false,nominal:true,depthAuthority:'visitor-selected-planning-depth',presetsCm,sourceUrl:typeof planning.sourceUrl==='string'?planning.sourceUrl:null};
  if(!tank?.dimensions||soil?.role!=='soil'||!Number.isFinite(soil.packLitres)||soil.packLitres<=0)return {...base,reason:'اختر حوضًا وتربة بحجم عبوة مسجل باللتر لحساب التغطية.'};
  const footprintCm2=tank.dimensions.length*tank.dimensions.width,packLitres=soil.packLitres;
  if(targetDepth===undefined||targetDepth===null)return {...base,requiresPlanningDepth:true,footprintCm2,packLitres,reason:'اختر عمقًا للتخطيط حتى نحسب كمية التربة وتغطيتها.'};
  const min=plain(targetDepth)?numberValue(targetDepth.min):numberValue(targetDepth),max=plain(targetDepth)?numberValue(targetDepth.max):numberValue(targetDepth);
  if(min===null||max===null||min<=0||max<min||max>=tank.dimensions.height)return {...base,footprintCm2,packLitres,reason:'اختر عمقًا موجبًا أقل من ارتفاع الحوض، أو نطاقًا مرتبًا ضمنه.'};
  const requiredLitres={min:footprintCm2*min/1000,max:footprintCm2*max/1000};
  const packs={min:Math.ceil(requiredLitres.min/packLitres-1e-10),max:Math.ceil(requiredLitres.max/packLitres-1e-10)};
  const wholeMin=Math.ceil(requiredLitres.min/packLitres-1e-10),wholeMax=Math.floor(requiredLitres.max/packLitres+1e-10);
  const feasibleWholePackRange=wholeMin<=wholeMax?{min:wholeMin,max:wholeMax}:null;
  const coverage=number=>{const depthCm=number*packLitres*1000/footprintCm2;return {packs:number,litres:number*packLitres,depthCm,withinTank:depthCm<tank.dimensions.height,withinPackLimit:number>=1&&number<=99};};
  const belowCount=Math.floor(requiredLitres.min/packLitres+1e-10),nearestBelow=belowCount>=1?coverage(belowCount):null,nearestAbove=coverage(Math.max(1,Math.ceil(requiredLitres.max/packLitres-1e-10)));
  const selectedPacks=state.soil.key===soil.key?quantity(state.soil.packs):null;
  const minimumPurchaseCoverage=coverage(packs.min);
  return {...base,available:true,requiresPlanningDepth:false,footprintCm2,packLitres,targetDepthCm:{min,max},requiredLitres,packs,minimumPurchasePacks:packs.min,minimumPurchaseCoverage,canApplyMinimumPurchase:minimumPurchaseCoverage.withinTank&&minimumPurchaseCoverage.withinPackLimit,feasibleWholePackRange,nearestBelow,nearestAbove,selectedPacks,selectedCoverageCm:selectedPacks===null?null:selectedPacks*packLitres*1000/footprintCm2,allPurchasedSoilUsed:true,notes:['الحساب بالأبعاد الاسمية ومساحة القاع كاملة؛ ليس قياسًا داخليًا للحوض.','عدد العبوات يقرب إلى أعلى للشراء. إذا صببتها كلها فقد يصبح العمق أعلى من عمق التخطيط.','ملاءمة التربة للنبات وتعليمات الطبقات تُراجع في وصف المنتج؛ الحساب الحجمي وحده لا يؤكدها.']};
}
