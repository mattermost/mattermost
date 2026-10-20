// node --test i18n/scripts/*.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {describe, test} from 'node:test';
import {fileURLToPath} from 'node:url';

import {readGlossary} from './lib/glossary.mjs';
import {checkTranslation} from './lib/rules.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const files = (contents) => ({read: (rel) => (rel in contents ? JSON.stringify(contents[rel]) : null)});
const repoTree = {read: (rel) => (fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), 'utf8') : null)};

const fixtureGlossary = (locale) => readGlossary(files({
    'i18n/glossary/en.json': {
        Mattermost: {definition: 'The product.', partOfSpeech: 'noun', doNotTranslate: true, aliases: ['MM']},
        Boards: {definition: 'A product.', partOfSpeech: 'noun', doNotTranslate: true, commonWord: true},
        channel: {definition: 'A place to talk.', partOfSpeech: 'noun', doNotTranslate: false},
    },
}), locale);

const check = (locale, english, value, surface = 'webapp', glossary = fixtureGlossary(locale)) => checkTranslation({
    item: {english, description: ''},
    value,
    locale,
    surface,
    glossary,
}).map((f) => `${f.severity} ${f.rule}`);

describe('rules', () => {
    test('a translation is a non-empty string, or on the server a map of plural forms', () => {
        assert.deepEqual(check('de', 'Save', 5), ['error type']);
        assert.deepEqual(check('de', 'Save', {one: 'x'}), ['error type']);
        assert.deepEqual(check('de', 'Save', {one: 'x', other: 1}, 'server'), ['error type']);
        assert.deepEqual(check('de', 'Save', ' '), ['error empty']);
        assert.deepEqual(check('de', {one: '{{.Count}} item', other: '{{.Count}} items'}, {one: '{{.Count}} Element', other: ''}, 'server'), ['error empty']);
        assert.deepEqual(check('de', 'Save', 'Speichern'), []);
    });

    test('broken encoding is an error', () => {
        assert.deepEqual(check('de', 'Settings', 'Einstellun\uFFFDen'), ['error encoding']);
        assert.deepEqual(check('de', 'Settings', 'Einstellungen\u0007', 'server'), ['error encoding']);
    });

    test('webapp messages get the ICU rules, with what CI tolerates as a warning an error', () => {
        assert.deepEqual(check('de', 'Hello {name}', 'Hallo'), ['error missing-argument']);
        assert.deepEqual(check('ru', '{count} items', '{count, plural, one {# элемент} other {# элемента}}'), ['error plural-category']);
        assert.deepEqual(check('ja', '{count, plural, one {# item} other {# items}}', '{count, plural, one {# 件} other {# 件}}'), ['error plural-unused-category']);
        assert.deepEqual(check('ja', '{count, plural, one {# item} other {# items}}', '{count, plural, other {# 件}}'), []);
    });

    test('an arrow in a right-to-left locale is soft, since it can be the clearest way to write a sequence', () => {
        assert.deepEqual(check('fa', 'Next →', 'بعدی →'), ['soft rtl-arrow']);
        assert.deepEqual(check('fa', 'Next → {{.Name}}', 'بعدی → {{.Name}}', 'server'), ['soft rtl-arrow']);
    });

    test('an English message that does not parse is reported against en.json', () => {
        assert.deepEqual(check('de', 'Hello {name', 'Hallo {name}'), ['error source']);
    });

    test('server template tokens and actions survive translation', () => {
        assert.deepEqual(check('de', 'Hello {{.Name}}', 'Hallo {{.Nmae}}', 'server'), ['error unknown-token', 'error missing-token']);
        assert.deepEqual(check('de', 'Hello {{.Name}}', 'Hallo {{.Name}', 'server'), ['error template-syntax', 'error missing-token']);
        assert.deepEqual(check('de', '{{if .On}}On{{else}}Off{{end}}', '{{if .On}}An{{end}}', 'server'), ['error template-action']);
        assert.deepEqual(check('de', '{{if .On}}On{{else}}Off{{end}}', '{{if .On}}An{{else}}Aus{{end}}', 'server'), []);
    });

    test('server plural forms follow go-i18n, not CLDR', () => {
        const english = {one: '{{.Count}} item', other: '{{.Count}} items'};
        assert.deepEqual(check('es', english, {one: '{{.Count}} elemento', other: '{{.Count}} elementos'}, 'server'), []);
        assert.deepEqual(check('es', english, {one: '{{.Count}} elemento', many: '{{.Count}} elementos', other: '{{.Count}} elementos'}, 'server'), ['error plural-category']);
        assert.deepEqual(check('xx', english, {one: '{{.Count}} x', other: '{{.Count}} x'}, 'server'), ['error plural-category']);
        assert.deepEqual(check('ru', english, '{{.Count}} элементов', 'server'), ['error plural-demoted']);
    });

    test('leaving out a doNotTranslate name is soft', () => {
        assert.deepEqual(check('de', 'Open Mattermost', 'Öffne die App'), ['soft do-not-translate']);
        assert.deepEqual(check('de', 'Open MM', 'Öffne die App', 'server'), ['soft do-not-translate']);
        assert.deepEqual(check('de', 'Open Mattermost', 'Mattermost öffnen'), []);
        assert.deepEqual(check('de', 'Visit mattermost.com', 'Besuche unsere Website'), []);
        assert.deepEqual(check('de', 'Open the channel', 'Öffne den Kanal'), []);
    });

    test('a doNotTranslate name that is also a common word may be left out', () => {
        assert.deepEqual(check('de', 'Boards are shared', 'Tafeln werden geteilt'), []);

        const real = readGlossary(repoTree, 'de');
        assert.deepEqual(check('de', 'Channels are listed here', 'Kanäle werden hier aufgelistet', 'webapp', real), []);
        assert.deepEqual(check('de', 'Ask Mattermost support', 'Frag den Support', 'webapp', real), ['soft do-not-translate']);
    });
});
