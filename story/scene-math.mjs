/** Pure photo/camera geometry. Tank bounds are fractions of the uncropped photo. */
export const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,value));
export const mix=(a,b,t)=>a+(b-a)*t;
export const smooth=(value,start,end)=>{const t=clamp((value-start)/(end-start));return t*t*(3-2*t);};
export const CHAPTERS=Object.freeze([
  {id:'room',label:'الغرفة',target:.04},
  {id:'dive',label:'داخل الحوض',target:.53},
  {id:'sand',label:'الرمل',target:.65},
  {id:'plants',label:'النباتات',target:.79},
  {id:'filtration',label:'الفلترة',target:.94},
]);
export function parseBounds(value,fallback=[.198,.353,.601,.320]) {
  const parts=typeof value==='string'?value.split(/[\s,]+/).filter(Boolean).map(Number):value;
  return Array.isArray(parts)&&parts.length===4&&parts.every(Number.isFinite)&&parts[0]>=0&&parts[1]>=0&&parts[2]>0&&parts[3]>0&&parts[0]+parts[2]<=1.001&&parts[1]+parts[3]<=1.001?parts.slice():fallback.slice();
}
export function coverGeometry({width,height,imageWidth,imageHeight,bounds,positionX=.5,positionY=.5}) {
  if(![width,height,imageWidth,imageHeight].every(v=>Number.isFinite(v)&&v>0))throw new RangeError('Photo and stage dimensions must be positive');
  const [x,y,w,h]=parseBounds(bounds),coverScale=Math.max(width/imageWidth,height/imageHeight);
  const renderedWidth=imageWidth*coverScale,renderedHeight=imageHeight*coverScale;
  const offsetX=(width-renderedWidth)*clamp(positionX),offsetY=(height-renderedHeight)*clamp(positionY);
  const tank={x:offsetX+x*renderedWidth,y:offsetY+y*renderedHeight,width:w*renderedWidth,height:h*renderedHeight};
  return {width,height,imageWidth,imageHeight,coverScale,renderedWidth,renderedHeight,tank};
}
export function scrollProgress(scrollY,storyTop,travel) {return travel>0?clamp((scrollY-storyTop)/travel):0;}
export function chapterIndex(progress) {const p=clamp(progress);return p<.15?0:p<.58?1:p<.72?2:p<.86?3:4;}
export function cameraState(progress,geometry,underwaterAspect=1.5) {
  const p=clamp(progress),{width,height,tank}=geometry,zoom=smooth(p,.15,.48);
  const targetScale=Math.max(width/tank.width,height/tank.height)*1.015;
  const scale=Math.exp(Math.log(targetScale)*zoom);
  const x=(width/2-(tank.x+tank.width/2))*scale*zoom;
  const y=(height/2-(tank.y+tank.height/2))*scale*zoom;
  // Match the object-fit:cover crop in the enlarged tank window exactly before
  // fading to the full-stage underwater photograph (same source image).
  const aspect=Number.isFinite(underwaterAspect)&&underwaterAspect>0?underwaterAspect:1.5;
  const sourceCover=Math.max(tank.width/aspect,tank.height);
  const stageCover=Math.max(width/aspect,height);
  const underwaterBaseScale=sourceCover*targetScale/stageCover;
  const immersion=smooth(p,.48,.56);
  const sand=smooth(p,.58,.65)*(1-smooth(p,.69,.75));
  const plants=smooth(p,.72,.79)*(1-smooth(p,.83,.89));
  const filter=smooth(p,.86,.94);
  return {
    progress:p,chapter:chapterIndex(p),scale,x,y,
    narrationOpacity:p<.15?1-smooth(p,.07,.15):p<.58?smooth(p,.42,.50):1,
    shadeOpacity:smooth(p,.31,.49),inkBlend:smooth(p,.31,.43),
    targetScale,windowOpacity:1,roomOpacity:1-immersion,underwaterOpacity:immersion,
    immersionOpacity:smooth(p,.30,.48)*.12,
    underwaterScale:mix(underwaterBaseScale,1,smooth(p,.56,.64))*(1+.12*sand+.22*plants+.10*filter),
    underwaterX:width*(-.025*sand+.055*plants-.02*filter),
    underwaterY:height*(-.035*sand+.015*plants),
    sand,plants,filter,
  };
}
