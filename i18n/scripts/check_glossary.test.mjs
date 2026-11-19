import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, test} from 'node:test';
import {fileURLToPath} from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check_glossary.mjs');
const json = (body) => JSON.stringify(body, null, 2) + '\n';

describe('check_glossary.mjs', () => {
    let root;
    const write = (rel, text) => {
        fs.mkdirSync(path.dirname(path.join(root, rel)), {recursive: true});
        fs.writeFileSync(path.join(root, rel), text);
    };
    const run = () => spawnSync(process.execPath, [script], {cwd: root, encoding: 'utf8'});

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-glossary-'));
        for (const locale of ['en', 'de', 'ru']) {
            write(`webapp/channels/src/i18n/${locale}.json`, json({}));
        }
        write('server/i18n/en.json', json([]));
        write('server/i18n/ru.json', json([]));
        write('i18n/glossary/en.json', json({
            Mattermost: {definition: 'The product.', partOfSpeech: 'noun', doNotTranslate: true},
            channel: {definition: 'A place to talk.', partOfSpeech: 'noun', doNotTranslate: false},
        }));
        write('i18n/glossary/de.json', json({Mattermost: {target: 'Mattermost'}, channel: {target: 'Kanal'}}));
        write('i18n/glossary/ru.json', json({Mattermost: {target: 'Mattermost'}, channel: {target: 'канал', note: 'Masculine.'}}));
        write('i18n/style.json', json({de: {address: 'informal', use: ['du'], avoid: ['Sie'], matchCase: true}}));
    });
    afterEach(() => fs.rmSync(root, {recursive: true, force: true}));

    test('passes consistent files', () => {
        const r = run();
        assert.equal(r.status, 0, r.stderr);
        assert.match(r.stdout, /glossary: 2 terms, 2 locales; style: 1 locales/);
    });

    test('reports each kind of problem', () => {
        write('i18n/glossary/en.json', json({
            Mattermost: {definition: 'The product.', partOfSpeech: 'noun', doNotTranslate: true},
            Boards: {definition: 'A product.', partOfSpeech: 'thing', doNotTranslate: false, commonWord: true, aliases: ['Mattermost']},
        }));
        write('i18n/glossary/ru.json', json({Mattermost: {target: 'Маттермост'}}));
        write('i18n/glossary/de.json', '{"Boards": {"target": "Boards"}, "Mattermost": {"target": "Mattermost", "extra": 1}}');
        write('i18n/glossary/fr.json', json({}));
        write('i18n/style.json', json({ru: {address: 'polite', use: ['вы'], avoid: ['вы']}}));

        const r = run();
        assert.equal(r.status, 1);
        for (const expected of [
            /partOfSpeech is "thing"/,
            /commonWord is for doNotTranslate terms only/,
            /"Boards": "Mattermost" is also "Mattermost"/,
            /ru\.json: missing "Boards"/,
            /ru\.json: "Mattermost": a doNotTranslate term's target is the term itself/,
            /de\.json: not in canonical form/,
            /de\.json: terms are not in en\.json order/,
            /de\.json: "Mattermost": unknown field "extra"/,
            /fr\.json: no catalog has this locale/,
            /style\.json: ru: address is formal or informal/,
            /style\.json: ru: вы in both use and avoid/,
        ]) {
            assert.match(r.stderr, expected);
        }
    });

    test('requires a glossary file for every locale with a catalog', () => {
        fs.rmSync(path.join(root, 'i18n/glossary/de.json'));

        const r = run();
        assert.equal(r.status, 1);
        assert.match(r.stderr, /i18n\/glossary\/de\.json: missing; every locale with a catalog has one/);
    });
});
