const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'ui/pinless-refresh.js'), 'utf8').replace('__INDIVIDUOUS_ASSET_BUILD__', 'current-build');
async function run({css='old-build', js='current-build', ok=true, playing=false, storage=new Map(), storageFails=false, search="", latest=""}={}) {
  const requests=[],events={}; let reloads=0,replaces=0;
  const scripts={ptBodyShuffleVersion:1,appDataControlsVersion:2,pinlessControlsVersion:3,individuousBrandVersion:1,ptLoopPreferenceVersion:1,ptYouTubeConnectionVersion:9,ptPlaylistWallVersion:1,ptPlaylistBannerVersion:1,individuousAssetBuild:js};
  const document={querySelectorAll:()=>[{src:'/js/watch.js?v=old'},{href:'/css/player.css?v=old'},{src:'/tutorial-welcome.png'},{src:'/vi/private/mqdefault.jpg'},{src:'https://example.com/remote.js'}],documentElement:{},addEventListener:(_,fn)=>fn(),querySelector:selector=>selector.startsWith('link')?{href:'/css/default.css?v=old'}:selector.includes('handlers.js')?{src:'/js/handlers.js?v=old'}:selector==='video'?(playing?{paused:false}:null):null};
  const window={...scripts,fetch:true};
  vm.runInNewContext(source,{window,document,URL,addEventListener:(key,fn)=>{events[key]=fn;},location:{pathname:'/star.html',href:'http://localhost:3012/star.html'+search,origin:'http://localhost:3012',reload:()=>reloads++,replace:()=>replaces++},getComputedStyle:()=>({getPropertyValue:()=>JSON.stringify(css)}),sessionStorage:{getItem:key=>{if(storageFails)throw Error('Storage unavailable');return storage.get(key)},setItem:(key,value)=>storage.set(key,value)},setTimeout:fn=>fn(),Date,fetch:async(url,options)=>{requests.push({url,...options});return {ok,text:async()=>latest};}});
  await new Promise(resolve=>setImmediate(resolve));
  return {requests,get reloads(){return reloads},get replaces(){return replaces},storage,events};
}
test('new JS with an old stylesheet refreshes even if all feature versions match',async()=>{
 const result=await run(); assert.equal(result.reloads,1);assert.equal(result.requests.length,5);assert(result.requests.every(r=>r.cache==='reload'));
});
test('old JS with current stylesheet also refreshes',async()=>{assert.equal((await run({css:'current-build',js:'old-build'})).reloads,1)});
test('matching assets do not reload',async()=>{assert.equal((await run({css:'current-build'})).requests.length,0)});
test('failed asset fetch does not reload',async()=>{assert.equal((await run({ok:false})).reloads,0)});
test('refresh does not interrupt active playback',async()=>{const r=await run({playing:true});assert(r.requests.length);assert.equal(r.reloads,0)});
test('same-build reloads are throttled',async()=>{const first=await run();assert.equal((await run({storage:first.storage})).requests.length,0)});
test('both standalone pages participate in release asset stamping',()=>{
 for(const name of ['star.html','search-term-manager.html']) {
  const html=fs.readFileSync(path.join(root,'ui',name),'utf8');
  for(const asset of ['/css/default.css?v=release','/js/handlers.js?v=release','/js/pinless-refresh.js?v=release']) assert(html.includes(asset));
 }
 const docker=fs.readFileSync(path.join(root,'Dockerfile'),'utf8');assert(docker.indexOf('RUN sh /tmp/stamp-assets.sh')>docker.lastIndexOf('cat /tmp/'));
});

test('refresh covers player scripts, player styles and local art without fetching video thumbnails or foreign URLs',async()=>{
 const r=await run();assert(r.requests.some(x=>x.url.includes('/js/watch.js')));assert(r.requests.some(x=>x.url.includes('/css/player.css')));assert(r.requests.some(x=>x.url.includes('/tutorial-welcome.png')));assert(!r.requests.some(x=>x.url.includes('/vi/')||x.url.includes('example.com')));
});
test('unavailable session storage uses a bounded URL fallback',async()=>{
 assert.equal((await run({storageFails:true})).replaces,1);
 assert.equal((await run({storageFails:true,search:'?_pt_assets=current-build'})).requests.length,0);
});
test('Back/Forward restored pages detect a newly deployed interface',async()=>{
 const latest='a'.repeat(64),r=await run({css:'current-build',latest:"var BUILD = '"+latest+"';"});
 r.events.pageshow({persisted:true});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(r.requests[0].cache,'no-store');assert.equal(r.reloads,1);
});
