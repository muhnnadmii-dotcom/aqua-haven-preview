import {continuousCamera,SCENE_ANCHORS} from './camera-math-v13.mjs?v=13';

// One photographic multiplane aquarium, one continuous perspective camera.
// Every object is installed once, at a stable world position. Scroll never
// substitutes a chapter image, teleports an object, or fades a discovered animal.
const DEFAULT_URLS=Object.freeze({
  background:'assets/underwater.webp',foliage:'assets/continuous/foliage.webp',
  filter:'assets/continuous/filter.webp',fish:'assets/fish.webp',
  shrimp:'assets/continuous/shrimp-leaf.webp',surface:'assets/discovery/10-surface-only.webp',
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

export function sceneObjects({backgroundHeight=56,textureAspects={}}={}){
  const ratio=(key,fallback)=>textureAspects[key]||fallback;
  const foliage=(id,center,requestedHeight,rotation,mirror=false,tilt=0,maxWidth=10)=>{
    const aspect=ratio('foliage',.8),height=Math.min(requestedHeight,maxWidth/aspect);
    return {id,key:'foliage',center:center.slice(),width:height*aspect,height,rotation,mirror,tilt,sway:.007,mode:1};
  };
  return [
    // Geometry continues beyond the source photograph. The center's original
    // photo projection is unchanged; the extended margins meet water haze.
    {id:'planted-world',key:'background',center:SCENE_ANCHORS.background.slice(),width:backgroundHeight*ratio('background',2)*3,height:backgroundHeight*3,photoScale:3,mode:4},
    {id:'water-ceiling',key:'surface',center:SCENE_ANCHORS.surface.slice(),width:1200,height:1200,horizontal:true,mode:3},
    foliage('far-right-garden',[7,-1,-17],12,-.15),
    foliage('far-left-garden',[-8,-.6,-15],11,.15,true),
    foliage('back-fern',[2.7,-1.8,-12.5],5.4,-.24,false,.04),
    {id:'shrimp-leaf',key:'shrimp',center:SCENE_ANCHORS.shrimp.slice(),width:2.8,height:2.8/ratio('shrimp',1.5),mode:0},
    foliage('shrimp-curtain',SCENE_ANCHORS.shrimpCurtain,4.5,-.18,true,.05,3.65),
    {id:'hidden-tetra',key:'fish',center:SCENE_ANCHORS.fish.slice(),width:1.18,height:1.18/ratio('fish',2),mode:2,sway:.005},
    foliage('fish-curtain',SCENE_ANCHORS.fishCurtain,5,.13,false,-.035,3.75),
    {id:'glass-intake',key:'filter',center:SCENE_ANCHORS.filter.slice(),height:2.85,width:2.85*ratio('filter',.42),mode:0},
    foliage('filter-curtain',SCENE_ANCHORS.filterCurtain,5.2,-.08,true,.035,3.75),
    foliage('entrance-left',[-6.7,-1.3,7],6.6,-.18,false,0,5.2),
    foliage('entrance-right',[6.7,-1.3,6.3],6.8,.2,true,0,5.2),
  ].map((object,index)=>({...object,phase:index*2.399963,model:modelMatrix(object.center,object.width,object.height,object)}));
}

const VERTEX=`
attribute vec3 position; attribute vec2 uv;
uniform mat4 projectionView,model;
uniform mediump float time,sway,phase,mode;
varying mediump vec2 texcoord; varying mediump float distanceToCamera;
varying mediump vec3 worldPosition;
void main(){
  vec3 local=position;
  if(mode>0.5&&mode<1.5)local.x+=sin(time*.52+local.y*3.4+phase)*sway*pow(uv.y,2.);
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
varying mediump vec2 texcoord; varying mediump float distanceToCamera;
varying mediump vec3 worldPosition;
void main(){
  vec2 p=texcoord;
  bool surface=mode>2.5&&mode<3.5;
  bool backdrop=mode>3.5;
  vec3 waterHaze=vec3(.073,.239,.216);
  if(backdrop)p=(p-.5)*photoScale+.5;
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
  // Transparent pixels never write depth. Soft photographed edges blend;
  // opaque leaf/animal pixels still hide the farther stationary objects.
  if(color.a<.045)discard;
  float haze=mode>.5&&mode<2.5?clamp((distanceToCamera-6.)*.002,0.,.065):0.;
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

export function createContinuousScene(canvas,{urls={},onReady}={}){
  const sources={...DEFAULT_URLS,...urls},keys=Object.keys(DEFAULT_URLS);
  let gl=null,program=null,status='idle',error=null,loadPromise=null;
  let width=1,height=1,mobile=false,entryScale=1.43,geometryDirty=true,objects=[];
  let textureAspects={},textures={},uniforms={},quad=null,foliageMesh=null;
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
        for(const name of ['projectionView','model','time','sway','phase','mode','photo','photoScale','eye'])uniforms[name]=gl.getUniformLocation(program,name);
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
    if(geometryDirty){objects=sceneObjects({backgroundHeight:camera.backgroundHeight,textureAspects});geometryDirty=false;}
    gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.073,.239,.216,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);gl.uniformMatrix4fv(uniforms.projectionView,false,camera.viewProjection);gl.uniform1f(uniforms.time,animationTime);gl.uniform3fv(uniforms.eye,camera.position);
    // Photograph cutouts are sorted by camera distance only for edge blending.
    // Their actual depth comes from the model/view/projection matrices.
    const ordered=objects.map(object=>({object,distance:Math.hypot(...object.center.map((v,i)=>v-camera.position[i]))})).sort((a,b)=>b.distance-a.distance);
    let boundMesh=null;
    for(const {object} of ordered){
      const geometry=object.key==='foliage'?foliageMesh:quad;
      if(boundMesh!==geometry){bindMesh(geometry);boundMesh=geometry;}
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,textures[object.key]);
      gl.uniformMatrix4fv(uniforms.model,false,object.model);gl.uniform1f(uniforms.sway,object.sway||0);gl.uniform1f(uniforms.phase,object.phase||0);gl.uniform1f(uniforms.mode,object.mode||0);gl.uniform1f(uniforms.photoScale,object.photoScale||1);
      gl.drawArrays(gl.TRIANGLES,0,geometry.count);
    }
    lastCamera=camera;lastProgress=camera.progress;drawCount++;canvas.hidden=false;return true;
  }
  canvas?.addEventListener('webglcontextlost',event=>{event.preventDefault();fail('WebGL context lost');});
  return {load,resize,draw,isReady:()=>status==='ready',getStatus:()=>({status,error,ready:status==='ready',drawCount,progress:lastProgress,position:lastCamera?.position?.slice()||null,target:lastCamera?.target?.slice()||null,textureKeys:keys.slice(),objectCount:objects.length,animationTime,viewport:[width,height]})};
}
