import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { GAME_LIBRARY_ENTRIES } from '../../src/game-library-data.js';
import { publishedGames } from '../../src/game-library-core.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('unreviewed research dossiers never enter the public catalog or built site', () => {
  const candidateDir = path.join(root, 'editorial/candidates');
  const drafts = readdirSync(candidateDir).filter(name => name.endsWith('.md') && name !== 'README.md');
  assert.ok(drafts.length >= 3, 'research queue should contain separate auditable candidates');
  for (const name of drafts) {
    const body = readFileSync(path.join(candidateDir, name), 'utf8');
    assert.match(body, /未发布/);
    assert.match(body, /rights-review/);
    assert.match(body, /试玩/);
  }
  assert.deepEqual(GAME_LIBRARY_ENTRIES, [], 'no candidate can be mistaken for an approved catalog entry');
  assert.deepEqual(publishedGames(GAME_LIBRARY_ENTRIES), []);
  assert.equal(existsSync(path.join(root, 'dist/editorial')), false, 'candidate research must not be published in static assets');
});
