import {CHAPTERS,parseBounds,coverGeometry,scrollProgress,cameraState} from './scene-math.mjs?v=14';
import {createFrameSequence} from './frame-sequence.mjs?v=14';
import {createContinuousScene} from './continuous-scene.mjs?v=17';

// Native scrolling owns the journey. No wheel/touch interception, scroll locks,
// third-party runtime, tracking, storage, backend calls, or generated shop links.
const asset=(relative)=>new URL(relative,import.meta.url).href;
const story=document.querySelector('#aquarium-story');
if(story)initializeStory(story);

function initializeStory(story) {
  const stage=story.querySelector('.story-stage');
  const camera=story.querySelector('.room-camera');
  const photo=story.querySelector('.room-photo img');
  const windowLayer=story.querySelector('.tank-window');
  const underwater=story.querySelector('.underwater-backdrop');
  const copies=[...story.querySelectorAll('.story-copy[data-chapter]')];
  const navigation=story.querySelector('.story-chapters');
  const buttons=[...story.querySelectorAll('[data-story-chapter]')];
  const toggle=document.querySelector('#story-motion-toggle');
  const progressLabel=story.querySelector('[data-story-progress]');
  const fishes=[...story.querySelectorAll('.fish')];
  const components=document.querySelector('#shop-components');
  if(!stage||!camera||!photo||!windowLayer||!underwater||!components)return;

  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const mobile=matchMedia(story.dataset.mobileQuery||story.querySelector('.room-photo source[media]')?.getAttribute('media')||'(max-width: 700px)');
  let initialized=false,manualPaused=false,compact=reduce.matches;
  let measureNeeded=true,dirty=true,visible=true,raf=0,lastTime=0,fishTime=0;
  let currentScroll=window.scrollY,geometry=null,underwaterAspect=1.5;
  let metrics={top:0,travel:0},lastChapter=-1,staticChapter=1,lastProgress=0,lastCameraTime=0;
  const reduced=()=>reduce.matches || manualPaused;
  const frame=()=>{if(!raf&&!document.hidden)raf=requestAnimationFrame(render);};
  const frameUrls=['assets/underwater.webp','assets/frames/frame-03.webp',
    'assets/discovery/03-filter-glimpse.webp','assets/discovery/04-filter-reveal.webp',
    'assets/discovery/05-fish-glimpse.webp','assets/discovery/06-fish-reveal.webp',
    'assets/discovery/07-shrimp-glimpse.webp','assets/discovery/08-shrimp-reveal.webp',
    'assets/discovery/09-surface-rise.webp','assets/discovery/10-surface-only.webp'].map(asset);
  const sequence=createFrameSequence({
    first:story.querySelector('.interior-frame-a'),second:story.querySelector('.interior-frame-b'),
    urls:frameUrls,focusPoints:[.5,.5,.40,.41,.52,.5,.49,.47,.5,.5],onReady:()=>{dirty=true;frame();}
  });
  // The image player is only a discrete fallback. The enhanced interior is
  // one persistent world: moving the camera changes depth and occlusion.
  const worldCanvas=story.querySelector('.continuous-scene');
  const texture=(name)=>asset(`assets/grounded-v14/${name}${mobile.matches?'-mobile':''}.webp`);
  const world=createContinuousScene(worldCanvas,{
    urls:{background:asset('assets/underwater.webp'),foliage:texture('foliage'),
      filter:texture('filter'),fish:asset('assets/fish.webp'),
      shrimp:texture('shrimp-plant'),surface:asset('assets/discovery/10-surface-only.webp'),sand:texture('sand')},
    preloaded:{background:underwater,fish:story.querySelector('.tank-fish')},
    onReady:({status,error})=>{
      worldCanvas.dataset.sceneStatus=status;
      if(error)worldCanvas.dataset.sceneError=error;else delete worldCanvas.dataset.sceneError;
      dirty=true;frame();
    }
  });
  if(progressLabel){progressLabel.setAttribute('aria-live','polite');progressLabel.setAttribute('aria-atomic','true');}

  // Narration changes only at chapter boundaries, never on every animation frame.
  function selectChapter(index) {
    index=Math.max(0,Math.min(CHAPTERS.length-1,index));
    if(index===lastChapter)return;
    lastChapter=index;const selected=CHAPTERS[index];
    story.dataset.currentChapter=selected.id;
    for(const copy of copies){
      const active=copy.dataset.chapter===selected.id;
      copy.classList.toggle('is-current',active);
      copy.setAttribute('aria-hidden',String(!active));
      copy.inert=!active;
      if(!copy.id)copy.id='story-copy-'+copy.dataset.chapter;
    }
    for(const button of buttons){
      const active=button.dataset.storyChapter===selected.id;
      if(active)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
      const copy=copies.find(item=>item.dataset.chapter===button.dataset.storyChapter);
      if(copy)button.setAttribute('aria-controls',copy.id);
    }
    if(progressLabel){const numbers=new Intl.NumberFormat('ar-SA');progressLabel.textContent=`${numbers.format(index+1)} / ${numbers.format(CHAPTERS.length)} · ${selected.label}`;}
  }

  function measure() {
    const width=stage.clientWidth,height=stage.clientHeight;
    if(!photo.naturalWidth||!photo.naturalHeight||!width||!height)return false;
    const bounds=parseBounds(mobile.matches?story.dataset.tankMobile:story.dataset.tankDesktop);
    const position=(mobile.matches?story.dataset.photoPositionMobile:story.dataset.photoPositionDesktop)||'.5,.5';
    const [positionX=.5,positionY=.5]=position.split(/[\s,]+/).map(Number);
    geometry=coverGeometry({width,height,imageWidth:photo.naturalWidth,imageHeight:photo.naturalHeight,bounds,positionX:Number.isFinite(positionX)?positionX:.5,positionY:Number.isFinite(positionY)?positionY:.5});
    if(underwater.naturalWidth&&underwater.naturalHeight)underwaterAspect=underwater.naturalWidth/underwater.naturalHeight;
    // All layout reads precede the geometry writes. Coordinates refer to the
    // untransformed camera parent; transform-origin must stay at its center.
    metrics.top=story.getBoundingClientRect().top+window.scrollY;
    metrics.travel=Math.max(0,story.offsetHeight-height);
    const controlsHeight=story.querySelector('.story-toolbar')?.offsetHeight||134;
    const {tank}=geometry;
    windowLayer.style.left=tank.x+'px';windowLayer.style.top=tank.y+'px';
    windowLayer.style.width=tank.width+'px';windowLayer.style.height=tank.height+'px';
    story.style.setProperty('--story-controls-height',controlsHeight+'px');
    sequence?.resize({width,height,mobile:mobile.matches});
    world?.resize(width,height,{mobile:mobile.matches,entryScale:cameraState(.48,geometry,underwaterAspect).underwaterScale});
    measureNeeded=false;return true;
  }

  function setVariable(name,value){story.style.setProperty(name,String(value));}
  function paint(state) {
    setVariable('--story-progress',state.progress);
    setVariable('--narration-opacity',state.narrationOpacity);
    setVariable('--scene-shade-opacity',state.shadeOpacity);
    const inkStart=[16,43,70],inkEnd=[247,248,239];
    setVariable('--scene-ink',`rgb(${inkStart.map((v,i)=>Math.round(v+(inkEnd[i]-v)*state.inkBlend)).join(' ')})`);
    setVariable('--camera-scale',state.scale);
    setVariable('--camera-x',state.x+'px');setVariable('--camera-y',state.y+'px');
    setVariable('--room-opacity',state.roomOpacity);setVariable('--window-opacity',state.windowOpacity);
    setVariable('--underwater-opacity',state.underwaterOpacity);setVariable('--immersion-opacity',state.immersionOpacity);
    setVariable('--underwater-scale',state.underwaterScale);
    const worldReady=world?.isReady()??false;
    // A fallback changes only on explicit chapter selection. Never blend whole
    // photographs to stand in for movement through the enhanced world.
    const fallbackIndex=Math.round(cameraState(CHAPTERS[state.chapter].target,geometry,underwaterAspect).sequencePosition);
    const sequenceReady=!worldReady&&sequence?.update(fallbackIndex,{active:visible&&state.chapter>=2,preload:false});
    const sequenceOpacity=sequenceReady?state.interiorOpacity:0;
    const worldOpacity=worldReady?state.interiorOpacity:0;
    setVariable('--interior-opacity',sequenceOpacity);
    setVariable('--continuous-opacity',worldOpacity);
    setVariable('--entry-opacity',Math.max(sequenceOpacity,worldOpacity)>=1?0:1);
    setVariable('--interior-scale',state.interiorScale);
    setVariable('--fish-school-opacity',worldReady?0:state.fishOpacity);
    setVariable('--underwater-x',state.underwaterX+'px');setVariable('--underwater-y',state.underwaterY+'px');
    setVariable('--sand-focus',state.sand);setVariable('--plants-focus',state.plants);setVariable('--filter-focus',state.filter);
    selectChapter(state.chapter);
    for(const copy of copies){
      const available=copy.dataset.chapter===CHAPTERS[state.chapter].id&&state.narrationOpacity>.12;
      const hidden=String(!available);
      if(copy.getAttribute('aria-hidden')!==hidden)copy.setAttribute('aria-hidden',hidden);
      if(copy.inert===available)copy.inert=!available;
    }
  }
  function staticState() {
    const target=CHAPTERS[staticChapter].target;
    const state=cameraState(target,geometry,underwaterAspect);
    const detail=staticChapter>=2,surface=staticChapter===CHAPTERS.length-1;
    return {...state,scale:1,x:0,y:0,roomOpacity:staticChapter===0?1:0,underwaterOpacity:staticChapter===0?0:1,windowOpacity:1,immersionOpacity:0,underwaterScale:1,underwaterX:0,underwaterY:0,chapter:staticChapter,narrationOpacity:1,shadeOpacity:staticChapter===0||surface?0:1,inkBlend:staticChapter===0?0:1,interiorOpacity:detail?1:0,interiorScale:detail?state.interiorScale:1,sequencePosition:detail?Math.round(state.sequencePosition):0,fishOpacity:detail?0:1,surfaceRippleOpacity:0};
  }
  function resetFish(){for(const fish of fishes){fish.style.setProperty('--fish-x','0px');fish.style.setProperty('--fish-y','0px');fish.style.setProperty('--fish-roll','0deg');}}
  function swim(time) {
    fishes.forEach((fish,index)=>{
      const phase=time*(.24+index*.035)+index*2.3;
      fish.style.setProperty('--fish-x',(Math.sin(phase)*(14+index*4)).toFixed(2)+'px');
      fish.style.setProperty('--fish-y',(Math.sin(phase*.76+index)*5).toFixed(2)+'px');
      fish.style.setProperty('--fish-roll',(Math.cos(phase*.76)*1.2).toFixed(2)+'deg');
    });
  }
  function render(time) {
    raf=0;if(document.hidden||!initialized)return;
    if(measureNeeded&&!measure())return;
    let state,cameraMoving=false;
    if(reduced()){state=staticState();lastCameraTime=0;}
    else{
      const target=scrollProgress(currentScroll,metrics.top,metrics.travel);
      // Follow one continuous scroll coordinate. Short wheel steps become a
      // camera movement, without adding a new easing restart at each chapter.
      const elapsed=lastCameraTime?Math.min(64,time-lastCameraTime):0;
      if(!lastCameraTime)lastProgress=target;
      lastProgress+=(target-lastProgress)*(1-Math.exp(-elapsed/80));
      if(Math.abs(target-lastProgress)<.00001)lastProgress=target;
      cameraMoving=target!==lastProgress;
      lastCameraTime=time;
      state=cameraState(lastProgress,geometry,underwaterAspect);
      if(cameraMoving)dirty=true;
    }
    if(dirty){paint(state);dirty=false;}
    const swimActive=!reduced()&&visible&&(state.roomOpacity>.02||state.fishOpacity>.02)&&fishes.length>0;
    if(swimActive){if(lastTime)fishTime+=Math.min(48,time-lastTime)/1000;lastTime=time;swim(fishTime);frame();}
    else lastTime=0;
    if(visible){
      world?.load();
      if(world?.isReady()&&state.interiorOpacity>0){
        world.draw(state.progress,time,{motion:!reduced()});
        if(!reduced())frame();
      }
    }
    if(cameraMoving&&visible&&!reduced())frame();
  }

  function motionLabel() {
    if(!toggle)return;
    const paused=reduced();toggle.setAttribute('aria-pressed',String(paused));
    toggle.disabled=reduce.matches;
    const label=toggle.querySelector('[data-motion-label]');
    const fullLabel=reduce.matches?'الحركة متوقفة حسب إعدادات جهازك':manualPaused?'تشغيل الرحلة بالتمرير':'إيقاف الحركة';
    const text=reduce.matches?'الحركة متوقفة':manualPaused?'تشغيل الحركة':'إيقاف الحركة';
    toggle.setAttribute('aria-label',fullLabel);
    if(label)label.textContent=text;else toggle.textContent=text;
    const icon=toggle.querySelector('[data-motion-icon]');if(icon){icon.dataset.state=paused?'play':'pause';icon.innerHTML=paused?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7Z"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>';}
  }
  function applyMode({preservePosition=false}={}) {
    const before=story.getBoundingClientRect(),oldHeight=story.offsetHeight,oldScroll=window.scrollY;
    const nextCompact=reduced(),changed=compact!==nextCompact;
    compact=nextCompact;
    story.classList.toggle('is-reduced-motion',reduce.matches);
    story.classList.toggle('is-motion-paused',manualPaused);
    if(changed && nextCompact)staticChapter=Math.max(0,lastChapter);
    motionLabel();resetFish();lastTime=lastCameraTime=0;measureNeeded=dirty=true;
    if(preservePosition&&changed){
      // Shortening a pinned section must not strand the reader far below it.
      const top=before.top+oldScroll;
      if(before.top<=stage.clientHeight&&before.bottom>0)window.scrollTo({top:Math.max(0,top),behavior:'instant'});
      else if(before.bottom<=0)window.scrollTo({top:Math.max(0,oldScroll+story.offsetHeight-oldHeight),behavior:'instant'});
    }
    currentScroll=window.scrollY;frame();
  }
  function start() {
    if(initialized||!photo.complete||!underwater.complete||!photo.naturalWidth||!underwater.naturalWidth)return;
    initialized=true;
    // The non-enhanced HTML is one ordinary room scene followed by shopping.
    // Only a working, decoded photographic sequence receives the tall journey.
    story.classList.add('is-enhanced');
    document.documentElement.classList.remove('story-pending');
    if(toggle)toggle.hidden=false;if(navigation)navigation.hidden=false;
    applyMode();
  }

  window.addEventListener('scroll',()=>{currentScroll=window.scrollY;dirty=true;frame();},{passive:true});
  const resized=()=>{lastCameraTime=0;measureNeeded=dirty=true;frame();};
  window.addEventListener('resize',resized,{passive:true});
  window.addEventListener('pageshow',()=>{currentScroll=window.scrollY;resized();});
  if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(resized);observer.observe(stage);observer.observe(story);const toolbar=story.querySelector('.story-toolbar');if(toolbar)observer.observe(toolbar);}
  if(typeof IntersectionObserver!=='undefined'){
    const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;lastTime=lastCameraTime=0;dirty=true;frame();},{threshold:0});observer.observe(stage);
  }
  document.addEventListener('visibilitychange',()=>{lastTime=lastCameraTime=0;if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;}else{currentScroll=window.scrollY;dirty=true;frame();}});
  reduce.addEventListener('change',()=>applyMode({preservePosition:initialized}));
  mobile.addEventListener('change',resized);
  photo.addEventListener('load',()=>{resized();start();});underwater.addEventListener('load',()=>{resized();start();});
  const releasePending=()=>document.documentElement.classList.remove('story-pending');
  photo.addEventListener('error',releasePending,{once:true});underwater.addEventListener('error',releasePending,{once:true});
  for(const button of buttons)button.addEventListener('click',()=>{
    const index=CHAPTERS.findIndex(chapter=>chapter.id===button.dataset.storyChapter);if(index<0||!initialized)return;
    if(reduced()){staticChapter=index;dirty=true;frame();window.scrollTo({top:metrics.top,behavior:'instant'});}
    else{if(measureNeeded)measure();window.scrollTo({top:metrics.top+CHAPTERS[index].target*metrics.travel,behavior:'smooth'});}
  });
  if(toggle)toggle.addEventListener('click',()=>{if(reduce.matches)return;manualPaused=!manualPaused;applyMode({preservePosition:true});});
  start();
}
