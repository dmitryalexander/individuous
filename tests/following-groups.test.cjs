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
  M.setMembers(groups,'music',[b,b]); assert.deepEqual(groups.lists[1].channels,[b]);
  groups.lists.splice(1,1); groups.activeId='all'; M.validate(groups);
  assert.deepEqual(M.filter(groups,follows),[a,b,c]); assert.deepEqual(groups.lists[1].channels,[a,c]);
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
  assert.equal(migrated.activeId,'music'); assert.deepEqual(migrated.lists[1].channels,[a,b]);
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
