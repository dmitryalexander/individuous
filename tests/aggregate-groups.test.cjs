const {test} = require('node:test');
const assert = require('node:assert/strict');
const A = require('../ui/aggregate-groups.js');
test('All Lists combines saved videos once while preserving source playlists',() => {
  const video={id:'abcdefghijk',title:'First'}, other={id:'zyxwvutsrqp',title:'Second'};
  const data={activeId:'one',lists:[{id:'one',name:'One',items:[video]},{id:'two',name:'Two',items:[video,other]}]};
  const before=JSON.stringify(data), combined=A.combine(data,'items');
  assert.deepEqual(combined.lists[0],{id:A.ID,name:'All Lists',items:[video,other]});
  assert.equal(JSON.stringify(data),before); assert.equal(combined.activeId,'one');
});
test('Search All Groups combines terms without case duplicates or copying stale aggregate data',() => {
  const data={activeId:A.ID,lists:[{id:A.ID,name:A.NAME,terms:['obsolete']},{id:'a',name:'A',terms:['Japan news']},{id:'b',name:'B',terms:['japan news','music']}]};
  assert.equal(A.combine(data,'terms').lists[0].name,'All Groups');
  assert.deepEqual(A.combine(data,'terms').lists[0].terms,['Japan news','music']);
});
test('only the aggregate marker is persisted; contents rebuild as named groups change',() => {
  const combined=A.combine({activeId:A.ID,lists:[{id:'a',name:'A',items:[{id:'abcdefghijk',title:'Video'}]}]},'items');
  const saved=A.persist(combined,'items'); assert.deepEqual(saved.lists[0].items,[]);
  assert.equal(A.combine(saved,'items').lists[0].items.length,1);
  saved.lists=saved.lists.filter(list=>list.id===A.ID);
  assert.deepEqual(A.combine(saved,'items').lists[0].items,[]);
});
