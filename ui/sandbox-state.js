/* One current wall per tab: metadata only, never media bytes. */
;(() => {
 const key='pt-sandbox-wall-v1';
 const params=new URLSearchParams(location.search);
 const eligible=(location.pathname==='/feed/subscriptions'&&!params.has('pt_page')) || (location.pathname==='/search'&&params.get('pt_page')!=='hidden');
 const source=location.pathname+location.search.replace(/([?&])pt_restore=1(&|$)/,(_,a,b)=>b?a:'').replace(/[?&]$/,'');
 let saved=null;try{saved=JSON.parse(sessionStorage.getItem(key));}catch(_){}
 const restore=params.get('pt_restore')==='1'&&saved?.source===source?saved:null;
 let provider=null, ready=false;
 function href(){return saved?.source ? saved.source+(saved.source.includes('?')?'&':'?')+'pt_restore=1' : '/feed/subscriptions';}
 function links(){const a=document.querySelector('.pt-sandbox-link');if(a)a.href=href();}
 function videos(){return [...document.querySelectorAll('.pt-wall .pt-video')].filter(n=>!n.hidden).map(n=>{const t=n.querySelector('.pt-thumb');return {videoId:t.dataset.ptId,title:n.querySelector('.pt-label-title')?.textContent||'',author:t.dataset.ptChannelName||'',authorId:t.dataset.ptChannel||'',lengthSeconds:Number(t.dataset.ptLength)||0};});}
 function save(){if(!eligible||!ready)return;const items=videos();if(!items.length&&location.pathname!=='/search')return;const value={source,items,scroll:scrollY,state:provider?.()||null};try{sessionStorage.setItem(key,JSON.stringify(value));saved=value;links();}catch(_){}}
    function card(video) {
      const node = document.createElement('div'); node.className = 'pure-u-1 pure-u-md-1-4';
      const box = document.createElement('div'); box.className = 'h-box';
      const thumb = document.createElement('div'); thumb.className = 'thumbnail';
      const link = document.createElement('a'); link.href = '/watch?v=' + video.videoId;
      const img = document.createElement('img'); img.className = 'thumbnail'; img.src = '/vi/' + video.videoId + '/mqdefault.jpg'; img.alt = video.title; img.loading = 'lazy';
      link.append(img); thumb.append(link);
      const length = document.createElement('p'); length.className = 'length';
      const seconds = Number(video.lengthSeconds) || 0;
      length.textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0'); thumb.append(length);
      const row = document.createElement('div'); row.className = 'video-card-row';
      const title = document.createElement('a'); title.href = link.href; title.textContent = video.title;
      const author = document.createElement('a'); author.href = '/channel/' + video.authorId; author.textContent = video.author;
      row.append(title, author); box.append(thumb, row); node.append(box); return node;
    }


 window.ptSandbox={restore,card,register(fn){provider=fn;ready=true;},save,href};
 function start(){
   links();
   if(!eligible)return;
   const ordinary=location.pathname==='/search'&&params.get('pt_page')!=='discover';
   if(ordinary){
     const wall=document.querySelector('.pt-wall');
     if(restore&&wall){document.dispatchEvent(new Event('feed:replacing'));wall.replaceChildren(...restore.items.map(card));document.dispatchEvent(new Event('continuous:appended'));}
     ready=true;
   }
   if(restore){let count=0;const timer=setInterval(()=>{scrollTo(0,restore.scroll||0);if(++count===8)clearInterval(timer);},100);}
   if(ordinary)save();
 }
 document.addEventListener('continuous:appended',()=>{if(ready)save();});
 addEventListener('pagehide',save);
 document.addEventListener('click',e=>{if(e.target.closest('a[href]'))save();},true);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,0),{once:true});else setTimeout(start,0);
})();
