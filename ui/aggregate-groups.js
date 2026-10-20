/* Computed All Groups views. Derived contents are never persisted as a collection. */
;((root) => {
  'use strict';
  const ID = '__pt_all_groups__', NAME = 'All Groups';
  function combine(data, field) {
    const source = data.lists.filter(list => list.id !== ID), seen = new Set(), values = [];
    for (const list of source) for (const value of list[field]) {
      const key = field === 'items' ? value.id : value.trim().toLowerCase();
      if (!seen.has(key)) { seen.add(key); values.push(value); }
    }
    return {...data,lists:[{id:ID,name:NAME,[field]:values},...source]};
  }
  function persist(data, field) {
    return {...data,lists:data.lists.map(list => list.id === ID ? {...list,name:NAME,[field]:[]} : list)};
  }
  const api = {ID,NAME,combine,persist};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ptAggregateGroups = api;
})(typeof window === 'undefined' ? globalThis : window);
