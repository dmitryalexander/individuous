/* A tab-local discovery wall built from the active search-term list. */
;(() => {
  'use strict';
  if (location.pathname !== '/search' || new URLSearchParams(location.search).get('pt_page') !== 'discover') return;
  const shuffle = items => { const a = [...items]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
  async function start() {
    const contents = document.querySelector('#contents'); if (!contents) return;
    // Preserve the header wherever upstream has placed it.
    const header = document.querySelector('.pt-header');
    if (header && contents.contains(header)) contents.before(header);
    document.dispatchEvent(new Event('feed:replacing'));
    contents.replaceChildren();
    const label = document.createElement('p'); label.className='pt-page-note';
    const wall = document.createElement('div'); wall.className='pure-g pt-wall';
    const bar = document.createElement('div'); bar.className='continuous-status';
    const status=document.createElement('span'); status.setAttribute('role','status');
    const more=document.createElement('button'); more.textContent='Load more';
    const mix=document.createElement('button'); mix.textContent='Shuffle videos';
    bar.append(status,mix,more); contents.append(wall,bar);
    let sources=[], busy=false, loaded=false, hasTerms=false;
    const seen=new Set();
    async function request(url) { const r=await fetch(url,{credentials:'same-origin',signal:AbortSignal.timeout(15000)}); if(!r.ok) throw Error('Search unavailable'); return r.json(); }
    async function terms() {
      const raw=localStorage.getItem('pt-search-term-lists-v1');
      let values, name='Recommended';
      if(raw){const data=window.ptAggregateGroups.combine(JSON.parse(raw),'terms');const active=data.lists.find(l=>l.id===data.activeId);if(!active)throw Error('Choose a search-term list first.');values=active.terms;name=active.name;}
      else {const saved=localStorage.getItem('pt-recommended-searches-v1');values=saved ? JSON.parse(saved) : [];}
      label.textContent='Search Groups Feed Â· '+name;
      sources=shuffle([...new Set(values.filter(t=>typeof t==='string').map(t=>t.trim()).filter(Boolean))]).map(q=>({q,page:1}));
      loaded=true; hasTerms=sources.length>0;
    }
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

    async function refresh(replace=false) {
      if(busy)return;busy=true;more.disabled=mix.disabled=true;status.textContent='Finding videos from your search termsâ€¦';
      try {
        if(!loaded)await terms();
        if(!sources.length){status.textContent=wall.children.length?'Youâ€™ve reached the end of these searches.':'No videos to show. Add terms in the search-term manager or try different terms.';return;}
        const batch=sources.splice(0,4);let failures=0;
        const groups=await Promise.all(batch.map(async source=>{
          try { const data=await request('/api/v1/search?'+((window.ptSearchTags&&window.ptSearchTags.apiParams(source.q,source.page))||new URLSearchParams({q:source.q,type:'video',page:String(source.page)})));
            if(!Array.isArray(data))throw Error('Invalid search results');
            if(data.length)sources.push({...source,page:source.page+1});
            return shuffle(data.filter(v=>v.type==='video' && /^[\w-]{11}$/.test(v.videoId) && (!window.ptSearchTags||window.ptSearchTags.apiKeep(source.q,v))));
          }catch(_){failures++;sources.push(source);return [];}
        }));
        let hidden=[];try{hidden=JSON.parse(localStorage.getItem('pt-hidden-feed-v1')||'[]').map(v=>v.id);}catch(_){}
        const excluded=new Set(hidden), picks=[];
        while(groups.some(g=>g.length))for(const group of groups){const v=group.shift();if(v&&!seen.has(v.videoId)&&!excluded.has(v.videoId)){seen.add(v.videoId);picks.push(v);}}
        if(picks.length){if(replace){document.dispatchEvent(new Event('feed:replacing'));wall.replaceChildren();}wall.append(...picks.map(card));document.dispatchEvent(new Event('continuous:appended'));}
        status.textContent=failures?'Some searches couldnâ€™t load. Click Load more to retry.':picks.length?'':'No new videos in this batch. Try Load more.';
      }catch(_){status.textContent='Couldnâ€™t load your search terms. Try again.';}
      finally{busy=false;more.disabled=mix.disabled=false;window.ptEmptyGuide?.show('discover', loaded && !wall.children.length, !hasTerms);}
    }
    more.onclick=()=>refresh();mix.onclick=()=>refresh(true);
    document.addEventListener('keydown',e=>{
      if(e.key.toLowerCase()!=='s'||e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.defaultPrevented||e.isComposing)return;
      if(e.target.closest('input,textarea,select,[contenteditable]')||document.querySelector('dialog[open]')||document.querySelector('.pt-header:hover'))return;
      e.preventDefault();e.stopImmediatePropagation();refresh(true);
    },true);
    // Explicit batches avoid silently walking an entire search list on short pages.
    const memory=window.ptSandbox;
    function groupKey() {
      try {
        const data = window.ptAggregateGroups.combine(JSON.parse(localStorage.getItem('pt-search-term-lists-v1')),'terms');
        const active = data.lists.find(group => group.id === data.activeId);
        return JSON.stringify([active.id,active.terms]);
      } catch (_) { return null; }
    }
    const selectedGroupKey = groupKey();
    memory?.register(()=>({kind:'discovery',groupKey:selectedGroupKey,sources,seen:[...seen],label:label.textContent}));
    if(memory?.restore?.state?.kind==='discovery' && selectedGroupKey && memory.restore.state.groupKey === selectedGroupKey){
      const snapshot=memory.restore; sources=snapshot.state.sources;loaded=true;snapshot.state.seen.forEach(id=>seen.add(id));label.textContent=snapshot.state.label;
      wall.append(...snapshot.items.map(card));document.dispatchEvent(new Event('continuous:appended'));window.ptEmptyGuide?.show('discover', !wall.children.length, !sources.length);
    }else await refresh();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
