const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const M=require('../ui/following-groups-model.js'),id='UC'+'a'.repeat(22),other='UC'+'b'.repeat(22);
function fixture({url='/subscription_manager',data=M.defaults(),dialog=false}={}) {
 const events={},windowEvents={},rootEvents={},values=new Map([[M.KEY,JSON.stringify(data)]]),writes=[],classes=new Set(),attrs={};
 const card={hidden:false,isConnected:true,dataset:{followingId:id},offsetWidth:100,classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)},querySelector:()=>({textContent:'Fixture creator',querySelector:()=>({textContent:'Fixture creator'})}),querySelectorAll:()=>[],setAttribute:(k,v)=>{attrs[k]=v},closest:selector=>selector.includes('.pt-subscription')?card:null,contains:node=>node===card};
 const form={getAttribute:()=>'/subscription_ajax?c='+id,closest:()=>card};
 const body={append(){},closest:()=>null},document={readyState:'loading',activeElement:body,body,documentElement:{addEventListener:(key,fn)=>{rootEvents[key]=fn}},addEventListener:(key,fn)=>{events[key]=fn},querySelectorAll:selector=>selector.startsWith('form')?[form]:[],querySelector:selector=>selector==='dialog[open]'&&dialog?{}:null,createElement:()=>({setAttribute(){},textContent:''})};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../ui/following-groups.js'),'utf8'),{window:{ptFollowingGroupModel:M},location:{origin:'http://localhost',pathname:new URL('http://localhost'+url).pathname,search:new URL('http://localhost'+url).search},URL,URLSearchParams,document,localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);writes.push({key,value})}},addEventListener:(key,fn)=>{windowEvents[key]=fn},setTimeout:()=>1,clearTimeout(){}});
 function key(overrides={}) {let prevented=false,stopped=false;events.keydown({key:'a',target:body,preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true},...overrides});return {prevented,stopped};}
 return {events,rootEvents,windowEvents,writes,key,card,body,classes,attrs,get data(){return JSON.parse(values.get(M.KEY))},point(target=card){events.pointermove({target})}};
}
test('A over a creator persists Favorites membership without a follow/unfollow request or view change',()=>{
 const f=fixture();f.point();assert.deepEqual(f.key(),{prevented:true,stopped:true});assert.equal(f.writes.length,1);assert.equal(f.data.activeId,M.ALL);
 assert.deepEqual(f.data.lists.find(g=>g.id===M.FAVORITES).channels,[id]);assert(f.classes.has('pt-creator-added'));f.key();assert.deepEqual(f.data.lists.find(g=>g.id===M.FAVORITES).channels,[id]);
});
test('the viewed named group takes precedence over stored active group for A',()=>{
 const data=M.defaults();data.lists.push({id:'music',name:'Music',channels:[other]});
 const f=fixture({data,url:'/subscription_manager?pt_following=music'});f.point();f.key();
 assert.deepEqual(f.data.lists.find(g=>g.id==='music').channels,[other,id]);assert.deepEqual(f.data.lists.find(g=>g.id===M.FAVORITES).channels,[]);
});
test('A guards typing, dialogs, modifiers, repeats, outside-card pointers and page leave',()=>{
 for(const overrides of [{ctrlKey:true},{altKey:true},{metaKey:true},{shiftKey:true},{repeat:true},{isComposing:true},{defaultPrevented:true},{target:{closest:selector=>selector.startsWith('input')?{}:null}}]) {const f=fixture();f.point();f.key(overrides);assert.equal(f.writes.length,0);}
 const modal=fixture({dialog:true});modal.point();modal.key();assert.equal(modal.writes.length,0);
 const f=fixture();f.point(f.body);f.key();assert.equal(f.writes.length,0);f.point();f.rootEvents.pointerleave();f.key();assert.equal(f.writes.length,0);
});
test('A on individual channel pages remains available to existing follow controls',()=>{
 const f=fixture({url:'/channel/'+id});f.point();assert.deepEqual(f.key(),{prevented:false,stopped:false});assert.equal(f.writes.length,0);
});
test('X twice in a named group removes only that membership',()=>{
 const data=M.defaults();data.activeId=M.FAVORITES;M.setMembers(data,M.FAVORITES,[id,other]);
 const f=fixture({data});f.point();f.key({key:'x'});assert.equal(f.writes.length,0);f.key({key:'x'});
 assert.deepEqual(f.data.lists.find(g=>g.id===M.FAVORITES).channels,[other]);assert.equal(f.data.activeId,M.FAVORITES);assert.equal(f.card.hidden,true);
});
