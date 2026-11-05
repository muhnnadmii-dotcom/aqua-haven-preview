/* The aquarium is one stationary world. Scroll changes only this camera pose. */
export const clamp01=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(p,a,b)=>{const t=clamp01((p-a)/(b-a));return t*t*(3-2*t);};
const freezeVector=value=>Object.freeze(value);
export const SCENE_ANCHORS=Object.freeze({
  filter:freezeVector([-2.4,.1,1.2]),
  fish:freezeVector([.6,-.05,-4.2]),
  shrimp:freezeVector([-1.4,-.45,-10.1]),
  surface:freezeVector([0,5.8,-7]),
  background:freezeVector([0,0,-34]),
  filterCurtain:freezeVector([-1.8,.1,4]),
  fishCurtain:freezeVector([-.8,.05,-1.9]),
  shrimpCurtain:freezeVector([-.2,-.05,-7.5]),
});
export const CAMERA_PATH=Object.freeze([
  [.48,[0,0,12],[0,0,-34]],
  [.53,[-.25,.02,10],[-.1,.15,-18]],
  [.575,[-1.9,.04,8.1],[-1.9,0,1.2]],
  [.645,[-3.8,.05,5.7],[-2,0,1.2]],
  [.69,[-4,.03,3.6],[-.25,.4,-4.2]],
  [.775,[2.4,0,-.1],[1,.4,-4.2]],
  [.82,[2.4,-.1,-2.9],[-.9,.05,-10.1]],
  [.895,[-2.3,-.45,-6.5],[-1,.05,-10.1]],
  [.925,[-2.55,.2,-6.85],[-1.5,2,-10.4]],
  [.965,[-1.9,1.55,-7.1],[-1.8,8,-7.5]],
  [.985,[-1.6,2.3,-7.2],[-1.6,9,-7.45]],
  [1,[-1.5,2.4,-7.25],[-1.5,10,-7.5]],
].map(([progress,position,target])=>Object.freeze({progress,position:freezeVector(position),target:freezeVector(target)})));

function tangent(index,key,dimension){
  const before=CAMERA_PATH[Math.max(0,index-1)],after=CAMERA_PATH[Math.min(CAMERA_PATH.length-1,index+1)];
  if(index===0)return 0;
  const speed=(after[key][dimension]-before[key][dimension])/(after.progress-before.progress);
  if(key==='position'&&dimension===2){
    // A harmonic-mean slope preserves forward travel without cubic overshoot.
    if(index===CAMERA_PATH.length-1)return speed;
    const current=CAMERA_PATH[index];
    const left=(current.position[2]-before.position[2])/(current.progress-before.progress);
    const right=(after.position[2]-current.position[2])/(after.progress-current.progress);
    if(left*right<=0)return 0;
    return 2*left*right/(left+right);
  }
  return speed;
}
function samplePath(progress,key){
  if(progress<=CAMERA_PATH[0].progress)return CAMERA_PATH[0][key].slice();
  const last=CAMERA_PATH.at(-1);
  if(progress>=last.progress)return last[key].slice();
  let next=1;while(progress>CAMERA_PATH[next].progress)next++;
  const a=CAMERA_PATH[next-1],b=CAMERA_PATH[next],dt=b.progress-a.progress,t=(progress-a.progress)/dt;
  const h00=2*t*t*t-3*t*t+1,h10=t*t*t-2*t*t+t,h01=-2*t*t*t+3*t*t,h11=t*t*t-t*t;
  return a[key].map((v,d)=>h00*v+h10*dt*tangent(next-1,key,d)+h01*b[key][d]+h11*dt*tangent(next,key,d));
}
const subtract=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const normalized=v=>{const length=Math.hypot(...v)||1;return v.map(x=>x/length);};
export function viewMatrix(position,target,up=[0,1,0]){
  const z=normalized(subtract(position,target)),x=normalized(cross(up,z)),y=cross(z,x);
  return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,position),-dot(y,position),-dot(z,position),1]);
}
export function projectionMatrix(fov,aspect,near=.08,far=180){
  const f=1/Math.tan(fov/2),range=1/(near-far);
  return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(near+far)*range,-1,0,0,2*near*far*range,0]);
}
export function multiplyMatrices(a,b){
  const result=new Float32Array(16);
  for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)result[col*4+row]+=a[k*4+row]*b[col*4+k];
  return result;
}
export function continuousCamera(progress,{aspect=16/10,mobile=aspect<.9,entryScale=1.43}={}){
  const p=clamp01(progress),position=samplePath(p,'position'),target=samplePath(p,'target');
  const discovery=smooth(p,.53,.60)*(1-smooth(p,.915,.965));
  if(mobile){
    target[0]-=.4*discovery;target[1]+=.35*discovery;
    // The leaf stays anchored. Portrait framing follows the actual shrimp,
    // whose body sits to the right of the full leaf texture's center.
    const shrimpFocus=smooth(p,.82,.875)*(1-smooth(p,.915,.965));
    target[0]+=.76*shrimpFocus;
  }
  const fov=(mobile?66:42)*Math.PI/180;
  const view=viewMatrix(position,target),projection=projectionMatrix(fov,Math.max(.1,aspect));
  const initialVisibleHeight=2*(12-SCENE_ANCHORS.background[2])*Math.tan(fov/2);
  const initialCoverHeight=Math.max(initialVisibleHeight,initialVisibleHeight*aspect/2);
  return {progress:p,position,target,up:[0,1,0],fov,aspect,near:.08,far:180,view,projection,viewProjection:multiplyMatrices(projection,view),backgroundHeight:initialCoverHeight*Math.max(1,entryScale)};
}
export function projectPoint(point,camera,{width=1,height=1}={}){
  const m=camera.viewProjection,x=point[0],y=point[1],z=point[2];
  const clipX=m[0]*x+m[4]*y+m[8]*z+m[12],clipY=m[1]*x+m[5]*y+m[9]*z+m[13];
  const clipZ=m[2]*x+m[6]*y+m[10]*z+m[14],w=m[3]*x+m[7]*y+m[11]*z+m[15];
  const ndcX=clipX/w,ndcY=clipY/w,depth=clipZ/w;
  return {x:(ndcX*.5+.5)*width,y:(.5-ndcY*.5)*height,ndcX,ndcY,depth,w,visible:w>0&&Math.abs(ndcX)<=1&&Math.abs(ndcY)<=1&&depth>=-1&&depth<=1};
}
