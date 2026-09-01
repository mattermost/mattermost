// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @jest-environment node
 */

// check_icu.mjs is an ESM CLI whose contract is its exit code, so these drive
// the real script in a subprocess rather than importing pieces of it.

const {spawnSync} = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.join(__dirname, 'check_icu.mjs');

/**
 * Write a source catalog and one or more locale catalogs to a temp dir, run the
 * checker over them, and return its exit code and output. A catalog may be an
 * object, or a string when the case needs to be malformed.
 */
function check(en, locales, {warnMissingKeys = false} = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-icu-'));
    const serialize = (body) => (typeof body === 'string' ? body : JSON.stringify(body));

    const enPath = path.join(dir, 'en.json');
    fs.writeFileSync(enPath, serialize(en));

    const localePaths = Object.entries(locales).map(([name, body]) => {
        const p = path.join(dir, name);
        fs.writeFileSync(p, serialize(body));
        return p;
    });

    const args = [SCRIPT, enPath, ...(warnMissingKeys ? ['--warn-missing-keys'] : []), ...localePaths];
    const result = spawnSync(process.execPath, args, {encoding: 'utf8'});

    return {code: result.status, stdout: result.stdout, stderr: result.stderr};
}

describe('check_icu', () => {
    describe('parser', () => {
        // The script's whole premise is that parsing here implies parsing under
        // react-intl, which only holds while the two agree on a version. Three
        // copies of this package exist in the tree, so without the pin in
        // channels' devDependencies a bare import picks up whichever npm
        // hoisted -- for a long time, the older one babel-plugin-formatjs pulls.
        test('is the version react-intl resolves', () => {
            const resolved = require('@formatjs/icu-messageformat-parser/package.json').version;
            const wantedByReactIntl = require('react-intl/package.json').dependencies['@formatjs/icu-messageformat-parser'];

            expect(resolved).toBe(wantedByReactIntl);
        });
    });

    describe('well-formedness', () => {
        test('accepts a clean catalog', () => {
            const {code, stdout} = check(
                {'a.b': 'Hello {name}'},
                {'fr.json': {'a.b': 'Bonjour {name}'}},
            );

            expect(code).toBe(0);
            expect(stdout).toContain('OK:');
        });

        test('rejects invalid JSON', () => {
            const {code, stderr} = check({'a.b': 'Hello'}, {'fr.json': '{"a.b":'});

            expect(code).toBe(1);
            expect(stderr).toContain('invalid JSON');
        });

        test.each([
            ['null', null],
            ['a number', 5],
            ['an object', {nested: 'x'}],
        ])('rejects a value that is %s', (_label, value) => {
            const {code, stderr} = check({'a.b': 'Hello'}, {'fr.json': {'a.b': value}});

            expect(code).toBe(1);
            expect(stderr).toContain('value is not a string');
        });

        test('rejects a translation that does not parse', () => {
            const {code, stderr} = check(
                {'a.b': 'Hello {name}'},
                {'fr.json': {'a.b': 'Bonjour {name'}},
            );

            expect(code).toBe(1);
            expect(stderr).toContain('does not parse');
        });

        test('reports an unparseable source once, and skips its key', () => {
            const {code, stderr} = check(
                {'a.b': 'Hello {name'},
                {'fr.json': {'a.b': 'Bonjour {name}'}},
            );

            expect(code).toBe(1);
            expect(stderr).toContain('en.json:a.b: source does not parse');
            expect(stderr).not.toContain('fr.json:a.b:');
        });
    });

    describe('key parity', () => {
        test('an extra key is always an error, since nothing will read it', () => {
            const {code, stderr} = check(
                {'a.b': 'Hello'},
                {'fr.json': {'a.b': 'Bonjour', 'z.z': 'Orphelin'}},
            );

            expect(code).toBe(1);
            expect(stderr).toContain('fr.json:z.z: extra key not in en.json');
        });

        test('a missing key is an error by default', () => {
            const {code, stderr} = check({'a.b': 'Hello'}, {'fr.json': {}});

            expect(code).toBe(1);
            expect(stderr).toContain('fr.json:a.b: missing key');
        });

        test('a missing key is a warning under --warn-missing-keys', () => {
            const {code, stderr} = check({'a.b': 'Hello'}, {'fr.json': {}}, {warnMissingKeys: true});

            expect(code).toBe(0);
            expect(stderr).toContain('fr.json:a.b: missing key');
            expect(stderr).toContain('1 warning(s)');
        });
    });

    describe('variables and tags', () => {
        test('rejects a variable the source does not have', () => {
            const {code, stderr} = check(
                {'a.b': 'Hello {name}'},
                {'fr.json': {'a.b': 'Bonjour {name}, {extra}'}},
            );

            expect(code).toBe(1);
            expect(stderr).toContain('unknown variable/tag "extra" not present in source');
        });

        test('rejects a tag the source does not have', () => {
            const {code, stderr} = check(
                {'a.b': 'Read <link>this</link>'},
                {'fr.json': {'a.b': 'Lisez <link>ceci</link> et <b>cela</b>'}},
            );

            expect(code).toBe(1);
            expect(stderr).toContain('unknown variable/tag "b" not present in source');
        });

        test.each([
            ['variable', 'Hello {name}', 'Bonjour', 'name'],
            ['tag', 'Read <link>this</link>', 'Lisez ceci', 'link'],
        ])('rejects dropping a source %s', (_label, en, fr, dropped) => {
            const {code, stderr} = check({'a.b': en}, {'fr.json': {'a.b': fr}});

            expect(code).toBe(1);
            expect(stderr).toContain(`source variable/tag "${dropped}" is missing from the translation`);
        });

        test('accepts a name used as both a tag and a variable', () => {
            const {code} = check(
                {'a.b': '<b>{b}</b>'},
                {'fr.json': {'a.b': '<b>{b}</b>'}},
            );

            expect(code).toBe(0);
        });

        test('finds variables nested inside plural branches', () => {
            const {code, stderr} = check(
                {'a.b': '{count, plural, one {{name} item} other {{name} items}}'},
                {'fr.json': {'a.b': '{count, plural, one {un article} other {des articles}}'}},
            );

            expect(code).toBe(1);
            expect(stderr).toContain('source variable/tag "name" is missing from the translation');
        });
    });

    describe('argument roles', () => {
        // Demotion is the defect the role comparison exists for: it still
        // parses and still renders, it just silently stops pluralizing.
        test.each([
            ['plural', '{count, plural, one {# item} other {# items}}', '{count} articles'],
            ['number', 'You have {count, number} points', 'Vous avez {count} points'],
        ])('rejects demoting %s to a bare argument', (role, en, fr) => {
            const {code, stderr} = check({'a.b': en}, {'fr.json': {'a.b': fr}});

            expect(code).toBe(1);
            expect(stderr).toContain(`the source only uses it as ${role}`);
        });

        // English needs a plural far less often than the languages it is
        // translated into, so widening a bare argument is correct translation,
        // not a defect.
        test.each([
            ['a bare argument', '{count} items were deleted'],
            ['a number', '{count, number} items were deleted'],
        ])('accepts promoting %s to a plural', (_label, en) => {
            const {code} = check(
                {'a.b': en},
                {'ru.json': {'a.b': '{count, plural, one {# элемент} few {# элемента} many {# элементов} other {# элемента}}'}},
            );

            expect(code).toBe(0);
        });

        test('accepts promoting a bare argument to a select', () => {
            const {code} = check(
                {'a.b': 'Status: {status}'},
                {'fr.json': {'a.b': 'Statut : {status, select, active {actif} other {autre}}'}},
            );

            expect(code).toBe(0);
        });

        // Formatting types are not reachable from a bare argument: applying them
        // to a value that is not a number or a date renders NaN or Invalid Date.
        test.each([
            ['number', '{count, number}'],
            ['date', '{count, date}'],
        ])('rejects promoting a bare argument to %s', (role, fr) => {
            const {code, stderr} = check({'a.b': '{count} items'}, {'fr.json': {'a.b': `${fr} articles`}});

            expect(code).toBe(1);
            expect(stderr).toContain(`"count" is used as ${role}`);
        });

        test('does not compare plural categories, which belong to the locale', () => {
            const {code} = check(
                {'a.b': '{count, plural, one {# item} other {# items}}'},
                {'ru.json': {'a.b': '{count, plural, one {# элемент} few {# элемента} many {# элементов} other {# элемента}}'}},
            );

            expect(code).toBe(0);
        });

        test('does not treat # as a variable', () => {
            const {code} = check(
                {'a.b': '{count, plural, one {# item} other {# items}}'},
                {'fr.json': {'a.b': '{count, plural, one {# article} other {# articles}}'}},
            );

            expect(code).toBe(0);
        });
    });

    describe('apostrophes', () => {
        // A lone apostrophe before ICU syntax opens a quoted literal that
        // swallows the rest of the message. It still parses, so nothing else
        // catches it.
        test.each([
            ['a tag', 'Read <link>this</link>', "Lisez l'<link>article</link>"],
            ['a variable', 'Today is {day}', "Aujourd'hui c'est l'{day}"],
        ])('rejects an unescaped apostrophe before %s', (_label, en, fr) => {
            const {code, stderr} = check({'a.b': en}, {'fr.json': {'a.b': fr}});

            expect(code).toBe(1);
            expect(stderr).toContain('opens a quoted literal');
        });

        test('accepts a doubled apostrophe, the documented elision escape', () => {
            const {code} = check(
                {'a.b': 'Read <link>this</link>'},
                {'fr.json': {'a.b': "Lisez l''<link>article</link>"}},
            );

            expect(code).toBe(0);
        });

        test('accepts a typographic apostrophe', () => {
            const {code} = check(
                {'a.b': 'Read <link>this</link>'},
                {'fr.json': {'a.b': 'Lisez l’<link>article</link>'}},
            );

            expect(code).toBe(0);
        });

        test('does not flag quoting the source itself uses', () => {
            const {code} = check(
                {'a.b': "Use '{braces}' literally"},
                {'fr.json': {'a.b': "Utilisez '{braces}' littéralement"}},
            );

            expect(code).toBe(0);
        });
    });

    describe('cli', () => {
        test.each([
            ['no arguments', []],
            ['only a source catalog', ['en.json']],
        ])('exits 2 on %s', (_label, args) => {
            const result = spawnSync(process.execPath, [SCRIPT, ...args], {encoding: 'utf8'});

            expect(result.status).toBe(2);
            expect(result.stderr).toContain('usage:');
        });

        test('reports every locale file, not just the first that fails', () => {
            const {code, stderr} = check(
                {'a.b': 'Hello {name}'},
                {
                    'fr.json': {'a.b': 'Bonjour'},
                    'de.json': {'a.b': 'Hallo'},
                },
            );

            expect(code).toBe(1);
            expect(stderr).toContain('fr.json:a.b:');
            expect(stderr).toContain('de.json:a.b:');
            expect(stderr).toContain('2 error(s) across 2 locale file(s)');
        });
    });
});
