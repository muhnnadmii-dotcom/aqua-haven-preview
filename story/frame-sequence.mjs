// Two decoded image layers blend adjacent camera views. Keep only nearby
// decoded images in our cache; reverse scrolling reuses the browser's HTTP cache.
export function frameObjectPosition({width,height,imageWidth,imageHeight,focusX=.5,mobile=false}){
  if(!mobile||![width,height,imageWidth,imageHeight].every(v=>Number.isFinite(v)&&v>0))return '50% 50%';
  const renderedWidth=imageWidth*Math.max(width/imageWidth,height/imageHeight);
  const excess=renderedWidth-width;
  const position=excess>0?Math.max(0,Math.min(1,(focusX*renderedWidth-width/2)/excess)):.5;
  return `${position*100}% 50%`;
}
export function createFrameSequence({first,second,urls,focusPoints=[],onReady}) {
  if(!first||!second||!Array.isArray(urls)||urls.length<2)return null;
  const cache=new Map();
  let desired=0,applied=false,enabled=true,layout={width:0,height:0,mobile:false};
  const bounded=value=>Math.max(0,Math.min(urls.length-1,Number(value)||0));
  function ensure(index){
    if(cache.has(index))return cache.get(index);
    const item={image:new Image(),ready:false,failed:false};cache.set(index,item);
    item.image.decoding='async';
    item.image.onload=async()=>{
      try{await item.image.decode();}catch{}
      item.ready=item.image.naturalWidth>0;
      apply();onReady?.();
    };
    item.image.onerror=()=>{item.failed=true;onReady?.();};
    item.image.src=urls[index];
    return item;
  }
  function apply(){
    const low=Math.floor(desired),high=Math.ceil(desired);
    if(!cache.get(low)?.ready||!cache.get(high)?.ready)return;
    if(first.getAttribute('src')!==urls[low])first.src=urls[low];
    if(second.getAttribute('src')!==urls[high])second.src=urls[high];
    first.style.objectPosition=frameObjectPosition({...layout,imageWidth:cache.get(low).image.naturalWidth,imageHeight:cache.get(low).image.naturalHeight,focusX:focusPoints[low]??.5});
    second.style.objectPosition=frameObjectPosition({...layout,imageWidth:cache.get(high).image.naturalWidth,imageHeight:cache.get(high).image.naturalHeight,focusX:focusPoints[high]??.5});
    first.style.opacity='1';second.style.opacity=String(high===low?0:desired-low);
    applied=true;
    for(const index of cache.keys())if(index<low-1||index>high+1)cache.delete(index);
  }
  function update(position,{active=true,preload=true}={}){
    enabled=active;if(!enabled)return applied;
    desired=bounded(position);
    const low=Math.floor(desired),high=Math.ceil(desired);
    ensure(low);ensure(high);
    if(preload&&high+1<urls.length)ensure(high+1);
    apply();return applied;
  }
  function warm(){if(!enabled)return;ensure(0);ensure(1);}
  return {update,warm,resize:next=>{layout=next;apply();},isReady:()=>applied,count:urls.length};
}
