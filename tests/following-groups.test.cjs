const {test} = require('node:test');
const assert = require('node:assert/strict');
const M = require('../ui/following-groups-model.js');
const a = 'UC' + 'a'.repeat(22), b = 'UC' + 'b'.repeat(22), c = 'UC' + 'c'.repeat(22);
function data() { return {...M.defaults(), lists:[...M.defaults().lists,{id:'music',name:'Music',channels:[a,b]},{id:'learning',name:'Learning',channels:[a,c]}]}; }
test('existing follows remain the default without migration or writes',() => {
  const groups = M.read(null); assert.equal(groups.activeId,'all');
  assert.deepEqual(M.filter(groups,[a,b,a]),[a,b]);
});
test('feeds include only followed creators in the selected group, allowing overlap',() => {
  const groups = data(); groups.activeId='music'; assert.deepEqual(M.filter(groups,[a,c]),[a]);
  groups.activeId='learning'; assert.deepEqual(M.filter(groups,[a,b,c]),[a,c]);
  M.setMembers(groups,'learning',[]); assert.deepEqual(M.filter(groups,[a,b,c]),[]);
});
test('membership and group deletion preserve follows and other groups',() => {
  const follows = Object.freeze([a,b,c]), groups = data();
  M.setMembers(groups,'music',[b,b]); assert.deepEqual(groups.lists.find(g=>g.id==='music').channels,[b]);
  groups.lists=groups.lists.filter(g=>g.id!=='music'); groups.activeId='all'; M.validate(groups);
  assert.deepEqual(M.filter(groups,follows),[a,b,c]); assert.deepEqual(groups.lists.find(g=>g.id==='learning').channels,[a,c]);
});
test('All Creators cannot be renamed, removed, or assigned static membership',() => {
  const groups = data(); assert.throws(() => M.setMembers(groups,'all',[a]));
  groups.lists[0].name='Other'; assert.throws(() => M.validate(groups));
  groups.lists.shift(); assert.throws(() => M.validate(groups));
});
test('invalid stored groups fail closed instead of silently overwriting data',() => {
  for (const raw of ['bad','{}','null',JSON.stringify({...data(),activeId:'missing'})]) assert.throws(() => M.read(raw));
  const groups=data(); groups.lists[1].channels=['not-a-channel']; assert.throws(() => M.validate(groups));
});
test('the existing protected group migrates to All Creators without changing memberships',() => {
  const old=data(); old.lists[0].name='All following'; old.activeId='music';
  const migrated=M.read(JSON.stringify(old)); assert.equal(migrated.lists[0].name,'All Creators');
  assert.equal(migrated.activeId,'music'); assert.deepEqual(migrated.lists.find(g=>g.id==='music').channels,[a,b]);
});
test('group metadata hydrates from app-data and later edits are mirrored back',async () => {
  const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
  class Storage {
    constructor() { this.values = new Map(); }
    get length() { return this.values.size; }
    key(index) { return [...this.values.keys()][index]; }
    getItem(key) { return this.values.get(key) ?? null; }
    setItem(key,value) { this.values.set(key,String(value)); }
    removeItem(key) { this.values.delete(key); }
  }
  const storage = new Storage(), fixture = JSON.stringify(data()), timers = [], sent = [];
  class XMLHttpRequest {
    open() {} send() { this.status=200; this.responseText=JSON.stringify({items:{[M.KEY]:fixture}}); }
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../ui/app-data.js'),'utf8'),{
    Storage,XMLHttpRequest,window:{localStorage:storage},addEventListener(){},
    setTimeout:fn => { timers.push(fn); return timers.length; },clearTimeout(){},
    fetch:async (url,request) => { sent.push({url,body:JSON.parse(request.body)}); return {ok:true}; }
  });
  assert.equal(storage.getItem(M.KEY),fixture);
  const changed = data(); changed.activeId='music'; storage.setItem(M.KEY,JSON.stringify(changed));
  timers.forEach(fn => fn()); await new Promise(resolve => setImmediate(resolve));
  assert.equal(sent.length,1); assert.equal(sent[0].url,'/app-data/items');
  assert.equal(sent[0].body.items[M.KEY],JSON.stringify(changed));
});


test('legacy All Creators data gains empty Favorites without moving existing memberships',()=>{
 const original={activeId:'music',lists:[{id:M.ALL,name:'All Creators',channels:[]},{id:'music',name:'Music',channels:[a]}]},raw=JSON.stringify(original);
 const migrated=M.read(raw);assert.equal(migrated.defaultId,M.FAVORITES);assert.equal(migrated.activeId,'music');
 assert.deepEqual(migrated.lists.find(g=>g.id===M.FAVORITES),{id:M.FAVORITES,name:'Favorites',channels:[]});
 assert.deepEqual(migrated.lists.find(g=>g.id==='music').channels,[a]);assert.equal(JSON.stringify(original),raw);
 assert.deepEqual(M.read(JSON.stringify(migrated)),migrated);
});
test('existing Favorites is reused and ID collisions do not overwrite another group',()=>{
 const original={activeId:M.ALL,lists:[{id:M.ALL,name:'All Creators',channels:[]},{id:'old-favorite',name:'Favorites',channels:[a]}]};
 assert.equal(M.read(JSON.stringify(original)).defaultId,'old-favorite');
 original.lists[1]={id:'favorites',name:'Music',channels:[a]};const migrated=M.read(JSON.stringify(original));
 assert.equal(migrated.defaultId,'favorites-2');assert.deepEqual(migrated.lists.find(g=>g.id==='favorites').channels,[a]);
});
test('A from All Creators adds only to Favorites, is idempotent, and keeps All Creators active',()=>{
 const groups=M.defaults();M.addToActive(groups,a);M.addToActive(groups,a);
 assert.equal(groups.activeId,M.ALL);assert.deepEqual(groups.lists.find(g=>g.id===groups.defaultId).channels,[a]);
 assert.deepEqual(groups.lists.find(g=>g.id===M.ALL).channels,[]);assert.deepEqual(M.filter(groups,[a,b,c]),[a,b,c]);
});
test('A in a named group leaves Favorites and other groups unchanged',()=>{
 const groups=data();groups.activeId='music';const before=JSON.stringify(groups.lists.filter(g=>g.id!=='music'));
 M.addToActive(groups,c);assert.deepEqual(groups.lists.find(g=>g.id==='music').channels,[a,b,c]);
 assert.equal(JSON.stringify(groups.lists.filter(g=>g.id!=='music')),before);
});
test('renaming the default group preserves its identity; deleting it chooses another existing group',()=>{
 const groups=data();groups.lists.find(g=>g.id===groups.defaultId).name='Keep';
 const renamed=M.read(JSON.stringify(groups));assert.equal(renamed.lists.find(g=>g.id===renamed.defaultId).name,'Keep');
 renamed.lists=renamed.lists.filter(g=>g.id!==renamed.defaultId);const migrated=M.read(JSON.stringify(renamed));
 assert.equal(migrated.defaultId,'music');assert(!migrated.lists.some(g=>g.name==='Favorites'));
});
test('invalid creator additions do not alter group data',()=>{
 const groups=M.defaults(),before=JSON.stringify(groups);assert.throws(()=>M.addToActive(groups,'bad'));assert.equal(JSON.stringify(groups),before);
});
