// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Each test drives the scripts as a translation run would, in a throwaway git
// repository holding only the files they read.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {after, before, describe, test} from 'node:test';

import {json, makeRepo, ruPayload, seed} from './lib/fixture.mjs';
import {readSlices} from './lib/slices.mjs';

describe('a translation run', () => {
    let repo;
    let base;
    let workdir;
    const worklist = (locale, dir = workdir) => {
        const {header, items} = readSlices(path.join(dir, 'worklists', locale));
        return {...header, ...items};
    };
    const payload = (locale, body, name = 'all') => {
        const file = path.join(workdir, 'translations', locale, `${name}.json`);
        fs.mkdirSync(path.dirname(file), {recursive: true});
        fs.writeFileSync(file, JSON.stringify(body));
        return file;
    };
    const unpayload = (locale, name) => fs.rmSync(path.join(workdir, 'translations', locale, `${name}.json`));

    before(() => {
        repo = makeRepo();
        base = seed(repo).C;
        workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-run-'));
    });
    after(() => {
        fs.rmSync(repo.root, {recursive: true, force: true});
        fs.rmSync(workdir, {recursive: true, force: true});
    });

    test('plan stops on a worklist key with no description', () => {
        const original = repo.read('webapp/channels/src/i18n/en.json');
        const en = JSON.parse(original);
        en['app.undescribed'] = {defaultMessage: 'Undo', description: ''};
        repo.write('webapp/channels/src/i18n/en.json', json(en));
        const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-run-'));
        try {
            const r = repo.run('plan_translations.mjs', scratch, '--base', base);
            assert.equal(r.status, 1);
            assert.match(r.stderr, /1 worklist key\(s\) have no description:\n {2}webapp:app\.undescribed\n/);
            assert.match(r.stderr, /find_empty_descriptions\.mjs /);
            assert.equal(fs.existsSync(path.join(scratch, 'worklists')), false);
            assert.equal(fs.existsSync(path.join(scratch, 'plan.json')), false);
        } finally {
            repo.write('webapp/channels/src/i18n/en.json', original);
            fs.rmSync(scratch, {recursive: true, force: true});
        }
    });

    test('plan refuses a baseline the base does not descend from', () => {
        const original = repo.read('i18n/baseline.json');
        const elsewhere = repo.git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit-tree', 'HEAD^{tree}', '-m', 'elsewhere');
        repo.write('i18n/baseline.json', original.replace(/"de": "[0-9a-f]+"/, `"de": "${elsewhere}"`));
        const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-run-'));
        try {
            const r = repo.run('plan_translations.mjs', scratch, '--base', base);
            assert.equal(r.status, 2);
            assert.match(r.stderr, new RegExp(`server/de is at ${elsewhere}, which ${base} does not descend from`));
        } finally {
            repo.write('i18n/baseline.json', original);
            fs.rmSync(scratch, {recursive: true, force: true});
        }
    });

    test('plan finds new, changed, renamed, removed and repairable keys', () => {
        const r = repo.run('plan_translations.mjs', workdir, '--base', base);
        assert.equal(r.status, 0, r.stderr);
        const plan = JSON.parse(fs.readFileSync(path.join(workdir, 'plan.json'), 'utf8'));
        const ru = plan.surfaces.webapp.locales.ru;

        assert.deepEqual(ru.carry, {'app.remove_member': 'app.old'});
        assert.deepEqual(Object.keys(ru.prune).sort(), ['app.archive', 'app.gone', 'app.old']);
        const kinds = Object.fromEntries(Object.entries(ru.items).map(([k, item]) => [k, item.kind]));
        assert.deepEqual(kinds, {
            'app.archive_channel': 'changed',
            'app.count': 'repair',
            'app.hello': 'repair',
            'app.new': 'new',
            'app.reword': 'changed',
        });
        assert.equal(ru.items['app.archive_channel'].carriedFrom, 'app.archive');
        assert.equal(ru.items['app.archive_channel'].current, 'Архив');
        assert.equal(ru.items['app.reword'].previous.english, 'Delete the post');
        assert.equal(ru.items['app.reword'].current, 'Удалить сообщение');
        assert.match(ru.items['app.hello'].problems[0], /"тебя"|"тебе"|"ты"|у тебя/i);
        assert.deepEqual(Object.keys(plan.surfaces.server.locales.ru.items), ['api.retry']);
        assert.deepEqual(Object.keys(worklist('ru').webapp), Object.keys(ru.items));

        // With no answers yet, everything is still to do, in slices for the
        // first round of translators.
        const todo = JSON.parse(fs.readFileSync(path.join(workdir, 'remaining', 'ru', '01.json'), 'utf8'));
        assert.equal(todo.answers, 'translations/ru/r1-01.json');
        assert.deepEqual(Object.keys(todo.webapp), Object.keys(ru.items));
        assert.equal(worklist('ru').answers, undefined);

        // de addresses the user informally, and its plurals need only one/other.
        assert.equal(plan.surfaces.webapp.locales.de.items['app.hello'], undefined);
        assert.equal(plan.surfaces.webapp.locales.de.items['app.count'], undefined);
    });

    test('a worklist carries what its translator needs to match the catalog', () => {
        const w = worklist('ru');
        assert.equal(w.language.direction, 'ltr');
        assert.equal(w.language.script, 'Cyrl');
        assert.equal(w.language.address.form, 'formal');
        assert.deepEqual(w.language.pluralForms.webapp.required, ['one', 'few', 'many', 'other']);
        assert.deepEqual(w.language.pluralForms.server, ['few', 'many', 'one', 'other']);

        assert.deepEqual(Object.keys(w.webapp['app.new'].siblings), ['app.plain', 'app.title']);
        assert.deepEqual(w.webapp['app.new'].siblings['app.title'], {english: 'Channel settings', translation: 'Настройки канала'});

        const original = repo.read('webapp/channels/src/i18n/en.json');
        const en = JSON.parse(original);
        en['app.copy'] = {defaultMessage: 'Channel settings', description: 'Title of a copied modal'};
        en['app.brand'] = {defaultMessage: 'Open Mattermost', description: 'Menu item'};
        repo.write('webapp/channels/src/i18n/en.json', json(en));
        const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-run-'));
        try {
            assert.equal(repo.run('plan_translations.mjs', scratch, '--base', base).status, 0);
            const items = worklist('ru', scratch).webapp;
            assert.equal(items['app.copy'].kind, 'changed');
            assert.equal(items['app.copy'].sameAs, 'app.title');
            assert.equal(items['app.copy'].current, 'Настройки канала');
            assert.equal(items['app.copy'].previous.description, 'Title of the channel settings modal');
            assert.deepEqual(items['app.brand'].terms, [{term: 'Mattermost', definition: 'The product.', target: 'Mattermost', doNotTranslate: true}]);
        } finally {
            repo.write('webapp/channels/src/i18n/en.json', original);
            fs.rmSync(scratch, {recursive: true, force: true});
        }
    });

    test('find_new_strings lists, once, every string some locale will translate', () => {
        const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-run-'));
        try {
            const r = repo.run('find_new_strings.mjs', scratch);
            assert.equal(r.status, 0, r.stderr);
            const strings = JSON.parse(fs.readFileSync(path.join(scratch, 'strings.json'), 'utf8'));
            assert.deepEqual(Object.keys(strings.webapp), ['app.reword', 'app.archive_channel', 'app.new']);
            assert.deepEqual(strings.webapp['app.new'], {english: 'Save changes', description: 'Button that saves the settings form'});
            assert.deepEqual(Object.keys(strings.server), ['api.retry']);
            const slice = JSON.parse(fs.readFileSync(path.join(scratch, 'strings', '01.json'), 'utf8'));
            assert.equal(slice.slice, '1 of 1');
            assert.deepEqual(slice.webapp, strings.webapp);
        } finally {
            fs.rmSync(scratch, {recursive: true, force: true});
        }
    });

    test('plan carries a reworded rename\'s translation as a starting point', () => {
        const original = repo.read('webapp/channels/src/i18n/en.json');
        const en = JSON.parse(original);
        en['app.delete_post'] = {defaultMessage: 'Delete the post permanently', description: 'Confirm button in the delete dialog'};
        delete en['app.reword'];
        repo.write('webapp/channels/src/i18n/en.json', json(en));
        const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-run-'));
        try {
            assert.equal(repo.run('plan_translations.mjs', scratch, '--base', base).status, 0);
            const ru = JSON.parse(fs.readFileSync(path.join(scratch, 'plan.json'), 'utf8')).surfaces.webapp.locales.ru;
            const item = ru.items['app.delete_post'];
            assert.equal(item.kind, 'changed');
            assert.equal(item.carriedFrom, 'app.reword');
            assert.equal(item.previous.english, 'Delete the post');
            assert.equal(item.current, 'Удалить сообщение');
            assert.ok('app.reword' in ru.prune);
        } finally {
            repo.write('webapp/channels/src/i18n/en.json', original);
            fs.rmSync(scratch, {recursive: true, force: true});
        }
    });
    test('validate reports every defect in a payload, and accepts a good one', () => {
        payload('ru', {
            webapp: {
                ...ruPayload.webapp,
                'app.count': ruPayload.webapp['app.count'].replace(' few {канала} many {каналов}', ''),
                'app.hello': 'У тебя новая почта',
                'app.new': 'Save changes',
                'app.title': 'Настройки',
            },
            acknowledge: {'webapp:app.reword': 'nothing wrong'},
            notes: {'webapp:app.title': {kind: 'choice', text: 'not an item'}, 'webapp:app.hello': 'a bare string'},
        });
        const r = repo.run('validate_locale.mjs', workdir, 'ru');
        assert.equal(r.status, 1);
        const out = r.stdout + r.stderr;
        for (const expected of [
            /webapp:app\.count: .*no few\/many form/,
            /webapp:app\.new: identical to the English.*acknowledge/,
            /webapp:app\.title: not in this locale's worklist/,
            /acknowledge\.webapp:app\.reword: nothing to acknowledge/,
            /notes\.webapp:app\.title: not in this locale's worklist/,
            /notes\.webapp:app\.hello: not \{"kind": "english" \| /,
            /webapp:app\.new: identical to the English.*\(soft finding, identical-to-english\)/,
        ]) {
            assert.match(out, expected);
        }

        payload('ru', ruPayload);
        const ok = repo.run('validate_locale.mjs', workdir, 'ru');
        assert.equal(ok.status, 0, ok.stdout + ok.stderr);
        assert.match(ok.stdout, /6 answered, 0 unanswered/);
        assert.match(ok.stdout, /1 changed items? kept/);
    });

    test('a repair returned unchanged is left as it was, unchecked', () => {
        payload('ru', {...ruPayload, webapp: {...ruPayload.webapp, 'app.hello': worklist('ru').webapp['app.hello'].current}});
        const r = repo.run('validate_locale.mjs', workdir, 'ru');
        assert.equal(r.status, 0, r.stdout + r.stderr);
        assert.match(r.stdout, /1 repairs left as they were/);
        payload('ru', ruPayload);
    });

    test('a file is found from the work directory, and counted on its own', () => {
        payload('ru', ruPayload);
        const r = repo.run('validate_locale.mjs', workdir, 'translations/ru/all.json');
        assert.equal(r.status, 0, r.stdout + r.stderr);
        assert.match(r.stdout, /^translations\/ru\/all\.json: 6 answered, 1 changed/m);
    });

    test('a translator can note an item it leaves out', () => {
        const {'app.new': left, ...webapp} = ruPayload.webapp;
        payload('ru', {...ruPayload, webapp, notes: {'webapp:app.new': {kind: 'english', text: 'Save which changes? The English does not say'}}});
        const r = repo.run('validate_locale.mjs', workdir, 'ru');
        assert.equal(r.status, 0, r.stdout + r.stderr);
        assert.match(r.stdout, /1 unanswered/);
        assert.ok(left);
        payload('ru', ruPayload);
    });

    test('a soft finding lands only with a reason', () => {
        payload('ru', {...ruPayload, webapp: {...ruPayload.webapp, 'app.new': 'Сохранить изменения в Mattermost'}});
        assert.equal(repo.run('validate_locale.mjs', workdir, 'ru').status, 0);

        const dropped = {...ruPayload, webapp: {...ruPayload.webapp}};
        dropped.webapp['app.archive_channel'] = 'Архивировать канал Mattermost';
        payload('ru', dropped);
        assert.equal(repo.run('validate_locale.mjs', workdir, 'ru').status, 0);

        payload('ru', {...ruPayload, webapp: {...ruPayload.webapp, 'app.new': 'Сохранить твои изменения'}});
        const r = repo.run('validate_locale.mjs', workdir, 'ru');
        assert.equal(r.status, 1);
        assert.match(r.stdout + r.stderr, /"твои": ru addresses the user formally/);

        payload('ru', {
            ...ruPayload,
            webapp: {...ruPayload.webapp, 'app.new': 'Сохранить твои изменения'},
            acknowledge: {'webapp:app.new': 'Quoted from a user-facing message where the informal form is intended.'},
        });
        assert.equal(repo.run('validate_locale.mjs', workdir, 'ru').status, 0);
        payload('ru', ruPayload);
    });
    test('a locale\'s answers can be split across files, each checked alone', () => {
        unpayload('ru', 'all');
        const {server, webapp: {'app.new': saved, ...webapp}} = ruPayload;
        const first = payload('ru', {webapp});
        const second = payload('ru', {webapp: {'app.new': saved}, server}, 'second');
        payload('ru', {webapp: {'app.new': 'Сохранить'}}, 'third');

        for (const file of [first, second]) {
            const r = repo.run('validate_locale.mjs', workdir, file);
            assert.equal(r.status, 0, r.stdout + r.stderr);
        }
        assert.match(repo.run('validate_locale.mjs', workdir, first).stdout, /4 answered, 1 changed/);

        const both = repo.run('validate_locale.mjs', workdir, 'ru');
        assert.equal(both.status, 1);
        assert.match(both.stderr, /webapp\.app\.new: in both .*second\.json and .*third\.json/);

        unpayload('ru', 'third');
        unpayload('ru', 'second');
        const partial = repo.run('finalize.mjs', workdir, '--no-verify');
        assert.equal(partial.status, 1);
        assert.match(partial.stderr, /2 worklist item\(s\) unanswered: webapp:app\.new, server:api\.retry/);

        unpayload('ru', 'all');
        payload('ru', ruPayload);
    });

    test('validating a locale leaves what is still unanswered as a worklist of its own', () => {
        const remaining = path.join(workdir, 'remaining', 'ru');
        unpayload('ru', 'all');
        const {server, webapp: {'app.new': saved, ...webapp}} = ruPayload;
        payload('ru', {webapp}, 'first');
        try {
            assert.equal(repo.run('validate_locale.mjs', workdir, 'ru').status, 0);
            assert.deepEqual(fs.readdirSync(remaining), ['01.json']);
            const left = JSON.parse(fs.readFileSync(path.join(remaining, '01.json'), 'utf8'));
            assert.equal(left.slice, '1 of 1');
            assert.equal(left.answers, 'translations/ru/r1-01.json');
            assert.deepEqual(left.language, worklist('ru').language);
            assert.deepEqual(Object.keys(left.webapp), ['app.new']);
            assert.deepEqual(left.webapp['app.new'], worklist('ru').webapp['app.new']);
            assert.deepEqual(Object.keys(left.server), ['api.retry']);

            payload('ru', {webapp: {'app.new': saved}, server}, 'r1-01');
            assert.equal(repo.run('validate_locale.mjs', workdir, 'ru').status, 0);
            assert.equal(fs.existsSync(remaining), false);
        } finally {
            unpayload('ru', 'first');
            unpayload('ru', 'r1-01');
            payload('ru', ruPayload);
        }
    });

    test('planning again keeps the answers whose item is unchanged', () => {
        const source = 'webapp/channels/src/i18n/en.json';
        const original = repo.read(source);
        const answers = path.join(workdir, 'translations', 'ru', 'all.json');
        const replan = () => repo.run('plan_translations.mjs', workdir, '--base', base);
        const en = JSON.parse(original);
        en['app.new'].defaultMessage = 'Save all changes';
        repo.write(source, json(en));
        try {
            const r = replan();
            assert.equal(r.status, 0, r.stderr);
            assert.match(r.stdout, /kept 5 answer\(s\) from the last plan, and dropped 1 whose worklist item changed/);
            const kept = JSON.parse(fs.readFileSync(answers, 'utf8'));
            assert.equal(kept.webapp['app.new'], undefined);
            const todo = JSON.parse(fs.readFileSync(path.join(workdir, 'remaining', 'ru', '01.json'), 'utf8'));
            assert.deepEqual(Object.keys(todo.webapp), ['app.new']);
            assert.equal(todo.server, undefined);
            assert.equal(kept.webapp['app.reword'], ruPayload.webapp['app.reword']);
            assert.deepEqual(kept.server, ruPayload.server);

            // A plan that stops changes nothing in the workdir.
            en['app.undescribed'] = {defaultMessage: 'Undo', description: ''};
            repo.write(source, json(en));
            assert.equal(replan().status, 1);
            assert.deepEqual(JSON.parse(fs.readFileSync(answers, 'utf8')), kept);
            assert.ok(fs.existsSync(path.join(workdir, 'plan.json')));
        } finally {
            repo.write(source, original);
            assert.equal(replan().status, 0);
            payload('ru', ruPayload);
        }
    });

    test('planning again survives a malformed answer file, and keeps the rest', () => {
        const replan = () => repo.run('plan_translations.mjs', workdir, '--base', base);
        payload('ru', {...ruPayload, notes: null});
        const broken = payload('ru', null, 'broken');
        try {
            const r = replan();
            assert.equal(r.status, 0, r.stdout + r.stderr);
            assert.match(r.stdout, /kept 6 answer\(s\)/);
            assert.ok(fs.existsSync(path.join(workdir, 'plan.json')));
            assert.deepEqual(JSON.parse(fs.readFileSync(path.join(workdir, 'translations', 'ru', 'all.json'), 'utf8')).webapp, ruPayload.webapp);
            assert.equal(fs.readFileSync(broken, 'utf8'), 'null');
        } finally {
            fs.rmSync(broken);
            payload('ru', ruPayload);
        }
    });

    test('finalize restores every file when a write fails partway', {skip: process.getuid?.() === 0 && 'root ignores file modes'}, () => {
        const before = repo.read('webapp/channels/src/i18n/ru.json');
        const locked = path.join(repo.root, 'server/i18n/ru.json');
        fs.chmodSync(locked, 0o444);
        try {
            const r = repo.run('finalize.mjs', workdir, '--no-verify');
            assert.equal(r.status, 1);
            assert.match(r.stderr, /EACCES[\s\S]*every catalog is restored/);
            assert.equal(repo.read('webapp/channels/src/i18n/ru.json'), before);
        } finally {
            fs.chmodSync(locked, 0o644);
        }
    });

    test('finalize restores every file when it cannot write its report', () => {
        payload('ru', ruPayload);
        const before = {catalog: repo.read('webapp/channels/src/i18n/ru.json'), baseline: repo.read('i18n/baseline.json')};
        const report = path.join(workdir, 'report.md');
        fs.mkdirSync(report);
        try {
            const r = repo.run('finalize.mjs', workdir, '--no-verify');
            assert.equal(r.status, 1);
            assert.match(r.stderr, /EISDIR[\s\S]*every catalog is restored/);
            assert.equal(repo.read('webapp/channels/src/i18n/ru.json'), before.catalog);
            assert.equal(repo.read('i18n/baseline.json'), before.baseline);
        } finally {
            fs.rmdirSync(report);
        }
    });

    test('finalize writes the catalogs and advances only the baselines it brought up to date', () => {
        payload('ru', {...ruPayload,
            notes: {
                'webapp:app.new': {kind: 'english', text: 'The English does not say what is saved'},
                'webapp:app.reword': {kind: 'catalog', text: 'app.old says the opposite'},
            }});
        const r = repo.run('finalize.mjs', workdir, '--no-verify');
        assert.equal(r.status, 0, r.stderr);

        const ru = JSON.parse(repo.read('webapp/channels/src/i18n/ru.json'));
        assert.deepEqual(Object.keys(ru), Object.keys(ru).sort());
        assert.equal(ru['app.remove_member'], 'Удалить участника');
        assert.equal(ru['app.archive_channel'], 'Архивировать канал');
        assert.equal(ru['app.old'], undefined);
        assert.equal(ru['app.gone'], undefined);
        assert.equal(ru['app.archive'], undefined);
        assert.equal(ru['app.hello'], 'У вас новая почта');

        // de had no payload: renames carry and removed keys go, but a rename
        // waiting on a translator keeps its old key for the next run.
        const de = JSON.parse(repo.read('webapp/channels/src/i18n/de.json'));
        assert.equal(de['app.remove_member'], 'Mitglied entfernen');
        assert.equal(de['app.gone'], undefined);
        assert.equal(de['app.archive'], 'Archivieren');
        assert.equal(de['app.new'], undefined);

        // The server catalog keeps its order and appends.
        assert.deepEqual(JSON.parse(repo.read('server/i18n/ru.json')).map((e) => e.id), ['api.error', 'api.items', 'api.retry']);
        assert.deepEqual(JSON.parse(repo.read('server/i18n/de.json')).map((e) => e.id), ['api.items', 'api.error']);

        const baseline = JSON.parse(repo.read('i18n/baseline.json'));
        assert.equal(baseline.webapp.ru, base);
        assert.equal(baseline.server.ru, base);
        assert.notEqual(baseline.webapp.de, base);
        assert.notEqual(baseline.server.de, base);

        assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(path.join(workdir, 'pruned.json'), 'utf8'))).sort(), ['de', 'ru']);
        const report = fs.readFileSync(path.join(workdir, 'report.md'), 'utf8');
        assert.match(report, /\| ru \| 2 \| 1 \| 1 \| 2 \| 0 \| 0 \| 1 \| 3 \|/);
        assert.match(report, /- de: 3 webapp, 1 server/);
        assert.match(report, /notes\.md: 1 english, 1 catalog string\(s\)/);
        const notes = fs.readFileSync(path.join(workdir, 'notes.md'), 'utf8');
        assert.match(notes, /#### Defects in the English\n\n- `webapp:app\.new` \(ru\): The English does not say what is saved/);
        assert.match(notes, /#### Wrong translations elsewhere in the catalogs, outside this run\n\n- `webapp:app\.reword` \(ru\): app\.old says the opposite/);
    });

    test('finalize refuses a plan the repository has moved away from', () => {
        const r = repo.run('finalize.mjs', workdir, '--no-verify');
        assert.equal(r.status, 1);
        assert.match(r.stderr, /changed since this plan was made/);
    });

    test('the next plan picks up where the last run stopped', () => {
        const next = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-run-'));
        const r = repo.run('plan_translations.mjs', next, '--base', base);
        assert.equal(r.status, 0, r.stderr);
        const plan = JSON.parse(fs.readFileSync(path.join(next, 'plan.json'), 'utf8'));
        assert.deepEqual(plan.surfaces.webapp.locales.ru.items, {});
        assert.deepEqual(plan.surfaces.server.locales.ru.items, {});
        const de = plan.surfaces.webapp.locales.de.items;
        assert.equal(de['app.archive_channel'].kind, 'changed');
        assert.equal(de['app.archive_channel'].current, 'Archivieren');
        assert.equal(de['app.reword'].kind, 'changed');
        assert.equal(de['app.new'].kind, 'new');
        fs.rmSync(next, {recursive: true, force: true});
    });

    test('planning in a used workdir clears what the last finalize wrote', () => {
        assert.ok(fs.existsSync(path.join(workdir, 'report.md')));
        const r = repo.run('plan_translations.mjs', workdir, '--base', base);
        assert.equal(r.status, 0, r.stderr);
        assert.equal(fs.existsSync(path.join(workdir, 'report.md')), false);
        assert.equal(fs.existsSync(path.join(workdir, 'notes.md')), false);
        assert.equal(fs.existsSync(path.join(workdir, 'pruned.json')), false);
    });
});
