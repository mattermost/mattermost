import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {dirname, join} from 'node:path';
import {describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';

import {EMPTY_BUILD_MESSAGE, main, scanBuild} from './check-egress.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures', 'egress');
const SCRIPT = join(HERE, 'check-egress.mjs');

function fixture(name) {
  return join(FIXTURES, name);
}

function kinds(hits) {
  return hits.map((h) => h.kind);
}

function found(hits) {
  return hits.map((h) => h.found);
}

function runCli(dir) {
  return spawnSync(process.execPath, [SCRIPT, dir], {encoding: 'utf8'});
}

describe('scanBuild fixtures', () => {
  it('clean/ has 0 violations', () => {
    const hits = scanBuild(fixture('clean'));
    assert.equal(hits.length, 0);
  });

  it('script-cdn/ flags script[src]', () => {
    const hits = scanBuild(fixture('script-cdn'));
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'script[src]');
    assert.equal(hits[0].found, 'https://cdn.example.com/foo.js');
  });

  it('preconnect-fonts/ flags link[rel=preconnect]', () => {
    const hits = scanBuild(fixture('preconnect-fonts'));
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'link[rel=preconnect]');
    assert.equal(hits[0].found, 'https://fonts.googleapis.com');
  });

  it('stylesheet-google/ flags link[rel=stylesheet]', () => {
    const hits = scanBuild(fixture('stylesheet-google'));
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'link[rel=stylesheet]');
  });

  it('algolia-preconnect/ flags SearchBar preconnect', () => {
    const hits = scanBuild(fixture('algolia-preconnect'));
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'link[rel=preconnect]');
    assert.equal(hits[0].found, 'https://ABC-dsn.algolia.net');
  });

  it('remote-img/ flags img[src]', () => {
    const hits = scanBuild(fixture('remote-img'));
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'img[src]');
  });

  it('srcset/ flags only the https candidate', () => {
    const hits = scanBuild(fixture('srcset'));
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'img[srcset]');
    assert.equal(hits[0].found, 'https://cdn.example.com/a.png');
  });

  it('protocol-relative/ flags script[src] as https', () => {
    const hits = scanBuild(fixture('protocol-relative'));
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'script[src]');
    assert.equal(hits[0].found, 'https://cdn.example.com/x.js');
  });

  it('css-import/ flags @import and url()', () => {
    const hits = scanBuild(fixture('css-import'));
    assert.equal(hits.length, 2);
    assert.deepEqual(kinds(hits).sort(), ['css @import', 'css url()']);
    assert.ok(found(hits).includes('https://fonts.googleapis.com/css'));
    assert.ok(found(hits).includes('https://fonts.gstatic.com/s/x.woff2'));
  });

  it('js-fetch-other/ flags fetch()', () => {
    const hits = scanBuild(fixture('js-fetch-other'));
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'fetch()');
    assert.equal(hits[0].found, 'https://evil.example/x');
  });

  it('js-fetch-feed/ allows the security bulletin URL', () => {
    const hits = scanBuild(fixture('js-fetch-feed'));
    assert.equal(hits.length, 0);
  });

  it('anchor-only/ ignores <a href> and <area href>', () => {
    const hits = scanBuild(fixture('anchor-only'));
    assert.equal(hits.length, 0);
  });

  it('json-state/ does not parse application/json as JS', () => {
    const hits = scanBuild(fixture('json-state'));
    assert.equal(hits.length, 0);
  });

  it('xmlns/ ignores SVG xmlns', () => {
    const hits = scanBuild(fixture('xmlns'));
    assert.equal(hits.length, 0);
  });

  it('og-cdn/ flags og:image off docs.mattermost.com', () => {
    const hits = scanBuild(fixture('og-cdn'));
    assert.equal(hits.length, 1);
    assert.equal(hits[0].found, 'https://cdn.example.com/share.png');
  });

  it('empty-dir/ throws', () => {
    assert.throws(() => scanBuild(fixture('empty-dir')), {
      message: EMPTY_BUILD_MESSAGE,
    });
  });
});

describe('CLI', () => {
  it('exits 0 on clean/', () => {
    const result = runCli(fixture('clean'));
    assert.equal(result.status, 0, result.stderr);
  });

  it('exits 1 when violations exist', () => {
    const result = runCli(fixture('script-cdn'));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /script\[src\]/);
  });

  it('exits 1 on an empty tree', () => {
    const result = runCli(fixture('empty-dir'));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing or empty/);
  });

  it('main() returns 1 on violations', () => {
    assert.equal(main([fixture('remote-img')]), 1);
  });

  it('main() returns 0 on clean/', () => {
    assert.equal(main([fixture('clean')]), 0);
  });
});
