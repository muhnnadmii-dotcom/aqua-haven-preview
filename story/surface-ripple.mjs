// A single low-power textured quad adds small water refraction at the ending.
// Its camera never scales; the ordinary photograph is the complete fallback.
export function createSurfaceRipple(canvas,url,onReady){
  if(!canvas)return null;
  let gl=null,program=null,texture=null,ready=false,started=false,failed=false;
  let width=1,height=1,imageAspect=2,lastDraw=0;
  let position,cover,timeUniform;
  canvas.hidden=true;
  const vertex='attribute vec2 a; varying vec2 uv; void main(){uv=a*.5+.5;gl_Position=vec4(a,0.,1.);}';
  const fragment=`precision mediump float;
    varying vec2 uv; uniform sampler2D image; uniform vec2 crop; uniform float t;
    void main(){
      vec2 flow=vec2(sin(uv.y*37.+t*.56)+sin(uv.x*19.+uv.y*13.-t*.31),
                     cos(uv.x*31.-t*.43)+sin(uv.y*21.+t*.27))*.0009;
      vec2 sampleUV=clamp((uv-.5)*crop+.5+flow*crop,vec2(.001),vec2(.999));
      vec3 color=texture2D(image,sampleUV).rgb;
      float glint=.992+.018*sin(uv.x*11.+uv.y*17.+t*.48);
      gl_FragColor=vec4(color*glint,1.);
    }`;
  function shader(type,source){const value=gl.createShader(type);gl.shaderSource(value,source);gl.compileShader(value);if(!gl.getShaderParameter(value,gl.COMPILE_STATUS))throw Error('shader unavailable');return value;}
  function resize(nextWidth,nextHeight){
    width=nextWidth;height=nextHeight;
    if(!gl)return;
    const ratio=Math.min(window.devicePixelRatio||1,1.5,1600/width,1600/height);
    canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
    gl.viewport(0,0,canvas.width,canvas.height);
  }
  function load(){
    if(started||failed)return;started=true;
    try{
      gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power',preserveDrawingBuffer:false});
      if(!gl)throw Error('webgl unavailable');
      program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('program unavailable');
      gl.useProgram(program);
      const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      position=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
      cover=gl.getUniformLocation(program,'crop');timeUniform=gl.getUniformLocation(program,'t');
      texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      const image=new Image();image.decoding='async';
      image.onload=()=>{
        try{imageAspect=image.naturalWidth/image.naturalHeight;gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,image);ready=true;resize(width,height);onReady?.();}
        catch{failed=true;canvas.hidden=true;}
      };
      image.onerror=()=>{failed=true;};image.src=url;
      resize(width,height);
    }catch{failed=true;canvas.hidden=true;}
  }
  function draw(time){
    if(!ready||failed||time-lastDraw<32)return false;lastDraw=time;
    gl.useProgram(program);gl.bindTexture(gl.TEXTURE_2D,texture);
    const aspect=width/height;
    gl.uniform2f(cover,aspect<imageAspect?aspect/imageAspect:1,aspect>imageAspect?imageAspect/aspect:1);
    gl.uniform1f(timeUniform,time/1000);gl.drawArrays(gl.TRIANGLES,0,6);canvas.hidden=false;
    return true;
  }
  canvas.addEventListener('webglcontextlost',()=>{ready=false;failed=true;canvas.hidden=true;});
  return {load,resize,draw,isReady:()=>ready&&!failed};
}
