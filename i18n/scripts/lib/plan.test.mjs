// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// How computePlan decides that one key starts from another key's translation:
// a rename, or identical English. Each test plans one webapp locale, de, over
// trees held in memory: en.json at the baseline commit and now, and de.json.
import assert from 'node:assert/strict';
import path from 'node:path';
import {describe, test} from 'node:test';

import {computePlan, RENAME_SIMILARITY} from './plan.mjs';

const WEBAPP = 'webapp/channels/src/i18n';

function memoryTree(files) {
    return {
        read: (rel) => files[rel] ?? null,
        list: (dir) => Object.keys(files).filter((f) => path.dirname(f) === dir).map((f) => path.basename(f)).sort(),
    };
}

const source = (entries) => JSON.stringify(Object.fromEntries(Object.entries(entries).map(([k, v]) => {
    const [defaultMessage, description = `Where ${k} appears`] = [].concat(v);
    return [k, {defaultMessage, description}];
})));

/** de's plan, from en.json at the baseline (then), en.json now, and de.json. */
function planDe({then, now, de}) {
    const common = {
        'server/i18n/en.json': '[]',
        'i18n/baseline.json': JSON.stringify({webapp: {de: 'B'}, server: {}}),
    };
    const head = memoryTree({...common, [`${WEBAPP}/en.json`]: source(now), [`${WEBAPP}/de.json`]: JSON.stringify(de)});
    const atBaseline = memoryTree({...common, [`${WEBAPP}/en.json`]: source(then)});
    return computePlan({tree: head, history: () => atBaseline, base: 'C'}).surfaces.webapp.locales.de;
}

const kinds = (l) => Object.fromEntries(Object.entries(l.items).map(([k, item]) => [k, item.carriedFrom ? `changed from ${item.carriedFrom}` : item.kind]));

describe('renames', () => {
    // Ten words each, so the share in common moves in steps of a tenth.
    const ten = 'one two three four five six seven eight nine ten';

    test(`a removed key and a new one with ${RENAME_SIMILARITY * 100}% of their words in common are a rename`, () => {
        const l = planDe({
            then: {'app.old': ten},
            now: {'app.new': 'one two three four five six seven alpha beta gamma'},
            de: {'app.old': 'eins zwei drei'},
        });
        assert.deepEqual(kinds(l), {'app.new': 'changed from app.old'});
        assert.equal(l.items['app.new'].current, 'eins zwei drei');
        assert.equal(l.items['app.new'].previous.english, ten);
        assert.ok('app.old' in l.prune);
    });

    test('below that, they are a removed key and a new one', () => {
        const l = planDe({
            then: {'app.old': ten},
            now: {'app.new': 'one two three four five six alpha beta gamma delta'},
            de: {'app.old': 'eins zwei drei'},
        });
        assert.deepEqual(kinds(l), {'app.new': 'new'});
        assert.deepEqual(l.carry, {});
    });

    test('a one-word name is not taken for a longer string that contains it', () => {
        const l = planDe({
            then: {'app.json': 'JSON'},
            now: {'app.copy_json': 'Copy JSON'},
            de: {'app.json': 'JSON'},
        });
        assert.deepEqual(kinds(l), {'app.copy_json': 'new'});
    });

    test('a rename with the same English and description carries its translation with no translator', () => {
        const l = planDe({
            then: {'app.old': ['Remove member', 'Button that removes a member']},
            now: {'app.remove_member': ['Remove member', 'Button that removes a member']},
            de: {'app.old': 'Mitglied entfernen'},
        });
        assert.deepEqual(l.carry, {'app.remove_member': 'app.old'});
        assert.deepEqual(l.items, {});
    });

    test('a redescribed rename goes to the translator, since the old translation may have had the wrong sense', () => {
        const l = planDe({
            then: {'app.old': ['Archive', 'Menu item']},
            now: {'app.archive_channel': ['Archive', 'Menu item that archives the channel']},
            de: {'app.old': 'Archiv'},
        });
        assert.deepEqual(l.carry, {});
        assert.deepEqual(kinds(l), {'app.archive_channel': 'changed from app.old'});
    });

    test('a removed key equally close to two new ones is a rename of neither', () => {
        const l = planDe({
            then: {'app.old': 'Delete the channel'},
            now: {'app.now': 'Delete the channel now', 'app.later': 'Delete the channel later'},
            de: {'app.old': 'Kanal löschen'},
        });
        assert.deepEqual(kinds(l), {'app.now': 'new', 'app.later': 'new'});
    });

    test('a pair is a rename only if each is the other\'s closest match', () => {
        // Both removed keys are close enough to the new one, but only
        // app.closer is closest to it from the new key's side. app.closer comes
        // first, so pairing by one side alone would leave app.further, the
        // last match written.
        const l = planDe({
            then: {'app.further': 'Remove a member from this channel now', 'app.closer': 'Remove the member from the channel'},
            now: {'app.new': 'Remove the member from this channel'},
            de: {'app.closer': 'Näher', 'app.further': 'Weiter'},
        });
        assert.deepEqual(kinds(l), {'app.new': 'changed from app.closer'});
        assert.deepEqual(Object.keys(l.prune).sort(), ['app.closer', 'app.further']);
    });

    test('a key en.json already had is not a rename, so a deleted translation goes to a translator', () => {
        const l = planDe({
            then: {'app.kept': ['Remove member', 'Button'], 'app.old': ['Remove member', 'Button']},
            now: {'app.kept': ['Remove member', 'Button']},
            de: {'app.old': 'Mitglied entfernen'},
        });
        assert.deepEqual(l.carry, {});
        assert.deepEqual(kinds(l), {'app.kept': 'new'});
    });

    test('only a removed key this locale translated can be renamed', () => {
        const l = planDe({
            then: {'app.old': 'Remove member'},
            now: {'app.remove_member': 'Remove member'},
            de: {},
        });
        assert.deepEqual(l.carry, {});
        assert.deepEqual(kinds(l), {'app.remove_member': 'new'});
    });
});

describe('identical English', () => {
    const save = {'app.a': 'Save', 'app.b': 'Save', 'app.c': 'Save', 'app.new': 'Save'};

    test('a new key starts from the translation the catalog uses most for the same English', () => {
        const l = planDe({
            then: save,
            now: save,
            de: {'app.a': 'Sichern', 'app.b': 'Speichern', 'app.c': 'Speichern'},
        });
        assert.equal(l.items['app.new'].kind, 'changed');
        assert.equal(l.items['app.new'].sameAs, 'app.b');
        assert.equal(l.items['app.new'].current, 'Speichern');
        assert.equal(l.items['app.new'].previous.description, 'Where app.b appears');
    });

    test('a translation of English that has since changed does not count', () => {
        // app.b and app.c were translated for "Store", so only app.a still
        // translates "Save".
        const l = planDe({
            then: {...save, 'app.b': 'Store', 'app.c': 'Store'},
            now: save,
            de: {'app.a': 'Sichern', 'app.b': 'Speichern', 'app.c': 'Speichern'},
        });
        assert.equal(l.items['app.new'].sameAs, 'app.a');
        assert.equal(l.items['app.new'].current, 'Sichern');
    });

    test('on a tie, the first key in en.json order wins', () => {
        const l = planDe({
            then: save,
            now: save,
            de: {'app.a': 'Sichern', 'app.b': 'Speichern'},
        });
        assert.equal(l.items['app.new'].sameAs, 'app.a');
    });
});
