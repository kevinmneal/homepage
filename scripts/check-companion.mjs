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
function fixture({delayed=false,reduced=false,initialOpen=null,failMetadataOnce=false,noCanvas=false,initialHash=''}={}){
  let now=0,nextFrame=0;
  const frames=new Map(),images=new Map(),observers=new Set(),events=[];
  const motion=new Emitter();motion.matches=reduced;
  const root={dataset:{theme:'dark'}};
  const stats={frames:new Map(),lastDraw:[],drawCount:0,blends:[]};
  // Model source-over/lighter at a pixel opaque in both registered poses. This
  // catches alpha dips without pretending to perform full image rasterization.
  function makeCanvas(main=false){
    const surface={draws:[],coverage:0};
    const state={globalAlpha:1,globalCompositeOperation:'source-over'};
    const stack=[];
    const methods={
      save(){stack.push({...state})},
      restore(){const previous=stack.pop();if(previous)Object.assign(state,previous)},
      clearRect(){surface.draws=[];surface.coverage=0;if(main)stats.lastDraw=[]},
      drawImage(image,...args){
        assert(args.every(Number.isFinite),'Non-finite drawImage coordinate');
        assert(Number.isFinite(state.globalAlpha)&&state.globalAlpha>=0&&state.globalAlpha<=1);
        const opacity=state.globalAlpha;
        if(image.surface){
          assert(main,'Unexpected nested pose layer');
          assert.equal(args.length,2,'Expected the unscaled pose-layer drawImage overload');
          assert.equal(state.globalCompositeOperation,'source-over','Pose layer must not brighten the main scene');
          assert(Math.abs(image.surface.coverage-1)<1e-9,'Pose blend loses opacity at an opaque overlapping point');
          const draws=image.surface.draws.map(draw=>({...draw,alpha:draw.alpha*opacity}));
          stats.lastDraw.push(...draws);
          stats.blends.push({time:now,coverage:image.surface.coverage,draws:image.surface.draws.map(draw=>({...draw}))});
          stats.drawCount++;
          return;
        }
        assert.equal(args.length,8,'Expected a registered atlas source rectangle');
        const [sx,sy,sw,sh,dx,dy,dw,dh]=args;
        assert(sw>0&&sh>0&&dw>0&&dh>0);
        assert(sx>=0&&sy>=0&&sx+sw<=data[image.name].width&&sy+sh<=data[image.name].height);
        const index=data[image.name].frames.findIndex(v=>v[0]===sx&&v[1]===sy&&v[2]===sw&&v[3]===sh);
        assert(index>=0,'draw source rectangle missing from atlas metadata');
        if(!stats.frames.has(image.name))stats.frames.set(image.name,new Set());
        stats.frames.get(image.name).add(index);
        const draw={name:image.name,index,alpha:opacity,dx,dy,dw,dh};
        if(main){
          assert.equal(state.globalCompositeOperation,'source-over','Direct sprite must not brighten the main scene');
          stats.lastDraw.push(draw);
        }else if(state.globalCompositeOperation==='lighter'){
          surface.draws.push(draw);
          surface.coverage=Math.min(1,surface.coverage+opacity);
        }else{
          assert.equal(state.globalCompositeOperation,'source-over','Unexpected pose composition mode');
          surface.draws=surface.draws.map(previous=>({...previous,alpha:previous.alpha*(1-opacity)}));
          surface.draws.push(draw);
          surface.coverage=opacity+surface.coverage*(1-opacity);
        }
        stats.drawCount++;
      },
    };
    const ctx=new Proxy(state,{get(target,key){if(key in methods)return methods[key];if(key in target)return target[key];return(...args)=>{assert(args.every(v=>typeof v!=='number'||Number.isFinite(v)),`Non-finite argument to ${String(key)}`)};},set(target,key,value){target[key]=value;return true}});
    const result=new Emitter();
    Object.assign(result,{width:400,height:340,surface,getContext:()=>main&&noCanvas?null:ctx,getBoundingClientRect:()=>({width:290})});
    return result;
  }
  const canvas=makeCanvas(true);
  canvas.addEventListener('companionstate',e=>events.push({...e.detail}));
  const elements=new Map(['theme-toggle','theme-label','companion-label','companion-replay','companion-pause','companion-rail','companion-secret','companion-hint'].map(id=>[id,new Emitter()]));elements.set('companion',canvas);
  elements.get('theme-toggle').hidden=true;
  const projects=['insurance','ecology','packing','watermark'].map(kind=>{const el=new Emitter();el.dataset={scene:kind};el._open=kind===initialOpen;Object.defineProperty(el,'open',{get(){return this._open},set(value){if(this._open===value)return;this._open=value;if(value)projects.forEach(other=>{if(other!==this)other.open=false});queueMicrotask(()=>this.dispatchEvent({type:'toggle'}));}});return el;});
  const doc=new Emitter();doc.createElement=tag=>{assert.equal(tag,'canvas');return makeCanvas()};doc.documentElement=root;doc.activeElement=null;doc.hidden=false;doc.getElementById=id=>elements.get(id);doc.querySelectorAll=()=>projects;doc.querySelector=()=>({content:'#002b36'});
  const win=new Emitter();win.matchMedia=()=>motion;win.devicePixelRatio=2;win.location={hash:initialHash};
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
  return {canvas,motion,frames,events,images,observers,stats,elements,projects,doc,win,step,resolveImage,fetchCount:()=>fetchRequests,resolveMetadata:()=>resolveMetadata({ok:true,json:async()=>data}),setNow:t=>{now=t},now:()=>now,last:()=>events.at(-1),load:async()=>import(moduleURL+'?fixture='+(++fixtureNumber))};
}
async function checkSiteEntrances(f, check) {
  const timers=new Map();let nextTimer=0,opened=0;
  const originalSetTimeout=globalThis.setTimeout,originalClearTimeout=globalThis.clearTimeout;
  globalThis.setTimeout=(callback,delay)=>{const id=++nextTimer;timers.set(id,{callback,at:f.now()+delay});return id;};
  globalThis.clearTimeout=id=>timers.delete(id);
  globalThis.__companionTestOpenGame=()=>{opened++;};
  try {
    // Keep the actual site handlers. Redirect only imports: use the real isolated
    // companion and a game-opening stub, whose modal is tested separately.
    const stub='data:text/javascript,'+encodeURIComponent(`export function openHopGame(){globalThis.__companionTestOpenGame();}//${++fixtureNumber}`);
    await import(stub);
    let source=fs.readFileSync(dir+'site.js','utf8');
    assert.equal([...source.matchAll(/from '\.\/companion\.js[^']*'/g)].length,1);
    assert.equal([...source.matchAll(/import\('\.\/hop-game\.js[^']*'\)/g)].length,1);
    source=source.replace(/from '\.\/companion\.js[^']*'/,`from '${moduleURL}?fixture=site-hints-${fixtureNumber}'`)
      .replace(/import\('\.\/hop-game\.js[^']*'\)/,`import('${stub}')`);
    await import('data:text/javascript,'+encodeURIComponent(source));await flush();
    const step=time=>{f.step(time);for(const [id,timer]of [...timers])if(timer.at<=time){timers.delete(id);timer.callback();}};
    await check({opened:()=>opened,step,timers});
  } finally {
    globalThis.setTimeout=originalSetTimeout;globalThis.clearTimeout=originalClearTimeout;
    delete globalThis.__companionTestOpenGame;
  }
}
const durations={insurance:7800,ecology:7000,packing:8000,watermark:7800};
for(const [kind,duration]of Object.entries(durations)){
  const f=fixture();const {createCompanion}=await f.load();const api=createCompanion(f.canvas);await flush();
  assert.equal(f.last().kind,'idle');assert.equal(f.last().ready,true);assert.equal(f.frames.size,0);
  await api.select(kind);f.stats.frames.clear();
  const poseTrace=[];
  for(let t=0;t<=duration+10;t+=10){
    f.step(t);
    const trackedAtlas=kind==='ecology'?'map':'typing';
    const poses=f.stats.lastDraw.filter(draw=>draw.name===trackedAtlas&&draw.alpha>0);
    if(poses.length){
      const dominant=poses.reduce((a,b)=>b.alpha>=a.alpha?b:a);
      const previous=poseTrace.at(-1);
      if(previous?.index===dominant.index)previous.end=t;
      else poseTrace.push({index:dominant.index,start:t,end:t});
    }
  }
  if(kind==='insurance'||kind==='watermark'){
    for(const blinkIndex of [9,10]){
      const runs=poseTrace.filter(run=>run.index===blinkIndex);
      assert.equal(runs.length,1,`${kind}: blink pose ${blinkIndex} must occur once`);
      const held=runs[0].end-runs[0].start+10;
      assert(held>=40&&held<=120,`${kind}: blink pose ${blinkIndex} held ${held} ms`);
    }
    const blink=poseTrace.findIndex(run=>run.index===9);
    assert.deepEqual(poseTrace.slice(blink,blink+3).map(run=>run.index),[9,10,11],`${kind}: blink must close and reopen in order`);
    const normal=poseTrace.slice(1,-1).filter(run=>![9,10,11].includes(run.index));
    assert(normal.length>=8,`${kind}: too few normal pose holds to assess pacing`);
    assert(normal.every(run=>run.end-run.start+10>=180),`${kind}: normal typing poses change too quickly`);
    assert(normal.some(run=>run.end-run.start+10>=450),`${kind}: no natural pause between typing bursts`);
    const final=poseTrace.at(-1);
    assert.equal(final.index,15);assert(final.end-final.start>=500,`${kind}: missing quiet final hold`);
    assert(!f.stats.blends.some(blend=>blend.draws.some(draw=>[9,10,11].includes(draw.index))),`${kind}: blink eyes should not crossfade`);
    console.log(`${kind}: one short blink, slower normal poses, a natural pause, and a final hold verified.`);
  }
  if(kind==='ecology'){
    assert(poseTrace.slice(1,-1).every(run=>run.end-run.start+10>=180),'Map poses change too quickly');
    const final=poseTrace.at(-1);assert.equal(final.index,15);assert(final.end-final.start>=350,'Map should settle before playback ends');
  }
  if(kind!=='packing'){
    assert(f.stats.blends.some(blend=>blend.draws.filter(draw=>draw.alpha>0&&draw.alpha<1).length===2),`${kind}: no intermediate pose crossfade exercised`);
    assert(f.stats.blends.every(blend=>Math.abs(blend.coverage-1)<1e-9),`${kind}: crossfade opacity dipped`);
  }else assert.equal(f.stats.blends.length,0,'Packing should keep its original direct-sprite animation');
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
  const f=fixture();const {createCompanion}=await f.load();const api=createCompanion(f.canvas);await flush();
  let now=0;
  for(const reaction of ['curious','happy','croak']){
    f.setNow(now);api.react(reaction);
    assert.equal(f.last().kind,'idle');assert.equal(f.last().reaction,reaction);
    assert.equal(f.last().playing,false);assert.equal(f.frames.size,1);
    f.step(now+350);
    assert(f.stats.lastDraw.every(draw=>draw.name==='hop'));
    if(reaction!=='curious')assert(f.stats.lastDraw.some(draw=>draw.index===2),'Tap reaction should use its crouched body pose');
    f.step(now+800);
    assert.equal(f.last().reaction,null);assert.equal(f.last().kind,'idle');assert.equal(f.frames.size,0);
    assert.equal(f.stats.lastDraw.length,1);assert.equal(f.stats.lastDraw[0].index,0);
    now+=1000;
  }
  api.destroy();
  console.log('Hover and tap reactions finish within 800 ms and return to the idle pose without a persistent loop.');
}
{
  const f=fixture();const {createCompanion}=await f.load();const api=createCompanion(f.canvas);await flush();await api.select('ecology');f.step(1300);
  const pausedPicture=structuredClone(f.stats.lastDraw);
  api.react('happy');
  assert.equal(f.last().kind,'ecology');assert.equal(f.last().playing,false);assert.equal(f.last().ready,true);
  f.step(1600);assert(f.stats.lastDraw.every(draw=>draw.name==='hop'));
  f.step(2100);assert.deepEqual(f.stats.lastDraw,pausedPicture,'Reaction must restore the same selected-scene picture');
  assert.equal(f.frames.size,0);
  for(let i=0;i<100;i++){
    f.setNow(2200+i*2);api.react(i%2?'croak':'curious');
    assert.equal(f.frames.size,1,'Rapid reactions replace their scheduled frame');
    assert.equal(f.last().kind,'ecology');
  }
  f.step(3300);assert.equal(f.frames.size,0);assert.deepEqual(f.stats.lastDraw,pausedPicture);
  api.react('happy');api.pause();assert.equal(f.last().reaction,null);assert.equal(f.frames.size,0);assert.deepEqual(f.stats.lastDraw,pausedPicture);
  api.react('croak');api.replay();assert.equal(f.last().reaction,null);assert.equal(f.last().playing,true);assert.equal(f.frames.size,1);
  f.step(3600);api.react('curious');await api.select('packing');
  assert.equal(f.last().reaction,null);assert.equal(f.last().kind,'packing');assert.equal(f.frames.size,1);
  api.react('happy');api.destroy();assert.equal(f.frames.size,0);assert.equal(f.observers.size,0);
  const draws=f.stats.drawCount;api.react('croak');f.step(5000);assert.equal(f.stats.drawCount,draws);
  console.log('Reactions preserve the selected scene and replay; rapid taps, pause, selection, and destruction cancel transient work.');
}
{
  const f=fixture({reduced:true});const {createCompanion}=await f.load();const api=createCompanion(f.canvas);await flush();await api.select('insurance');
  const still=structuredClone(f.stats.lastDraw);
  for(const reaction of ['curious','happy','croak']){
    api.react(reaction);assert.equal(f.frames.size,0);assert.equal(f.last().reaction,null);assert.deepEqual(f.stats.lastDraw,still);
  }
  f.motion.matches=false;f.motion.dispatchEvent({type:'change'});api.react('croak');assert.equal(f.frames.size,1);
  f.motion.matches=true;f.motion.dispatchEvent({type:'change'});
  assert.equal(f.frames.size,0);assert.equal(f.last().reaction,null);assert.deepEqual(f.stats.lastDraw,still);
  f.motion.matches=false;f.doc.hidden=true;api.react('happy');assert.equal(f.frames.size,0);assert.equal(f.last().reaction,null);
  api.destroy();
  console.log('Reduced motion and hidden documents suppress reactions; changing motion preference cancels an active reaction.');
}
{
  const f=fixture({delayed:true});const {createCompanion}=await f.load();const api=createCompanion(f.canvas);
  const selected=api.select('insurance');api.react('happy');assert.equal(f.frames.size,0);
  f.resolveImage('hop');f.resolveImage('typing');f.resolveMetadata();await selected;await flush();
  assert.equal(f.last().kind,'insurance');assert.equal(f.last().ready,true);assert.equal(f.last().playing,false);assert.equal(f.frames.size,0);
  api.replay();assert.equal(f.frames.size,1);api.destroy();
  console.log('Reacting during asset loading keeps the selected project but suppresses delayed autoplay.');
}
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
  const f=fixture();await checkSiteEntrances(f,async clock=>{
    const secret=f.elements.get('companion-secret'),hint=f.elements.get('companion-hint');
    secret.dispatchEvent({type:'pointerenter',pointerType:'touch'});assert.equal(hint.textContent,'');
    secret.dispatchEvent({type:'pointerenter',pointerType:'mouse'});assert.equal(hint.textContent,'…oh, hello.');assert.equal(f.last().reaction,'curious');
    clock.step(800);secret.dispatchEvent({type:'click',detail:1});assert.equal(hint.textContent,'mrrp?');assert.equal(f.last().reaction,'happy');
    clock.step(1600);secret.dispatchEvent({type:'click',detail:1});assert.equal(hint.textContent,'…again?');assert.equal(f.last().reaction,'croak');
    assert.equal(clock.opened(),0,'The first two taps do not open the modal');
    clock.step(1700);secret.dispatchEvent({type:'click',detail:1});await flush();
    assert.equal(clock.opened(),1);assert.equal(hint.textContent,'');assert.equal(clock.timers.size,0);assert.equal(f.frames.size,0);
    secret.dispatchEvent({type:'click',detail:0});secret.dispatchEvent({type:'click',detail:0});secret.dispatchEvent({type:'click',detail:0});await flush();
    assert.equal(clock.opened(),2,'Repeated activation while import is pending opens only once');
    clock.step(3000);secret.dispatchEvent({type:'click',detail:1});assert.equal(hint.textContent,'mrrp?');
    clock.step(4801);assert.equal(hint.textContent,'');assert.equal(clock.timers.size,0);
    secret.dispatchEvent({type:'pointerenter',pointerType:'mouse'});assert.equal(hint.textContent,'…oh, hello.','Hover returns after a stale tap expires');
    secret.dispatchEvent({type:'click',detail:1});assert.equal(hint.textContent,'mrrp?','A stale tap sequence restarts at the first reaction');
    assert.equal(clock.opened(),2);
    f.win.location.hash='#make-hop';f.win.dispatchEvent({type:'hashchange'});await flush();
    assert.equal(clock.opened(),3);assert.equal(hint.textContent,'');assert.equal(clock.timers.size,0);
  });
  const direct=fixture({initialHash:'#make-hop'});await checkSiteEntrances(direct,async clock=>{
    assert.equal(clock.opened(),1,'A direct #make-hop entrance opens once');
    assert.equal(direct.frames.size,0,'Direct entrance leaves the companion paused');
  });
  console.log('site.js: hover, first/second tap hints, stale reset, third/keyboard/hash entrances, and repeated pending activation passed.');
}
{
  const f=fixture({noCanvas:true});await import(pathToFileURL(dir+'site.js').href+'?fixture=no-canvas');await flush();
  assert.equal(f.elements.get('companion-rail').hidden,true);assert.equal(f.elements.get('theme-toggle').hidden,false);
  assert.equal(f.elements.get('theme-label').textContent,'dark');
  assert.match(f.elements.get('theme-toggle').attributes['aria-label'],/Theme: dark\. Switch to Solarized light theme/);
  f.elements.get('theme-toggle').dispatchEvent({type:'click'});assert.equal(f.doc.documentElement.dataset.theme,'light');
  assert.equal(f.elements.get('theme-label').textContent,'light');
  assert.match(f.elements.get('theme-toggle').attributes['aria-label'],/Theme: light\. Switch to Solarized dark theme/);
  f.projects[1].open=true;await flush();assert.equal(f.projects[1].open,true);assert.equal(f.frames.size,0);
  console.log('Canvas unavailable: empty rail hides; theme control and native dropdowns still function.');
}
