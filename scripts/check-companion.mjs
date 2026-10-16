import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
const dir=fileURLToPath(new URL('../docs/',import.meta.url));
const data=JSON.parse(fs.readFileSync(dir+'assets/companion/frames.json','utf8'));
const moduleURL=pathToFileURL(dir+'companion.js').href;
let fixtureNumber=0;
const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
class Emitter {
  constructor(){this.listeners=new Map();this.hidden=false;this.textContent='';this.attributes={};}
  addEventListener(k,fn){if(!this.listeners.has(k))this.listeners.set(k,new Set());this.listeners.get(k).add(fn);}
  removeEventListener(k,fn){this.listeners.get(k)?.delete(fn);}
  dispatchEvent(e){for(const fn of this.listeners.get(e.type)??[])fn(e);return true;}
  setAttribute(k,v){this.attributes[k]=v;}
  focus(){document.activeElement=this;}
}
function fixture({delayed=false,reduced=false,initialOpen=null,failMetadataOnce=false,noCanvas=false}={}){
  let now=0,nextFrame=0;
  const frames=new Map(),images=new Map(),observers=new Set(),events=[];
  const motion=new Emitter();motion.matches=reduced;
  const root={dataset:{theme:'dark'}};
  const stats={frames:new Map(),lastDraw:[],drawCount:0};
  const state={globalAlpha:1};let stack=[];
  const methods={
    save(){stack.push({...state})},restore(){const prev=stack.pop();if(prev)Object.assign(state,prev)},
    clearRect(){stats.lastDraw=[]},
    drawImage(img,sx,sy,sw,sh,dx,dy,dw,dh){
      assert([sx,sy,sw,sh,dx,dy,dw,dh].every(Number.isFinite));
      assert(sw>0&&sh>0&&dw>0&&dh>0);
      assert(sx>=0&&sy>=0&&sx+sw<=data[img.name].width&&sy+sh<=data[img.name].height);
      const index=data[img.name].frames.findIndex(v=>v[0]===sx&&v[1]===sy&&v[2]===sw&&v[3]===sh);
      assert(index>=0,'draw source rectangle missing from atlas metadata');
      assert(Number.isFinite(state.globalAlpha)&&state.globalAlpha>=0&&state.globalAlpha<=1);
      if(!stats.frames.has(img.name))stats.frames.set(img.name,new Set());
      stats.frames.get(img.name).add(index);
      stats.lastDraw.push({name:img.name,index,alpha:state.globalAlpha,dx,dy,dw,dh});stats.drawCount++;
    },
  };
  const ctx=new Proxy(state,{get(target,key){if(key in methods)return methods[key];if(key in target)return target[key];return(...args)=>{assert(args.every(v=>typeof v!=='number'||Number.isFinite(v)),`Non-finite argument to ${String(key)}`)};},set(target,key,v){target[key]=v;return true}});
  const canvas=new Emitter();Object.assign(canvas,{width:400,height:340,getContext:()=>noCanvas?null:ctx,getBoundingClientRect:()=>({width:290})});
  canvas.addEventListener('companionstate',e=>events.push({...e.detail}));
  const elements=new Map(['theme-toggle','theme-label','companion-label','companion-replay','companion-pause','companion-rail'].map(id=>[id,new Emitter()]));elements.set('companion',canvas);
  elements.get('theme-toggle').hidden=true;
  const projects=['insurance','ecology','packing','watermark'].map(kind=>{const el=new Emitter();el.dataset={scene:kind};el._open=kind===initialOpen;Object.defineProperty(el,'open',{get(){return this._open},set(value){if(this._open===value)return;this._open=value;if(value)projects.forEach(other=>{if(other!==this)other.open=false});queueMicrotask(()=>this.dispatchEvent({type:'toggle'}));}});return el;});
  const doc=new Emitter();doc.documentElement=root;doc.activeElement=null;doc.hidden=false;doc.getElementById=id=>elements.get(id);doc.querySelectorAll=()=>projects;doc.querySelector=()=>({content:'#002b36'});
  const win=new Emitter();win.matchMedia=()=>motion;win.devicePixelRatio=2;
  globalThis.document=doc;globalThis.window=win;globalThis.performance={now:()=>now};globalThis.localStorage={setItem(){}};
  globalThis.CustomEvent=class{constructor(type,options){this.type=type;this.detail=options?.detail}};
  globalThis.requestAnimationFrame=cb=>{const id=++nextFrame;frames.set(id,cb);return id;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
  globalThis.ResizeObserver=class{constructor(cb){this.cb=cb;observers.add(this)}observe(){}disconnect(){observers.delete(this)}};
  let resolveMetadata;const metadataGate=new Promise(resolve=>{resolveMetadata=resolve});
  let fetchRequests=0;
  globalThis.fetch=()=>{fetchRequests++;return failMetadataOnce&&fetchRequests===1?Promise.reject(new Error('Transient network failure')):delayed?metadataGate:Promise.resolve({ok:true,json:async()=>data});};
  globalThis.Image=class{set src(value){this.name=new URL(value).pathname.split('/').at(-1).replace('.png','');images.set(this.name,this);if(!delayed)queueMicrotask(()=>this.onload())}};
  function step(t){now=t;const due=[...frames.values()];frames.clear();due.forEach(cb=>cb(t));}
  function resolveImage(name){const img=images.get(name);assert(img,`${name} was not requested`);img.onload();}
  return {canvas,motion,frames,events,images,observers,stats,elements,projects,doc,win,step,resolveImage,fetchCount:()=>fetchRequests,resolveMetadata:()=>resolveMetadata({ok:true,json:async()=>data}),setNow:t=>{now=t},last:()=>events.at(-1),load:async()=>import(moduleURL+'?fixture='+(++fixtureNumber))};
}
const durations={insurance:7800,ecology:7000,packing:8000,watermark:7800};
for(const [kind,duration]of Object.entries(durations)){
  const f=fixture();const {createCompanion}=await f.load();const api=createCompanion(f.canvas);await flush();
  assert.equal(f.last().kind,'idle');assert.equal(f.last().ready,true);assert.equal(f.frames.size,0);
  await api.select(kind);f.stats.frames.clear();
  for(let t=0;t<=duration+20;t+=20)f.step(t);
  const atlas=kind==='ecology'?'map':kind==='packing'?'hop':'typing';
  assert.deepEqual([...f.stats.frames.get(atlas)].sort((a,b)=>a-b),Array.from({length:16},(_,i)=>i),kind+' did not show all 16 relevant atlas frames');
  assert.equal(f.last().playing,false);assert.equal(f.frames.size,0);
  assert(f.stats.lastDraw.every(v=>v.index===15),kind+' did not hold a final frame');
  if(kind==='packing')assert.equal(f.stats.lastDraw.length,6);
  const before=f.stats.drawCount;api.replay();assert.equal(f.frames.size,1);f.step(duration+220);assert(f.stats.drawCount>before);api.pause();assert.equal(f.frames.size,0);assert.equal(f.last().playing,false);
  const paused=f.stats.drawCount;f.step(duration+1000);assert.equal(f.stats.drawCount,paused);
  api.replay();assert.equal(f.frames.size,1);f.motion.matches=true;f.motion.dispatchEvent({type:'change'});assert.equal(f.frames.size,0);assert(f.stats.lastDraw.every(v=>v.index===15));assert.equal(f.last().reducedMotion,true);
  f.doc.documentElement.dataset.theme='light';api.redraw();f.doc.documentElement.dataset.theme='dark';api.redraw();
  api.destroy();assert.equal(f.frames.size,0);assert.equal(f.observers.size,0);assert.equal(f.motion.listeners.get('change').size,0);
  console.log(`${kind}: all 16 frames; finished pose; replay, pause, live reduced motion, theme redraw, cleanup; finite coordinates (${f.stats.drawCount} sprite draws)`);
}
{
  const f=fixture({delayed:true});const {createCompanion}=await f.load();const api=createCompanion(f.canvas);
  const pending=[api.select('insurance'),api.select('ecology'),api.select('packing'),api.select('watermark'),api.select('ecology')];
  f.resolveImage('map');f.resolveMetadata();await flush();assert.equal(f.last().ready,false);
  f.resolveImage('hop');await flush();assert.equal(f.last().kind,'ecology');assert.equal(f.last().ready,true);assert.equal(f.frames.size,1);
  f.resolveImage('typing');await Promise.all(pending);await flush();assert.equal(f.last().kind,'ecology');assert.equal(f.frames.size,1);
  await api.select('idle');assert.equal(f.frames.size,0);assert.equal(f.last().kind,'idle');api.destroy();
  console.log('Rapid selection while loading: only latest ecology selection plays; stale typing completion cannot replace it; returning idle cancels RAF.');
}
for(const kind of Object.keys(durations)){
  const f=fixture({reduced:true});const {createCompanion}=await f.load();const api=createCompanion(f.canvas);await flush();await api.select(kind);
  assert.equal(f.frames.size,0);assert.equal(f.last().playing,false);assert(f.stats.lastDraw.every(v=>v.index===15));if(kind==='packing')assert.equal(f.stats.lastDraw.length,6);api.replay();assert.equal(f.frames.size,0);api.destroy();
}
console.log('Initial reduced motion: each selected behavior holds its terminal pose with no RAF, including replay.');
{
  const f=fixture({failMetadataOnce:true});const {createCompanion}=await f.load();const api=createCompanion(f.canvas);await flush();
  assert(f.last().error);await api.select('ecology');assert.equal(f.last().ready,true);assert.equal(f.last().error,null);assert.equal(f.fetchCount(),2);api.destroy();
  console.log('A transient metadata failure is retried successfully on the next selection.');
}
{
  const f=fixture({initialOpen:'ecology'});await import(pathToFileURL(dir+'site.js').href+'?fixture=site');await flush();
  assert.equal(f.last().kind,'ecology');assert.equal(f.last().ready,true);console.log('Initially open dropdown selects matching ecology companion.');
  f.projects[2].open=true;await flush();assert.equal(f.last().kind,'packing');assert.equal(f.last().playing,true);assert.equal(f.projects.filter(p=>p.open).length,1);
  f.elements.get('companion-pause').dispatchEvent({type:'click'});assert.equal(f.last().playing,false);assert.equal(f.frames.size,0);
  f.elements.get('companion-replay').dispatchEvent({type:'click'});assert.equal(f.last().playing,true);
  f.doc.hidden=true;f.doc.dispatchEvent({type:'visibilitychange'});assert.equal(f.frames.size,0);
  f.doc.hidden=false;f.elements.get('companion-replay').dispatchEvent({type:'click'});assert.equal(f.frames.size,1);f.win.dispatchEvent({type:'pagehide'});assert.equal(f.frames.size,0);
  console.log('site.js: detail selection, exclusivity, pause/replay controls, visibility/pagehide cancellation passed.');
}
{
  const f=fixture({noCanvas:true});await import(pathToFileURL(dir+'site.js').href+'?fixture=no-canvas');await flush();
  assert.equal(f.elements.get('companion-rail').hidden,true);assert.equal(f.elements.get('theme-toggle').hidden,false);
  f.elements.get('theme-toggle').dispatchEvent({type:'click'});assert.equal(f.doc.documentElement.dataset.theme,'light');
  f.projects[1].open=true;await flush();assert.equal(f.projects[1].open,true);assert.equal(f.frames.size,0);
  console.log('Canvas unavailable: empty rail hides; theme control and native dropdowns still function.');
}
