import {continuousCamera,SCENE_ANCHORS} from './camera-math-v13.mjs?v=13';

// One photographic multiplane aquarium, one continuous perspective camera.
// Every object is installed once, at a stable world position. Scroll never
// substitutes a chapter image, teleports an object, or fades a discovered animal.
const DEFAULT_URLS=Object.freeze({
  background:'assets/underwater.webp',foliage:'assets/grounded-v14/foliage.webp',
  filter:'assets/grounded-v14/filter.webp',fish:'assets/fish.webp',
  shrimp:'assets/grounded-v14/shrimp-plant.webp',surface:'assets/discovery/10-surface-only.webp',
  sand:'assets/grounded-v14/sand.webp',
});
export const GROUND_Y=-2.8;
// Measured image-space contacts use top-down normalized coordinates. Keeping
// these separate from the model makes asset calibration explicit and reviewable.
export const ASSET_CALIBRATION=Object.freeze({
  foliage:Object.freeze({root:Object.freeze([439/1024,1502/1536])}),
  shrimp:Object.freeze({root:Object.freeze([603/1024,1502/1536]),body:Object.freeze([.667,.30]),bodyWorldOffset:Object.freeze([.8,.05,0])}),
  // The glass bend passes over the rim. Its outer apex is above the waterline;
  // pinning the apex itself to the waterline would submerge the mounting rim.
  filter:Object.freeze({rim:Object.freeze([.55,.065]),bendTop:Object.freeze([574/1024,25/1536]),strainer:Object.freeze([454/1024,1516/1536]),cups:Object.freeze([[.36,.246],[.365,.482]]),strainerY:-1.325}),
});
function modelMatrix(center,width,height,{rotation=0,tilt=0,horizontal=false,mirror=false}={}){
  const cz=Math.cos(rotation),sz=Math.sin(rotation),cy=Math.cos(tilt),sy=Math.sin(tilt);
  let matrix;
  if(horizontal){
    matrix=new Float32Array([width,0,0,0,0,0,-height,0,0,1,0,0,center[0],center[1],center[2],1]);
  }else{
    matrix=new Float32Array([cz*cy*width,sz*cy*width,-sy*width,0,-sz*height,cz*height,0,0,cz*sy,sz*sy,cy,0,center[0],center[1],center[2],1]);
  }
  if(mirror)for(let row=0;row<4;row++)matrix[row]*=-1;
  return matrix;
}

// Return the model center that puts a photographed point at an exact world pin.
// Rotation, tilt and mirroring are included; center-minus-half-height is not
// sufficient for a rotated stem, rock contact, or hanging filter assembly.
export function rootPin(worldPin,topDownUV,width,height,orientation={}){
  const basis=modelMatrix([0,0,0],width,height,orientation);
  const x=topDownUV[0]-.5,y=.5-topDownUV[1];
  return worldPin.map((value,row)=>value-basis[row]*x-basis[4+row]*y);
}
export function texturePointToWorld(object,topDownUV){
  const m=object.model||modelMatrix(object.center,object.width,object.height,object);
  const x=topDownUV[0]-.5,y=.5-topDownUV[1];
  return [0,1,2].map(row=>m[row]*x+m[4+row]*y+m[12+row]);
}

export function sceneObjects({backgroundHeight=56,textureAspects={},assetCalibration={}}={}){
  const ratio=(key,fallback)=>textureAspects[key]||fallback;
  const calibration=Object.fromEntries(Object.entries(ASSET_CALIBRATION).map(([key,value])=>[key,{...value,...assetCalibration[key]}]));
  const foliage=(id,location,requestedHeight,rotation,mirror=false,tilt=0)=>{
    const height=Math.min(7.5,requestedHeight),width=height*ratio('foliage',.64);
    const root=[location[0],GROUND_Y,location[2]],orientation={rotation,mirror,tilt};
    return {id,key:'foliage',center:rootPin(root,calibration.foliage.root,width,height,orientation),width,height,...orientation,root,rootUV:calibration.foliage.root.slice(),sway:.007,mode:1};
  };
  const body=SCENE_ANCHORS.shrimp.map((value,index)=>value+calibration.shrimp.bodyWorldOffset[index]);
  const shrimpHeight=(body[1]-GROUND_Y)/(calibration.shrimp.root[1]-calibration.shrimp.body[1]);
  const shrimpWidth=shrimpHeight*ratio('shrimp',.8);
  const shrimpRoot=[body[0]-(calibration.shrimp.body[0]-calibration.shrimp.root[0])*shrimpWidth,GROUND_Y,body[2]];
  const filterHeight=(SCENE_ANCHORS.surface[1]-calibration.filter.strainerY)/(calibration.filter.strainer[1]-calibration.filter.rim[1]);
  const filterWidth=filterHeight*ratio('filter',2/3);
  const strainer=[SCENE_ANCHORS.filter[0],calibration.filter.strainerY,SCENE_ANCHORS.filter[2]];
  const filterCenter=rootPin(strainer,calibration.filter.strainer,filterWidth,filterHeight);
  const cupX=calibration.filter.cups.reduce((total,cup)=>total+filterCenter[0]+(cup[0]-.5)*filterWidth,0)/calibration.filter.cups.length;
  const result=[
    // Geometry continues beyond the source photograph. The center's original
    // photo projection is unchanged; the extended margins meet water haze.
    {id:'planted-world',key:'background',center:SCENE_ANCHORS.background.slice(),width:backgroundHeight*ratio('background',2)*3,height:backgroundHeight*3,photoScale:3,mode:4},
    {id:'water-ceiling',key:'surface',center:SCENE_ANCHORS.surface.slice(),width:1200,height:1200,horizontal:true,mode:3},
    {id:'sand-bed',key:'sand',center:[0,GROUND_Y,-55],width:180,height:240,horizontal:true,mode:5},
    // Quiet real glass geometry: the cup mounting surface meets both the sand
    // bed and the rim, behind the photographed cups. It is transparent, not a
    // new opaque wall across the camera's route. The rim is a thin glass edge.
    {id:'intake-glass-support',key:'filter',center:[cupX,(GROUND_Y+SCENE_ANCHORS.surface[1])/2,SCENE_ANCHORS.filter[2]-.035],width:1.8,height:SCENE_ANCHORS.surface[1]-GROUND_Y,mode:6},
    {id:'aquarium-rim',key:'filter',center:[0,SCENE_ANCHORS.surface[1],SCENE_ANCHORS.filter[2]-.035],width:30,height:.022,mode:7},
    foliage('far-right-garden',[7,GROUND_Y,-17],7.5,-.15),
    foliage('far-left-garden',[-8,GROUND_Y,-15],7.3,.15,true),
    foliage('back-fern',[2.7,-1.8,-12.5],5.4,-.24,false,.04),
    {id:'shrimp-leaf',key:'shrimp',center:rootPin(shrimpRoot,calibration.shrimp.root,shrimpWidth,shrimpHeight),width:shrimpWidth,height:shrimpHeight,root:shrimpRoot,rootUV:calibration.shrimp.root.slice(),bodyUV:calibration.shrimp.body.slice(),bodyAnchor:body,mode:0},
    foliage('shrimp-curtain',SCENE_ANCHORS.shrimpCurtain,5.8,-.18,true,.05),
    {id:'hidden-tetra',key:'fish',center:SCENE_ANCHORS.fish.slice(),width:1.18,height:1.18/ratio('fish',2),mode:2,sway:.005},
    foliage('fish-curtain',SCENE_ANCHORS.fishCurtain,5.8,.13,false,-.035),
    {id:'glass-intake',key:'filter',center:filterCenter,height:filterHeight,width:filterWidth,strainer,strainerUV:calibration.filter.strainer.slice(),rimUV:calibration.filter.rim.slice(),bendTopUV:calibration.filter.bendTop.slice(),cupUVs:calibration.filter.cups.map(cup=>cup.slice()),mode:0},
    foliage('filter-curtain',SCENE_ANCHORS.filterCurtain,5.8,-.08,true,.035),
    foliage('entrance-left',[-6.7,GROUND_Y,7],6.6,-.18),
    foliage('entrance-right',[6.7,GROUND_Y,6.3],6.8,.2,true),
  ].map((object,index)=>({...object,phase:index*2.399963,model:modelMatrix(object.center,object.width,object.height,object)}));
  return result;
}

const VERTEX=`
attribute vec3 position; attribute vec2 uv;
uniform mat4 projectionView,model;
uniform mediump float time,sway,phase,mode;
varying mediump vec2 texcoord; varying mediump float distanceToCamera;
varying mediump vec3 worldPosition;
void main(){
  vec3 local=position;
  // The photographed rock, rhizome and lowest stems are rigid. Only the upper
  // canopy moves, so its measured contact cannot drift across the substrate.
  if(mode>0.5&&mode<1.5)local.x+=sin(time*.52+local.y*3.4+phase)*sway*smoothstep(.30,.72,uv.y)*pow(uv.y,2.);
  if(mode>1.5&&mode<2.5)local.y+=sin(time*2.1+uv.x*11.)*sway*pow(1.-uv.x,2.);
  vec4 world=model*vec4(local,1.);
  gl_Position=projectionView*world;
  texcoord=uv;distanceToCamera=gl_Position.w;worldPosition=world.xyz;
}`;
const FRAGMENT=`
precision mediump float;
uniform sampler2D photo;
uniform mediump float time,mode;
uniform mediump float photoScale;
uniform mediump vec3 eye;
uniform mediump vec3 contacts[9];
varying mediump vec2 texcoord; varying mediump float distanceToCamera;
varying mediump vec3 worldPosition;
void main(){
  vec2 p=texcoord;
  bool surface=mode>2.5&&mode<3.5;
  bool backdrop=mode>3.5&&mode<4.5;
  bool ground=mode>4.5&&mode<5.5;
  bool glass=mode>5.5;
  vec3 waterHaze=vec3(.073,.239,.216);
  if(glass){
    float edge=min(min(p.x,1.-p.x),min(p.y,1.-p.y));
    float edgeLight=1.-smoothstep(.002,.010,edge);
    float alpha=mode>6.5?.17:.012+edgeLight*.085;
    gl_FragColor=vec4(vec3(.47,.77,.71),alpha);
    return;
  }
  if(backdrop)p=(p-.5)*photoScale+.5;
  if(ground){
    // A photographed top-down substrate repeats in world space, not screen
    // space. Mirrored UVs keep the NPOT image continuous at tile boundaries.
    vec2 groundUV=worldPosition.xz/6.;
    p=1.-abs(mod(groundUV,2.)-1.);
  }
  if(surface){
    // A world-locked 8 x 4 unit water tile retains real photographic detail.
    // Mirrored sampling is continuous at NPOT texture boundaries in WebGL 1.
    vec2 waterUV=vec2((worldPosition.x+1.6)/8.,(-worldPosition.z-7.2)/4.)+.5;
    p=1.-abs(mod(waterUV,2.)-1.);
    p+=vec2(sin(p.y*32.+time*.51)+sin(p.x*19.-time*.3),cos(p.x*27.-time*.4)+sin(p.y*17.+time*.28))*.0007;
  }
  vec4 color=texture2D(photo,clamp(p,vec2(.001),vec2(.999)));
  if(backdrop){
    float outside=max(max(-p.x,p.x-1.),max(-p.y,p.y-1.));
    color.rgb=mix(color.rgb,waterHaze,smoothstep(-.10,.01,outside));
  }
  if(surface){
    vec3 ray=worldPosition-eye;
    float distance=max(length(ray),.001);
    float grazing=abs(ray.y)/distance;
    // Distant, grazing water merges into the view underneath it. This is a
    // continuous physical material response, not a story/chapter transition.
    float transmission=exp(-max(distance-6.,0.)*.055)*smoothstep(.02,.16,grazing);
    color.rgb=mix(waterHaze,color.rgb,.65+.35*transmission);
    color.rgb*=.994+.014*sin(p.x*11.+p.y*17.+time*.46);
    color.a*=transmission;
  }
  if(ground){
    float shadow=0.;
    for(int i=0;i<9;i++){
      vec2 delta=(worldPosition.xz-contacts[i].xy)/vec2(contacts[i].z,contacts[i].z*.62);
      shadow+=exp(-dot(delta,delta)*2.8);
    }
    // Stable, broad contact shade joins each photographed rock to the sand.
    color.rgb*=1.-clamp(shadow*.19,0.,.36);
    float distance=length(worldPosition-eye);
    color.rgb=mix(color.rgb*vec3(.76,.90,.88),waterHaze,.10+smoothstep(7.,34.,distance)*.78);
    // The finite photographic background stands at z=-34. Join the real sand
    // into that environment before their intersection, entirely in world
    // coordinates. Every planted contact (furthest z=-17) remains opaque.
    color.a=1.-smoothstep(20.,32.,-worldPosition.z);
  }
  // Transparent pixels never write depth. Soft photographed edges blend;
  // opaque leaf/animal pixels still hide the farther stationary objects.
  if(color.a<.045)discard;
  float haze=mode>.5&&mode<2.5?.025+clamp((distanceToCamera-4.)*.003,0.,.10):0.;
  if(mode>1.5&&mode<2.5){
    // The tetra shares the water's light and attenuation; neutral highlights
    // no longer read as a dry, brightly pasted product photograph.
    color.rgb*=vec3(.92,.99,1.015);
    haze=.055+clamp((distanceToCamera-2.)*.008,0.,.14);
  }
  color.rgb=mix(color.rgb,vec3(.09,.39,.34),haze);
  gl_FragColor=color;
}`;

function meshData(columns=1,rows=1){
  const result=[];
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
    const left=x/columns,right=(x+1)/columns,bottom=y/rows,top=(y+1)/rows;
    for(const [u,v] of [[left,bottom],[right,bottom],[left,top],[left,top],[right,bottom],[right,top]])result.push(u-.5,v-.5,0,u,v);
  }
  return new Float32Array(result);
}

export function createContinuousScene(canvas,{urls={},assetCalibration={},onReady}={}){
  const sources={...DEFAULT_URLS,...urls},keys=Object.keys(DEFAULT_URLS);
  let gl=null,program=null,status='idle',error=null,loadPromise=null;
  let width=1,height=1,mobile=false,entryScale=1.43,geometryDirty=true,objects=[];
  let textureAspects={},textures={},uniforms={},quad=null,foliageMesh=null;
  let rootContacts=new Float32Array(27);
  let animationTime=0,lastClock=null,lastCamera=null,lastProgress=0,drawCount=0;
  if(canvas)canvas.hidden=true;
  function notify(){onReady?.({ready:status==='ready',status,error});}
  function fail(message){if(status==='failed')return;status='failed';error=message;if(canvas)canvas.hidden=true;notify();}
  function compile(type,source){
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error((type===gl.VERTEX_SHADER?'vertex':'fragment')+' shader: '+(gl.getShaderInfoLog(shader)||'compilation unavailable'));
    return shader;
  }
  function mesh(columns,rows){
    const data=meshData(columns,rows),buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
    return {buffer,count:data.length/5};
  }
  function bindMesh(value){
    gl.bindBuffer(gl.ARRAY_BUFFER,value.buffer);
    const position=gl.getAttribLocation(program,'position'),uv=gl.getAttribLocation(program,'uv');
    gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,3,gl.FLOAT,false,20,0);
    gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,20,12);
  }
  function loadImage(key){
    return new Promise((resolve,reject)=>{
      const image=new Image();image.decoding='async';
      image.onload=async()=>{
        try{
          try{await image.decode();}catch{}
          if(!image.naturalWidth)throw Error('empty image');
          const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
          gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
          gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
          textures[key]=texture;textureAspects[key]=image.naturalWidth/image.naturalHeight;resolve();
        }catch{reject(Error('photographic texture unavailable: '+key));}
      };
      image.onerror=()=>reject(Error('photographic texture unavailable: '+key));image.src=sources[key];
    });
  }
  function resize(nextWidth,nextHeight,options={}){
    width=Math.max(1,Number(nextWidth)||1);height=Math.max(1,Number(nextHeight)||1);
    mobile=options.mobile??width<=700;entryScale=Number.isFinite(options.entryScale)?options.entryScale:entryScale;
    geometryDirty=true;
    if(gl){
      const maximum=mobile?1400:1900,ratio=Math.min(window.devicePixelRatio||1,1.5,maximum/width,maximum/height);
      canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
      gl.viewport(0,0,canvas.width,canvas.height);
    }
  }
  function load(){
    if(loadPromise||status==='ready'||status==='failed')return loadPromise;
    if(!canvas){fail('canvas unavailable');return Promise.resolve(false);}
    status='loading';
    loadPromise=(async()=>{
      try{
        gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:false});
        if(!gl)throw Error('WebGL unavailable');
        program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program);
        if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('photographic program: '+(gl.getProgramInfoLog(program)||'link unavailable'));
        gl.useProgram(program);
        for(const name of ['projectionView','model','time','sway','phase','mode','photo','photoScale','eye','contacts[0]'])uniforms[name]=gl.getUniformLocation(program,name);
        quad=mesh(1,1);foliageMesh=mesh(9,14);
        gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.CULL_FACE);gl.uniform1i(uniforms.photo,0);
        resize(width,height,{mobile,entryScale});
        await Promise.all(keys.map(loadImage));
        if(status==='failed')return false;
        status='ready';geometryDirty=true;notify();return true;
      }catch(reason){fail(reason.message||'photographic scene unavailable');return false;}
    })();
    return loadPromise;
  }
  function draw(progress,clock=0,{motion=true}={}){
    if(status!=='ready'||!gl)return false;
    if(motion){
      if(lastClock!==null)animationTime+=Math.max(0,Math.min(48,clock-lastClock))/1000;
      lastClock=clock;
    }else lastClock=null;
    const camera=continuousCamera(progress,{aspect:width/height,mobile,entryScale});
    if(geometryDirty){
      objects=sceneObjects({backgroundHeight:camera.backgroundHeight,textureAspects,assetCalibration});
      rootContacts=new Float32Array(objects.filter(object=>object.root).flatMap(object=>[object.root[0],object.root[2],Math.max(.28,object.width*.32)]));
      geometryDirty=false;
    }
    gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.073,.239,.216,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);gl.uniformMatrix4fv(uniforms.projectionView,false,camera.viewProjection);gl.uniform1f(uniforms.time,animationTime);gl.uniform3fv(uniforms.eye,camera.position);
    gl.uniform3fv(uniforms['contacts[0]'],rootContacts);
    // Photograph cutouts are sorted by camera distance only for edge blending.
    // Their actual depth comes from the model/view/projection matrices.
    const ordered=objects.map(object=>({object,distance:Math.hypot(...object.center.map((v,i)=>v-camera.position[i]))})).sort((a,b)=>{
      // Render the photograph before translucent materials so the substrate's
      // fixed distant feather blends over the world, not over the clear color.
      if(a.object.id==='planted-world')return -1;
      if(b.object.id==='planted-world')return 1;
      return (Number(a.object.mode>5.5)-Number(b.object.mode>5.5))||b.distance-a.distance;
    });
    let boundMesh=null;
    for(const {object} of ordered){
      const geometry=object.key==='foliage'?foliageMesh:quad;
      if(boundMesh!==geometry){bindMesh(geometry);boundMesh=geometry;}
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,textures[object.key]);
      gl.uniformMatrix4fv(uniforms.model,false,object.model);gl.uniform1f(uniforms.sway,object.sway||0);gl.uniform1f(uniforms.phase,object.phase||0);gl.uniform1f(uniforms.mode,object.mode||0);gl.uniform1f(uniforms.photoScale,object.photoScale||1);
      gl.depthMask(object.mode<5.5);
      gl.drawArrays(gl.TRIANGLES,0,geometry.count);
    }
    gl.depthMask(true);
    lastCamera=camera;lastProgress=camera.progress;drawCount++;canvas.hidden=false;return true;
  }
  canvas?.addEventListener('webglcontextlost',event=>{event.preventDefault();fail('WebGL context lost');});
  return {load,resize,draw,isReady:()=>status==='ready',getStatus:()=>({status,error,ready:status==='ready',drawCount,progress:lastProgress,position:lastCamera?.position?.slice()||null,target:lastCamera?.target?.slice()||null,textureKeys:keys.slice(),objectCount:objects.length,animationTime,viewport:[width,height]})};
}
