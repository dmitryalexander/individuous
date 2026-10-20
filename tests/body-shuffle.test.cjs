const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../ui/pinless-look.js'), 'utf8');
const start = source.indexOf('  function shuffleManagerWall() {');
const end = source.indexOf('\n  const HIDDEN_KEY', start);
assert(start > 0 && end > start, 'Actual body shuffle handler must be available.');
const handler = source.slice(start, end) + '\nshuffleManagerWall();';
const card = (id, pinned = false) => ({id, matches: selector => pinned && selector.includes('pt-watch-featured')});
function fixture(url, {pinned = false, random = () => 0} = {}) {
  const events = {}, rootEvents = {}, windowEvents = {};
  const featured = card('player', true);
  const wall = {children: [...(pinned ? [featured] : []), card('a'), card('b'), card('c')], moved: [], append(...items) {
    this.moved.push(...items); this.children = this.children.filter(item => !items.includes(item)).concat(items);
  }};
  let layouts = 0, dialog = false, pointed = 'body';
  const target = {closest: selector => selector === '.pt-header' ? (pointed === 'header' ? {} : null) : (pointed === 'body' && selector === '#contents' ? {} : null)};
  const document = {addEventListener: (key, fn) => {events[key] = fn;}, documentElement: {addEventListener: (key, fn) => {rootEvents[key] = fn;}}, elementFromPoint: () => target};
  vm.runInNewContext(handler, {location: {pathname: url}, document, addEventListener: (key, fn) => {windowEvents[key] = fn;},
    $: () => dialog, $$: () => [wall], scheduleLayout: () => {layouts++;}, Math: Object.assign(Object.create(Math), {random})});
  function key(overrides = {}, typing = false) {
    let prevented = false;
    const event = {key: 's', target: {closest: () => typing ? {} : null}, preventDefault() {prevented = true;}, stopImmediatePropagation() {}, ...overrides};
    events.keydown?.(event); return prevented;
  }
  return {wall, featured, events, rootEvents, windowEvents, key, get layouts() {return layouts;},
    pointer(where = 'body') {pointed = where; events.pointermove?.({clientX: 200, clientY: 300});},
    dialog(value) {dialog = value;}};
}
for (const url of ['/watch', '/channel/UC' + 'a'.repeat(22), '/channel/UC' + 'a'.repeat(22) + '/videos', '/channel/UC' + 'a'.repeat(22) + '/shorts']) {
  test('S shuffles loaded cards over the page body: ' + url, () => {
    const f = fixture(url); f.pointer();
    assert(f.key()); assert.notDeepEqual(f.wall.children.map(n => n.id), ['a', 'b', 'c']); assert.equal(f.layouts, 1);
    const extra = card('loaded-later'); f.wall.children.push(extra); f.key(); assert(f.wall.moved.includes(extra));
  });
}
test('watch shuffle leaves the main player attached, first and untouched', () => {
  const f = fixture('/watch', {pinned: true}); f.pointer(); f.key();
  assert.equal(f.wall.children[0], f.featured); assert(!f.wall.moved.includes(f.featured));
  assert.deepEqual(f.wall.children.slice(1).map(n => n.id).sort(), ['a', 'b', 'c']);
});
test('a random draw equal to the old order still visibly changes the wall', () => {
  const f = fixture('/watch', {random: () => .999}); f.pointer(); f.key();
  assert.notDeepEqual(f.wall.children.map(n => n.id), ['a', 'b', 'c']);
});
test('typing, dialogs, header, outside body, modifiers and stale pointers do not shuffle', () => {
  const f = fixture('/watch');
  assert(!f.key()); f.pointer('header'); assert(!f.key()); f.pointer('outside'); assert(!f.key());
  f.pointer(); assert(!f.key({}, true)); f.dialog(true); assert(!f.key()); f.dialog(false);
  for (const field of ['defaultPrevented', 'repeat', 'ctrlKey', 'metaKey', 'altKey', 'isComposing']) assert(!f.key({[field]: true}), field);
  assert(!f.key({key: 'a'})); f.windowEvents.blur(); assert(!f.key());
  f.pointer(); f.rootEvents.pointerleave(); assert(!f.key()); assert.equal(f.layouts, 0);
});
test('existing manager/search/history walls retain S while other routes are untouched', () => {
  for (const url of ['/subscription_manager', '/feed/history', '/search']) {const f = fixture(url); f.pointer(); assert(f.key(), url);}
  for (const url of ['/feed/subscriptions', '/playlist', '/star.html', '/channel/not-a-channel']) assert.equal(fixture(url).events.keydown, undefined, url);
});
