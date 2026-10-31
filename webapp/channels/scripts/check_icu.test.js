// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @jest-environment node
 */

// check_icu.mjs is an ESM CLI whose contract is its exit code, so these drive
// the real script in a subprocess rather than importing pieces of it.

const {spawnSync} = require('child_process');
const fs = require('fs');
const {createRequire} = require('module');
const os = require('os');
const path = require('path');

const SCRIPT = path.join(__dirname, 'check_icu.mjs');

/**
 * Write a source catalog and one or more locale catalogs to a temp i18n dir, run
 * the checker over that directory, and return its exit code and output. A
 * catalog may be an object, or a string when the case needs to be malformed.
 *
 * Cases state `en` flat, as `key -> message`, since the message is all any of
 * them is about. Real en.json pairs each key with a {defaultMessage,
 * description}, so wrap it into that shape on the way out.
 */
function check(en, locales, {warnMissingKeys = false, extraFiles = {}} = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-icu-'));

    // Objects are written in canonical form, as the checker requires of every
    // catalog; pass a string to test a file exactly as written.
    const serialize = (body) => (typeof body === 'string' ? body : JSON.stringify(
        Object.fromEntries(Object.keys(body).sort().map((k) => [k, body[k]])), null, 2,
    ) + '\n');
    const serializeSource = (body) => (typeof body === 'string' ? body : JSON.stringify(
        Object.fromEntries(Object.entries(body).map(([key, defaultMessage]) => [key, {defaultMessage, description: ''}])),
    ));

    fs.writeFileSync(path.join(dir, 'en.json'), serializeSource(en));
    for (const [name, body] of Object.entries({...locales, ...extraFiles})) {
        fs.writeFileSync(path.join(dir, name), serialize(body));
    }

    const args = [SCRIPT, dir, ...(warnMissingKeys ? ['--warn-missing-keys'] : [])];
    const result = spawnSync(process.execPath, args, {encoding: 'utf8'});

    return {code: result.status, stdout: result.stdout, stderr: result.stderr};
}

describe('check_icu', () => {
    describe('parser', () => {
        // The script's whole premise is that parsing here implies parsing under
        // react-intl, which only holds while the two agree on a version. Three
        // copies of this package exist in the tree, so a bare import picks up
        // whichever npm hoisted: for a long time, the older one
        // babel-plugin-formatjs pulls. The script sidesteps that by resolving
        // the parser from react-intl's own node_modules, which works only while
        // react-intl keeps depending on the parser directly.
        test('is the copy react-intl loads', () => {
            const wantedByReactIntl = require('react-intl/package.json').dependencies['@formatjs/icu-messageformat-parser'];
            expect(wantedByReactIntl).toBeDefined();

            const fromReactIntl = createRequire(require.resolve('react-intl'));
            const resolved = fromReactIntl('@formatjs/icu-messageformat-parser/package.json').version;

            expect(resolved).toBe(wantedByReactIntl);
        });
    });

    describe('right-to-left', () => {
        test('warns about a horizontal arrow in a right-to-left locale', () => {
            const {code, stderr} = check({'a.b': 'Next →'}, {'fa.json': {'a.b': 'بعدی →'}});

            expect(code).toBe(0);
            expect(stderr).toContain('fa.json:a.b: horizontal arrow in a right-to-left locale');
        });

        test('ignores vertical arrows, and left-to-right locales', () => {
            const {stderr} = check(
                {'a.b': 'Use ↑↓ to browse', 'a.c': 'Next →'},
                {'fa.json': {'a.b': 'از ↑↓ استفاده کنید', 'a.c': 'بعدی'}, 'fr.json': {'a.b': 'Utilisez ↑↓', 'a.c': 'Suivant →'}},
            );

            expect(stderr).not.toContain('horizontal arrow');
        });
    });

    describe('well-formedness', () => {
        test.each([
            ['keys out of order', '{\n  "a.c": "Deux",\n  "a.b": "Un"\n}\n'],
            ['a four-space indent', '{\n    "a.b": "Un",\n    "a.c": "Deux"\n}\n'],
            ['no trailing newline', '{\n  "a.b": "Un",\n  "a.c": "Deux"\n}'],
        ])('rejects a catalog with %s', (_, text) => {
            const {code, stderr} = check({'a.b': 'One', 'a.c': 'Two'}, {'fr.json': text});

            expect(code).toBe(1);
            expect(stderr).toContain('fr.json: not in canonical form');
        });

        // U+E000 is a single UTF-16 code unit, U+10000 a surrogate pair starting
        // at 0xD800, so code-unit order would put them the other way around.
        test('orders keys by code point, not UTF-16 code unit', () => {
            const ordered = (first, second) => `{\n  "a.b": "Un",\n  "${first}": "x",\n  "${second}": "y"\n}\n`;

            expect(check({'a.b': 'One'}, {'fr.json': ordered('\uE000', '\u{10000}')}).stderr).not.toContain('canonical form');
            expect(check({'a.b': 'One'}, {'fr.json': ordered('\u{10000}', '\uE000')}).stderr).toContain('fr.json: not in canonical form from line 3');
        });

        test('names the first line out of form, past characters outside the BMP', () => {
            const {stderr} = check({'a.b': 'Hi 😀', 'a.c': 'Bye'}, {'fr.json': '{\n  "a.b": "Salut 😀",\n   "a.c": "Ciao"\n}\n'});

            expect(stderr).toContain('fr.json: not in canonical form from line 3');
        });

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
            ['null', 'null\n'],
            ['a number', '5\n'],
            ['a string', '"Bonjour"\n'],
            ['an array', '[]\n'],
        ])('reports a catalog that is %s, and checks the rest', (_label, text) => {
            const {code, stderr} = check({'a.b': 'Hello {name}'}, {'de.json': text, 'fr.json': {'a.b': 'Bonjour'}});

            expect(code).toBe(1);
            expect(stderr).toContain('de.json: not a JSON object of key -> message');
            expect(stderr).toContain('fr.json:a.b:');
        });

        // Root reads a file whatever its mode.
        (process.getuid?.() === 0 ? test.skip : test)('reports a catalog it cannot read, and checks the rest', () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-icu-'));
            fs.writeFileSync(path.join(dir, 'en.json'), JSON.stringify({'a.b': {defaultMessage: 'Hello {name}'}}));
            fs.writeFileSync(path.join(dir, 'de.json'), '{\n  "a.b": "Hallo {name}"\n}\n');
            fs.chmodSync(path.join(dir, 'de.json'), 0);
            fs.writeFileSync(path.join(dir, 'fr.json'), '{\n  "a.b": "Bonjour"\n}\n');

            const result = spawnSync(process.execPath, [SCRIPT, dir], {encoding: 'utf8'});

            expect(result.status).toBe(1);
            expect(result.stderr).toContain('de.json: cannot read: EACCES');
            expect(result.stderr).toContain('fr.json:a.b:');
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

        // A description is prose written for a translator, so it may say
        // anything, including things ICU would choke on. Only the
        // defaultMessage is a message.
        test('never parses the description', () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-icu-'));
            fs.writeFileSync(path.join(dir, 'en.json'), JSON.stringify({
                'a.b': {defaultMessage: 'Hello', description: "Rendered before the {unclosed brace and an ' apostrophe"},
            }));
            fs.writeFileSync(path.join(dir, 'fr.json'), JSON.stringify({'a.b': 'Bonjour'}, null, 2) + '\n');

            const result = spawnSync(process.execPath, [SCRIPT, dir], {encoding: 'utf8'});

            expect(result.status).toBe(0);
            expect(result.stderr).toBe('');
        });
    });

    describe('key parity', () => {
        test('an extra key is only a warning, since nothing will read it', () => {
            const {code, stderr} = check(
                {'a.b': 'Hello'},
                {'fr.json': {'a.b': 'Bonjour', 'z.z': 'Orphelin'}},
            );

            expect(code).toBe(0);
            expect(stderr).toContain('fr.json:z.z: extra key not in en.json');
            expect(stderr).toContain('1 warning(s)');
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

        // react-intl treats '' as falsy and falls back to the English, so an
        // empty translation reaches the user exactly as a missing key does.
        test('an empty translation is an error by default', () => {
            const {code, stderr} = check({'a.b': 'Hello'}, {'fr.json': {'a.b': ''}});

            expect(code).toBe(1);
            expect(stderr).toContain('fr.json:a.b: empty translation');
        });

        test('an empty translation is still an error under --warn-missing-keys', () => {
            const {code, stderr} = check({'a.b': 'Hello'}, {'fr.json': {'a.b': ''}}, {warnMissingKeys: true});

            expect(code).toBe(1);
            expect(stderr).toContain('fr.json:a.b: empty translation');
        });

        test('a whitespace-only translation is an error by default', () => {
            const {code, stderr} = check({'a.b': 'Hello'}, {'fr.json': {'a.b': ' '}});

            expect(code).toBe(1);
            expect(stderr).toContain('fr.json:a.b: empty translation');
        });

        test('errors after thousands of warnings still reach a pipe', () => {
            const en = Object.fromEntries(Array.from({length: 5000}, (_, i) => [`missing.key${i}`, 'Hello']));
            const {code, stderr} = check({...en, 'a.b': 'Hello'}, {'fr.json': {'a.b': ''}}, {warnMissingKeys: true});

            expect(code).toBe(1);
            expect(stderr).toContain('5000 warning(s)');
            expect(stderr).toContain('fr.json:a.b: empty translation');
            expect(stderr).toContain('1 error(s) across 1 locale file(s)');
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

        test('accepts the plural forms the locale needs rather than the ones the source has', () => {
            const {code, stderr} = check(
                {'a.b': '{count, plural, one {# item} other {# items}}'},
                {'ru.json': {'a.b': '{count, plural, one {# элемент} few {# элемента} many {# элементов} other {# элемента}}'}},
            );

            expect(code).toBe(0);
            expect(stderr).toBe('');
        });

        test('does not treat # as a variable', () => {
            const {code} = check(
                {'a.b': '{count, plural, one {# item} other {# items}}'},
                {'fr.json': {'a.b': '{count, plural, one {# article} other {# articles}}'}},
            );

            expect(code).toBe(0);
        });
    });

    describe('plural forms', () => {
        const items = '{count, plural, one {# item} other {# items}}';

        // ICU falls back to "other" for a missing form: it renders, in the wrong
        // grammatical case. A warning, because the catalogs ship hundreds today.
        test('warns about a form the locale needs for a count it shows', () => {
            const {code, stderr} = check({'a.b': items}, {'ru.json': {'a.b': '{count, plural, one {# элемент} other {# элемента}}'}});

            expect(code).toBe(0);
            expect(stderr).toContain('ru.json:a.b: plural "count" has no few/many form, so counts such as 2, 5 render with "other"');
        });

        test('counts a variable rendered outside the plural as shown', () => {
            const {stderr} = check(
                {'a.b': '{count, number} {count, plural, one {channel} other {channels}}'},
                {'ru.json': {'a.b': '{count, number} {count, plural, one {канал} other {каналы}}'}},
            );

            expect(stderr).toContain('plural "count" has no few/many form');
        });

        test('holds a promoted plural to the locale too', () => {
            const {stderr} = check({'a.b': '{count} items'}, {'ru.json': {'a.b': '{count, plural, one {# элемент} other {# элемента}}'}});

            expect(stderr).toContain('plural "count" has no few/many form');
        });

        test('takes an explicit =N arm as covering that count', () => {
            const {stderr} = check(
                {'a.b': '{count, plural, =1 {one item} other {# items}}'},
                {'de.json': {'a.b': '{count, plural, =1 {ein Element} other {# Elemente}}'}},
            );

            expect(stderr).toBe('');
        });

        test('ignores a form only fractions or very large numbers select', () => {
            const {stderr} = check({'a.b': items}, {'fr.json': {'a.b': '{count, plural, one {# élément} other {# éléments}}'}});

            expect(stderr).toBe('');
        });

        test('ignores a plural whose count is not shown', () => {
            const {stderr} = check(
                {'a.b': '{count, plural, one {Delete file?} other {Delete files?}}'},
                {'ru.json': {'a.b': '{count, plural, one {Удалить файл?} other {Удалить файлы?}}'}},
            );

            expect(stderr).toBe('');
        });

        test('does not hold a translation to more than an incomplete source', () => {
            const {stderr} = check(
                {'a.b': '{count, plural, =0 {} other {{count} Scheduled}}'},
                {'ru.json': {'a.b': '{count, plural, =0 {} other {{count} запланировано}}'}},
            );

            expect(stderr).toBe('');
        });

        test('does not report a form the locale never selects', () => {
            const {stderr} = check({'a.b': items}, {'ja.json': {'a.b': '{count, plural, one {# 件} other {# 件}}'}});

            expect(stderr).toBe('');
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
            ['more than one directory', ['a', 'b']],
        ])('exits 2 on %s', (_label, args) => {
            const result = spawnSync(process.execPath, [SCRIPT, ...args], {encoding: 'utf8'});

            expect(result.status).toBe(2);
            expect(result.stderr).toContain('usage:');
        });

        test('exits 2 on a directory that does not exist', () => {
            const missing = path.join(os.tmpdir(), 'check-icu-does-not-exist');
            const result = spawnSync(process.execPath, [SCRIPT, missing], {encoding: 'utf8'});

            expect(result.status).toBe(2);
            expect(result.stderr).toContain('cannot read the i18n directory');
        });

        test('exits 2 when en.json is missing or malformed', () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-icu-'));
            fs.writeFileSync(path.join(dir, 'fr.json'), '{}');

            const missing = spawnSync(process.execPath, [SCRIPT, dir], {encoding: 'utf8'});
            expect(missing.status).toBe(2);
            expect(missing.stderr).toContain('cannot read');

            fs.writeFileSync(path.join(dir, 'en.json'), '{not json');
            const malformed = spawnSync(process.execPath, [SCRIPT, dir], {encoding: 'utf8'});
            expect(malformed.status).toBe(2);
            expect(malformed.stderr).toContain('cannot read');

            fs.writeFileSync(path.join(dir, 'en.json'), '[]');
            const notObject = spawnSync(process.execPath, [SCRIPT, dir], {encoding: 'utf8'});
            expect(notObject.status).toBe(2);
            expect(notObject.stderr).toContain('not a JSON object');
        });

        test('exits 2 when the directory holds no locale catalogs', () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-icu-'));
            fs.writeFileSync(path.join(dir, 'en.json'), '{}');

            const result = spawnSync(process.execPath, [SCRIPT, dir], {encoding: 'utf8'});

            expect(result.status).toBe(2);
            expect(result.stderr).toContain('no locale catalogs');
        });

        // src/i18n holds i18n.ts and a CLAUDE.OPTIONAL.md beside the catalogs.
        test('walks only the sibling json catalogs, and never en.json', () => {
            const {code, stdout} = check(
                {'a.b': 'Hello'},
                {'fr.json': {'a.b': 'Bonjour'}},
                {extraFiles: {'i18n.ts': 'export default 1;', 'notes.md': 'hi'}},
            );

            expect(code).toBe(0);
            expect(stdout).toContain('OK: 1 locale files checked');
        });

        test('reports a catalog not named for a locale, and checks the rest', () => {
            const {code, stderr} = check(
                {'a.b': 'Hello {name}'},
                {
                    'en_US.json': {'a.b': 'Hello {name}'},
                    'fr.json': {'a.b': 'Bonjour'},
                },
            );

            expect(code).toBe(1);
            expect(stderr).toContain('en_US.json: "en_US" is not a locale tag');
            expect(stderr).toContain('fr.json:a.b:');
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
