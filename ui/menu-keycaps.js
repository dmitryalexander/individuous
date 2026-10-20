/* Give every Menu shortcut the same amber keyboard caps as the empty-page guides. */
;(() => {
  'use strict';
  function parts(text) {
    const out = []; let at = 0;
    const pattern = /\b(?:Ctrl|Control|Shift|Alt|Enter|Esc|Escape|Space|Tab|Home|End|[ARXSZIG])\b|[⌘↑↓]/g;
    for (const match of text.matchAll(pattern)) {
      const name = match[0], before = text.slice(0, match.index), after = text.slice(match.index + name.length);
      // Do not mistake the article in “A video” or alphabetical “A to Z” for keys.
      if (name === 'A' && !(/\b(?:press|use|hit|where|key|with|over|and|then|or)\s*$/i.test(before) || /^\s+(?:again|cancels|works|saves|to\s+(?:save|add|follow|make))\b/.test(after))) continue;
      if (name === 'Z' && /\bA to\s*$/.test(before)) continue;
      if (match.index > at) out.push({text:text.slice(at, match.index)});
      out.push({text:name, key:true}); at = match.index + name.length;
    }
    if (at < text.length) out.push({text:text.slice(at)});
    return out;
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = {parts}; return; }
  if (new URLSearchParams(location.search).get('pt_page') !== 'menu') return;
  function decorate(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) {
      const text = walker.currentNode;
      if (text.parentElement?.closest('kbd,input,textarea,script,style,pre,code,button,a,h1,h2,h3')) continue;
      if (/Ctrl|Shift|Enter|Esc|Space|Tab|Home|End|⌘|↑|↓|\b[ARXSZIG]\b/.test(text.data)) texts.push(text);
    }
    for (const text of texts) {
      const parsed = parts(text.data); if (!parsed.some(part => part.key)) continue;
      const fragment = document.createDocumentFragment();
      for (const part of parsed) {
        if (part.key) { const cap = document.createElement('kbd'); cap.textContent = part.text; fragment.append(cap); }
        else fragment.append(document.createTextNode(part.text));
      }
      text.replaceWith(fragment);
    }
  }
  function start() {
    const contents = document.querySelector('#contents'); if (!contents) return;
    contents.querySelectorAll('.pt-guide').forEach(decorate);
    new MutationObserver(records => {
      const guides = new Set();
      for (const record of records) {
        const parent = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        const guide = parent?.closest('.pt-guide'); if (guide) guides.add(guide);
        for (const child of record.addedNodes) if (child.nodeType === 1) {
          if (child.matches('.pt-guide')) guides.add(child);
          child.querySelectorAll('.pt-guide').forEach(node => guides.add(node));
        }
      }
      guides.forEach(decorate);
    }).observe(contents, {childList:true, subtree:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
})();
