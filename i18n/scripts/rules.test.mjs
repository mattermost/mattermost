// node --test i18n/scripts/*.test.mjs
import assert from 'node:assert/strict';
import {describe, test} from 'node:test';

import {checkTranslation} from './lib/rules.mjs';

const check = (locale, english, value, surface = 'webapp') => checkTranslation({
    item: {english, description: ''},
    value,
    locale,
    surface,
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
});
