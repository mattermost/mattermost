import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {after, describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';

import {
  EMPTY_BUILD_MESSAGE,
  FEED_URL,
  isAllowedHostedEmbed,
  main,
  scanBuild,
  scanSources,
} from './check-egress.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'check-egress.mjs');

function kinds(hits) {
  return hits.map((h) => h.kind);
}

function found(hits) {
  return hits.map((h) => h.found);
}

function stubHtml(extra = '') {
  return `<!DOCTYPE html><html><body>${extra}</body></html>`;
}

describe('scanSources', () => {
  it('clean sources have 0 violations', () => {
    const hits = scanSources({
      html: {
        'index.html': `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="/_documentation/assets/css/x.css">
  <link rel="canonical" href="https://docs.mattermost.com/_documentation/">
  <meta property="og:image" content="https://docs.mattermost.com/_documentation/img/x.svg">
  <script src="/_documentation/assets/js/x.js"></script>
</head>
<body>
  <a href="https://github.com/mattermost/mattermost/tree/master/docs/main/foo.mdx">edit</a>
  <img src="/_documentation/images/x.png">
</body>
</html>`,
      },
      css: {'main.css': '@font-face { src: url(./fonts/inter.woff2); }'},
      js: {'app.js': `fetch("${FEED_URL}");`},
    });
    assert.equal(hits.length, 0);
  });

  it('flags script[src]', () => {
    const hits = scanSources({
      html: {'index.html': '<script src="https://cdn.example.com/foo.js"></script>'},
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'script[src]');
    assert.equal(hits[0].found, 'https://cdn.example.com/foo.js');
  });

  it('flags link[rel=preconnect]', () => {
    const hits = scanSources({
      html: {
        'index.html':
          '<link rel="preconnect" href="https://fonts.googleapis.com">',
      },
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'link[rel=preconnect]');
    assert.equal(hits[0].found, 'https://fonts.googleapis.com');
  });

  it('flags link[rel=stylesheet]', () => {
    const hits = scanSources({
      html: {
        'index.html':
          '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">',
      },
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'link[rel=stylesheet]');
  });

  it('flags SearchBar preconnect', () => {
    const hits = scanSources({
      html: {
        'index.html':
          '<link rel="preconnect" href="https://ABC-dsn.algolia.net" crossorigin>',
      },
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'link[rel=preconnect]');
    assert.equal(hits[0].found, 'https://ABC-dsn.algolia.net');
  });

  it('flags img[src]', () => {
    const hits = scanSources({
      html: {'index.html': '<img src="https://cdn.example.com/x.png">'},
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'img[src]');
  });

  it('flags only the https srcset candidate', () => {
    const hits = scanSources({
      html: {
        'index.html':
          '<img srcset="https://cdn.example.com/a.png 1x, /_documentation/b.png 2x">',
      },
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'img[srcset]');
    assert.equal(hits[0].found, 'https://cdn.example.com/a.png');
  });

  it('flags protocol-relative script[src] as https', () => {
    const hits = scanSources({
      html: {'index.html': '<script src="//cdn.example.com/x.js"></script>'},
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'script[src]');
    assert.equal(hits[0].found, 'https://cdn.example.com/x.js');
  });

  it('flags css @import and url()', () => {
    const hits = scanSources({
      html: {'index.html': stubHtml()},
      css: {
        'main.css':
          '@import url("https://fonts.googleapis.com/css");\n' +
          'body { background: url("https://fonts.gstatic.com/s/x.woff2"); }',
      },
    });
    assert.equal(hits.length, 2);
    assert.deepEqual(kinds(hits).sort(), ['css @import', 'css url()']);
    assert.ok(found(hits).includes('https://fonts.googleapis.com/css'));
    assert.ok(found(hits).includes('https://fonts.gstatic.com/s/x.woff2'));
  });

  it('flags fetch()', () => {
    const hits = scanSources({
      html: {'index.html': stubHtml()},
      js: {'app.js': 'fetch("https://evil.example/x");'},
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'fetch()');
    assert.equal(hits[0].found, 'https://evil.example/x');
  });

  it('flags fetch() with a template literal', () => {
    const hits = scanSources({
      html: {'index.html': stubHtml()},
      js: {'app.js': 'fetch(`https://evil.example/template`);'},
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'fetch()');
    assert.equal(hits[0].found, 'https://evil.example/template');
  });

  it('flags remote prefix before ${', () => {
    const hits = scanSources({
      html: {'index.html': stubHtml()},
      js: {'app.js': 'fetch(`https://api.example/${path}`);'},
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'fetch()');
    assert.equal(hits[0].found, 'https://api.example/');
  });

  it('ignores data-src and xlink:href false positives', () => {
    const hits = scanSources({
      html: {
        'index.html': `<img data-src="https://cdn.example.com/x.png" src="./local.png">
<svg><use xlink:href="https://cdn.example.com/icons.svg#x"></use></svg>
<link data-rel="stylesheet" href="./local.css">
<script data-type="module" src="./ok.js"></script>`,
      },
    });
    assert.equal(hits.length, 0);
  });

  it('still scans inline script body when only data-src is set', () => {
    const hits = scanSources({
      html: {
        'index.html':
          '<script data-src="https://cdn.example.com/x.js">fetch("https://evil.example/x");</script>',
      },
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'fetch()');
  });

  it('allows the security bulletin URL', () => {
    const hits = scanSources({
      html: {'index.html': stubHtml()},
      js: {'app.js': `fetch("${FEED_URL}");`},
    });
    assert.equal(hits.length, 0);
  });

  it('ignores <a href> and <area href>', () => {
    const hits = scanSources({
      html: {
        'index.html': `<a href="https://forum.mattermost.com">forum</a>
<a href="https://github.com/mattermost/mattermost">github</a>
<a href="https://mattermost.com/pricing">pricing</a>
<area href="https://example.com/map" alt="map">`,
      },
    });
    assert.equal(hits.length, 0);
  });

  it('does not parse application/json as JS', () => {
    const hits = scanSources({
      html: {
        'index.html':
          '<script type="application/json">{"x":"https://cdn.example.com/x.js"}</script>',
      },
    });
    assert.equal(hits.length, 0);
  });

  it('ignores SVG xmlns', () => {
    const hits = scanSources({
      html: {
        'index.html': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      },
    });
    assert.equal(hits.length, 0);
  });

  it('flags og:image off docs.mattermost.com', () => {
    const hits = scanSources({
      html: {
        'index.html':
          '<meta property="og:image" content="https://cdn.example.com/share.png">',
      },
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].found, 'https://cdn.example.com/share.png');
  });

  it('throws when no HTML is present', () => {
    assert.throws(() => scanSources({css: {'a.css': 'body{}'}}), {
      message: EMPTY_BUILD_MESSAGE,
    });
  });

  it('allows YouTube iframes and Wistia scripts/images/preload', () => {
    const hits = scanSources({
      html: {
        'index.html': `<iframe src="https://www.youtube.com/embed/abc"></iframe>
<script src="https://fast.wistia.com/assets/external/E-v1.js"></script>
<script src="https://fast.wistia.com/embed/medias/5gjgi10rr0.jsonp"></script>
<img src="https://fast.wistia.com/embed/medias/x/swatch">
<link rel="preload" href="https://fast.wistia.com/embed/medias/5gjgi10rr0/swatch" as="image">`,
      },
    });
    assert.equal(hits.length, 0);
  });

  it('rejects fetch() to an embed host', () => {
    const hits = scanSources({
      html: {'index.html': stubHtml()},
      js: {'app.js': 'fetch("https://www.youtube.com/embed/abc");'},
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'fetch()');
    assert.equal(hits[0].found, 'https://www.youtube.com/embed/abc');
  });

  it('rejects non-player paths on embed hosts', () => {
    const hits = scanSources({
      html: {
        'index.html':
          '<script src="https://www.youtube.com/yts/jsbin/player.js"></script>',
      },
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'script[src]');
  });

  it('still flags non-embed remote scripts', () => {
    const hits = scanSources({
      html: {
        'index.html':
          '<script src="https://cdn.example.com/foo.js"></script>',
      },
    });
    assert.equal(hits.length, 1);
  });
});

describe('isAllowedHostedEmbed', () => {
  it('allows player kinds/paths only', () => {
    assert.equal(
      isAllowedHostedEmbed('https://www.youtube.com/embed/x', 'iframe[src]'),
      true,
    );
    assert.equal(
      isAllowedHostedEmbed('//fast.wistia.com/embed/medias/x', 'iframe[src]'),
      true,
    );
    assert.equal(
      isAllowedHostedEmbed(
        'https://fast.wistia.com/assets/external/E-v1.js',
        'script[src]',
      ),
      true,
    );
    assert.equal(
      isAllowedHostedEmbed(
        'https://fast.wistia.com/embed/medias/x/swatch',
        'img[src]',
      ),
      true,
    );
    assert.equal(
      isAllowedHostedEmbed(
        'https://fast.wistia.com/embed/medias/x/swatch',
        'link[rel=preload]',
      ),
      true,
    );
    assert.equal(
      isAllowedHostedEmbed('https://www.youtube.com/embed/x', 'fetch()'),
      false,
    );
    assert.equal(
      isAllowedHostedEmbed('https://www.youtube.com/watch?v=x', 'iframe[src]'),
      false,
    );
    assert.equal(
      isAllowedHostedEmbed('https://cdn.example.com/x', 'iframe[src]'),
      false,
    );
  });
});

describe('CLI smoke (temp dir)', () => {
  const root = mkdtempSync(join(tmpdir(), 'check-egress-'));
  const cleanDir = join(root, 'clean');
  const dirtyDir = join(root, 'dirty');
  const emptyDir = join(root, 'empty');

  mkdirSync(cleanDir);
  mkdirSync(dirtyDir);
  mkdirSync(emptyDir);
  writeFileSync(
    join(cleanDir, 'index.html'),
    '<!DOCTYPE html><html><body><img src="/local.png"></body></html>',
  );
  writeFileSync(
    join(dirtyDir, 'index.html'),
    '<script src="https://cdn.example.com/foo.js"></script>',
  );

  after(() => {
    rmSync(root, {recursive: true, force: true});
  });

  function runCli(dir) {
    return spawnSync(process.execPath, [SCRIPT, dir], {encoding: 'utf8'});
  }

  it('scanBuild matches scanSources on a temp tree', () => {
    assert.equal(scanBuild(cleanDir).length, 0);
    assert.equal(scanBuild(dirtyDir).length, 1);
  });

  it('exits 0 on a clean tree', () => {
    const result = runCli(cleanDir);
    assert.equal(result.status, 0, result.stderr);
  });

  it('exits 1 when violations exist', () => {
    const result = runCli(dirtyDir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /script\[src\]/);
  });

  it('exits 1 on an empty tree', () => {
    const result = runCli(emptyDir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing or empty/);
  });

  it('main() returns 1 on violations', () => {
    assert.equal(main([dirtyDir]), 1);
  });

  it('main() returns 0 on clean', () => {
    assert.equal(main([cleanDir]), 0);
  });
});
