const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'ui/pinless-refresh.js'), 'utf8').replace('__INDIVIDUOUS_ASSET_BUILD__', 'current-build');
async function run({css='old-build', js='current-build', ok=true, playing=false, storage=new Map()}={}) {
  const requests=[]; let reloads=0;
  const scripts={ptBodyShuffleVersion:1,appDataControlsVersion:2,pinlessControlsVersion:3,individuousBrandVersion:1,ptLoopPreferenceVersion:1,ptYouTubeConnectionVersion:9,ptPlaylistWallVersion:1,ptPlaylistBannerVersion:1,individuousAssetBuild:js};
  const document={documentElement:{},addEventListener:(_,fn)=>fn(),querySelector:selector=>selector.startsWith('link')?{href:'/css/default.css?v=old'}:selector.includes('handlers.js')?{src:'/js/handlers.js?v=old'}:selector==='video'?(playing?{paused:false}:null):null};
  const window={...scripts,fetch:true};
  vm.runInNewContext(source,{window,document,location:{pathname:'/star.html',reload:()=>reloads++},getComputedStyle:()=>({getPropertyValue:()=>JSON.stringify(css)}),sessionStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},setTimeout:fn=>fn(),Date,fetch:async(url,options)=>{requests.push({url,...options});return {ok};}});
  await new Promise(resolve=>setImmediate(resolve));
  return {requests,reloads,storage};
}
test('new JS with an old stylesheet refreshes even if all feature versions match',async()=>{
 const result=await run(); assert.equal(result.reloads,1);assert.equal(result.requests.length,3);assert(result.requests.every(r=>r.cache==='reload'));
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
