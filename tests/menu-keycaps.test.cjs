const {test} = require('node:test');
const assert = require('node:assert/strict');
const {parts} = require('../ui/menu-keycaps.js');
test('keyboard combinations and inline actions get individual caps without changing copy', () => {
  const text = 'Ctrl-click opens YouTube. Press Ctrl+Shift+X, then Esc. Press A again. Press G for groups.';
  const result = parts(text);
  assert.equal(result.map(part => part.text).join(''), text);
  assert.deepEqual(result.filter(part => part.key).map(part => part.text), ['Ctrl','Ctrl','Shift','X','Esc','A','G']);
});
test('ordinary articles and alphabetical ranges do not become shortcuts', () => {
  const text = 'A video can be in several playlists. A search. Creators from A to Z. Where A saves.';
  assert.deepEqual(parts(text).filter(part => part.key).map(part => part.text), ['A']);
  assert.equal(parts(text).map(part => part.text).join(''), text);
});
