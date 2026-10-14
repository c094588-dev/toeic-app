import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { clozeExample } from '../src/cloze.ts';

test('全1500語の例文で対象語を空欄にできる', () => {
  const words = JSON.parse(fs.readFileSync(new URL('../../words.json', import.meta.url), 'utf8'));
  for (const w of words) assert.notEqual(clozeExample(w.word, w.example), w.example, w.word);
});
test('活用形・大文字・複数箇所を隠し、別の単語の一部は隠さない', () => {
  assert.equal(clozeExample('prepare', 'Prepare while she is preparing.'), '______ while she is ______.');
  assert.equal(clozeExample('cancel', 'It was cancelled.'), 'It was ______.');
  assert.equal(clozeExample('leaf', 'The leaves fall.'), 'The ______ fall.');
  assert.equal(clozeExample('check-in', 'Please check in here.'), 'Please ______ here.');
  assert.equal(clozeExample('in', 'Inside the inn, in winter.'), 'Inside the inn, ______ winter.');
});
