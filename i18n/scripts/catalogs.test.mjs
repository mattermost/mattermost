import assert from 'node:assert/strict';
import path from 'node:path';
import {describe, test} from 'node:test';
import {fileURLToPath} from 'node:url';

import {catalogPath, localesOf, parseCatalog, serializeCatalog, SURFACES} from './lib/catalogs.mjs';
import {workingTree} from './lib/repo.mjs';

const tree = workingTree(path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));

describe('catalogs', () => {
    test('a catalog written back unchanged is byte for byte what its checker requires', () => {
        for (const surface of Object.keys(SURFACES)) {
            const locales = localesOf(tree, surface);
            assert.ok(locales.length > 20);
            for (const locale of locales) {
                const text = tree.read(catalogPath(surface, locale));
                const {map, order} = parseCatalog(text, surface);
                assert.equal(serializeCatalog(map, order, surface), text, catalogPath(surface, locale));
            }
        }
    });

    test('webapp keys go in code-point order, past U+FFFF too', () => {
        const map = new Map([['b\u{1F600}', '2'], ['a', '1'], ['b\uFF01', '3']]);
        assert.deepEqual(Object.keys(JSON.parse(serializeCatalog(map, [], 'webapp'))), ['a', 'b\uFF01', 'b\u{1F600}']);
    });

    test('server ids keep their place, and new ones are appended in order', () => {
        const map = new Map([['z', 'Z'], ['b', 'B'], ['a', 'A']]);
        const text = serializeCatalog(map, ['z', 'gone', 'b'], 'server');
        assert.deepEqual(JSON.parse(text).map((e) => e.id), ['z', 'b', 'a']);
    });
});
