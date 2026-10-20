/* Following-group metadata never changes the account's actual subscriptions. */
;((root) => {
  'use strict';
  const KEY = 'pt-following-groups-v1', ALL = 'all', FAVORITES = 'favorites';
  const channel = /^UC[\w-]{22}$/;
  const defaults = () => ({activeId:ALL, defaultId:FAVORITES, lists:[{id:ALL,name:'All Creators',channels:[]},{id:FAVORITES,name:'Favorites',channels:[]}]});
  function validate(data) {
    if (!data || !Array.isArray(data.lists) || !data.lists.length || typeof data.activeId !== 'string') throw Error('Could not read following groups. Your saved groups have been kept.');
    const ids = new Set(), names = new Set();
    for (const group of data.lists) {
      if (!group || typeof group.id !== 'string' || !group.id || ids.has(group.id) || typeof group.name !== 'string' || !group.name.trim() || group.name.length > 80 || names.has(group.name.trim().toLowerCase()) || !Array.isArray(group.channels) || group.channels.some(id => !channel.test(id))) throw Error('Could not read following groups. Your saved groups have been kept.');
      ids.add(group.id); names.add(group.name.trim().toLowerCase());
    }
    const all = data.lists.find(group => group.id === ALL);
    if (!all || all.name !== 'All Creators' || all.channels.length || !ids.has(data.activeId)) throw Error('The All Creators group must be kept.');
    return data;
  }
  function read(raw) {
    if (raw === null) return defaults();
    const data = JSON.parse(raw), all = data?.lists?.find(group => group.id === ALL);
    if (all?.name === 'All following') all.name = 'All Creators';
    return ensureDefault(data);
  }
  const active = data => validate(data).lists.find(group => group.id === data.activeId);
  function filter(data, followed) {
    const group = active(data), wanted = new Set(group.channels);
    return [...new Set(followed)].filter(id => channel.test(id) && (group.id === ALL || wanted.has(id)));
  }
  function setMembers(data, id, channels) {
    validate(data);
    if (id === ALL) throw Error('All Creators always includes everyone you follow.');
    const group = data.lists.find(group => group.id === id);
    if (!group) throw Error('This following group no longer exists.');
    group.channels = [...new Set(channels)]; return validate(data);
  }
  // Legacy groups gain Favorites without moving existing memberships or follows.
  function ensureDefault(data) {
    validate(data);
    if (data.defaultId !== undefined && typeof data.defaultId !== 'string') throw Error('Could not read the default creator group.');
    let group = data.lists.find(g => g.id !== ALL && g.id === data.defaultId);
    if (!group && data.defaultId) group = data.lists.find(g => g.id !== ALL);
    if (!group) group = data.lists.find(g => g.id !== ALL && g.name.trim().toLowerCase() === 'favorites');
    if (!group) {
      let id = FAVORITES, suffix = 2;
      while (data.lists.some(g => g.id === id)) id = FAVORITES + '-' + suffix++;
      group = {id,name:'Favorites',channels:[]}; data.lists.push(group);
    }
    data.defaultId = group.id; return data;
  }
  function addToActive(data, id) {
    if (!channel.test(id)) throw Error('Invalid creator.');
    ensureDefault(data);
    const target = active(data).id === ALL ? data.defaultId : data.activeId;
    const group = data.lists.find(g => g.id === target);
    setMembers(data,target,[...group.channels,id]); return group;
  }
  const api = {KEY,ALL,FAVORITES,defaults,validate,read,active,filter,setMembers,ensureDefault,addToActive};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ptFollowingGroupModel = api;
})(typeof window === 'undefined' ? globalThis : window);
