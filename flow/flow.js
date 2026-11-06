// Native, reversible handoff. Reuses the existing renderer and original pause
// button. No wheel interception, storage, network calls, or background loop.
const body=document.body;
const story=document.querySelector('#aquarium-story');
const stage=story?.querySelector('.story-stage');
const threshold=document.querySelector('.flow-threshold');
const panel=threshold?.querySelector('.flow-tide-panel');
const dock=threshold?.querySelector('.flow-motion-dock');
const toggle=document.querySelector('#story-motion-toggle');
const catalog=document.querySelector('#flow-catalog');
const header=document.querySelector('.ah-header');
if(story&&stage&&threshold&&panel&&dock&&toggle&&catalog)initialize();

function initialize(){
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const toggleHome=document.createComment('Original journey motion control');
  toggle.before(toggleHome);
  const originalStageInert=stage.inert;
  let enabled=false,pinned=false,docked=false,raf=0,needMeasure=true;
  let geometry={start:0,end:0,dockEnd:0},lastPanel=-1;
  const clamp=(value)=>Math.max(0,Math.min(1,value));
  const schedule=()=>{if(!raf&&!document.hidden)raf=requestAnimationFrame(render);};
  function classState(name,state){if(body.classList.contains(name)!==state)body.classList.toggle(name,state);}
  function unpin(){
    if(pinned){pinned=false;classState('flow-water-pinned',false);}
  }
  function restoreToggle({focusCatalog=false}={}){
    if(!docked)return;
    const wasFocused=document.activeElement===toggle;
    toggleHome.after(toggle);docked=false;classState('flow-dock-active',false);
    if(wasFocused&&focusCatalog)catalog.focus({preventScroll:true});
  }
  function setEnabled(next){
    if(next===enabled)return;
    enabled=next;classState('flow-enhanced',next);needMeasure=true;
    if(!next){
      unpin();restoreToggle();stage.inert=originalStageInert;panel.inert=false;
      panel.style.removeProperty('--flow-panel-y');lastPanel=-1;
      body.dataset.flowState='static';delete body.dataset.flowProgress;
    }
  }
  function measure(){
    // Batch geometry reads. Pinning does not alter the story's normal-flow box.
    const viewport=stage.clientHeight;
    const y=window.scrollY;
    const storyTop=story.getBoundingClientRect().top+y;
    const thresholdTop=threshold.getBoundingClientRect().top+y;
    const thresholdHeight=threshold.offsetHeight;
    const headerHeight=header?.getBoundingClientRect().height||0;
    const catalogTop=catalog.getBoundingClientRect().top+y;
    geometry={start:storyTop+Math.max(0,story.offsetHeight-viewport),
      end:thresholdTop+Math.max(1,thresholdHeight-viewport),
      dockEnd:Math.max(thresholdTop,catalogTop-headerHeight-48)};
    body.style.setProperty('--flow-header-height',headerHeight+'px');
    needMeasure=false;
  }
  function render(){
    raf=0;
    const next=story.classList.contains('is-enhanced')&&
      !story.classList.contains('is-motion-paused')&&
      !story.classList.contains('is-reduced-motion')&&!reduce.matches;
    setEnabled(next);
    if(!enabled)return;
    if(needMeasure)measure();
    const y=window.scrollY;
    const p=clamp((y-geometry.start)/Math.max(1,geometry.end-geometry.start));
    const shouldPin=y>=geometry.start&&y<geometry.end;
    const shouldDock=y>=geometry.start&&y<geometry.dockEnd;
    if(shouldPin!==pinned){pinned=shouldPin;classState('flow-water-pinned',pinned);}
    if(shouldDock&&!docked){
      dock.append(toggle);docked=true;classState('flow-dock-active',true);
    }else if(!shouldDock&&docked)restoreToggle({focusCatalog:y>=geometry.dockEnd});
    // No competing alpha dissolve. A continuous paper surface physically rises
    // over the same water; it is fully solid before the old stage is unpinned.
    const percent=Math.round((1-p)*10000)/100;
    if(percent!==lastPanel){panel.style.setProperty('--flow-panel-y',percent+'%');lastPanel=percent;}
    panel.inert=p<.98;
    stage.inert=shouldDock||originalStageInert;
    body.dataset.flowState=shouldPin?'handoff':y<geometry.start?'journey':'shop';
    body.dataset.flowProgress=p.toFixed(3);
  }
  const remeasure=()=>{needMeasure=true;schedule();};
  new MutationObserver(remeasure).observe(story,{attributes:true,attributeFilter:['class']});
  if(typeof ResizeObserver!=='undefined'){
    const observer=new ResizeObserver(remeasure);
    observer.observe(story);observer.observe(threshold);if(header)observer.observe(header);
  }
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',remeasure,{passive:true});
  window.addEventListener('pageshow',remeasure);
  reduce.addEventListener('change',remeasure);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;}else remeasure();
  });
  schedule();
}
