/** Photographic 2D illustration. Public design prototype; estimates are calculated locally. */
export function createTankScene(host, initial) {
  const tank=host.querySelector('.aq-photo-aquarium');
  let config=structuredClone(initial), angle=0;
  const update=next=>{
    config=structuredClone(next);
    const mobile=host.clientWidth<450;
    const availableWidth=Math.max(130,host.clientWidth-(mobile?64:110));
    const availableHeight=Math.min(mobile?205:390,host.clientHeight-(mobile?150:170));
    const scale=Math.min(availableWidth/120,availableHeight/65,availableWidth/(config.length+config.width*.28+18),availableHeight/(config.height+12));
    tank.style.setProperty('--tank-width',`${config.length*scale}px`);
    tank.style.setProperty('--tank-height',`${config.height*scale}px`);
    tank.style.setProperty('--tank-depth',`${Math.max(8,config.width*scale*.28)}px`);
    tank.style.setProperty('--glass-tint',config.glass==='ultra'?'rgba(170,196,190,.4)':'rgba(83,132,113,.7)');
    host.querySelector('.aq-size-x').textContent=`${config.length} سم`;
    host.querySelector('.aq-size-y').textContent=`${config.height} سم`;
    host.querySelector('.aq-size-depth').textContent=`العمق ${config.width} سم`;
    for(const part of ['plants','filter','light'])host.querySelector(`.aq-photo-${part}`).hidden=!config.addons[part];
    host.setAttribute('aria-label',`تصور حوض ${config.length} في ${config.width} في ${config.height} سنتيمتر، ${config.glass==='ultra'?'زجاج فائق الصفاء':'زجاج صافي'}، ${config.addons.plants?'مع نباتات':'بدون نباتات'}`);
  };
  const orient=()=>{tank.style.transform=`rotateY(${angle}deg)`;};
  new ResizeObserver(()=>update(config)).observe(host);
  update(config);
  return {update,pause(value){host.classList.toggle('is-paused',value);},rotate(delta){angle=Math.min(16,Math.max(-16,angle+delta*20));orient();},reset(){angle=0;orient();}};
}
