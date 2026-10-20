const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(path,group={id:'all',name:'All Creators'}) {
 const elements=new Map();
 function node(tag='div') {
  const n={tagName:tag.toUpperCase(),dataset:{},children:[],classList:{toggle(){}},setAttribute(){},append(...items){n.children.push(...items)},before(child){elements.set(child.id,child)},remove(){elements.delete(n.id)}};
  Object.defineProperty(n,'id',{get:()=>n._id,set:value=>{n._id=value;elements.set(value,n)}});return n;
 }
 const contents=node(),wall=node(),status=node();
 const document={readyState:'loading',addEventListener(){},createElement:node,createTextNode:text=>({textContent:text}),getElementById:id=>elements.get(id)||null,querySelector:selector=>selector==='#contents'?contents:selector==='#contents .pt-wall'?wall:selector==='#contents .continuous-status'?status:selector==='#pt-empty-anchor'?elements.get('pt-empty-anchor')||null:null};
 const url=new URL('http://localhost'+path),window={ptFollowingGroups:{active:()=>group}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../ui/empty-tutorial.js'),'utf8'),{document,window,location:url,URLSearchParams});
 const flatten=n=>[n,...(n.children||[]).flatMap(flatten)];
 return {show:window.ptEmptyGuide.show,get section(){return elements.get('pt-empty-tutorial')},get nodes(){return flatten(elements.get('pt-empty-tutorial')||{})}};
}
for(const [path,source,kind,group] of [
 ['/subscription_manager','following','following',{id:'funny',name:'Funny'}],
 ['/subscription_manager','following','following',{id:'all',name:'All Creators'}],
 ['/feed/subscriptions?pt_following=funny','subscriptions','followingfeed',{id:'funny',name:'Funny'}],
 ['/feed/subscriptions','subscriptions','subscriptions',{id:'all',name:'All Creators'}],
 ['/feed/subscriptions?pt_restore=1','subscriptions','restore',{id:'all',name:'All Creators'}]
]) test('empty avatar introduction appears and disappears with content: '+path+' '+kind,()=>{
 const f=fixture(path,group);f.show(source,false);assert.equal(f.section,undefined);
 f.show(source,true);assert.equal(f.section.dataset.kind,kind);assert(f.nodes.some(n=>n.tagName==='IMG'&&n.src.startsWith('/tutorial-')));
 const first=f.section;f.show(source,true);assert.equal(f.section,first,'repeated empty notifications do not duplicate the introduction');
 f.show(source,false);assert.equal(f.section,undefined,'populated page remains clean');
 f.show(source,true);assert(f.section,'introduction returns if the group becomes empty again');
});
