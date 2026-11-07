// Each test drives the scripts as a translation run would, in a throwaway git
// repository holding only the files they read.
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {after, before, describe, test} from 'node:test';
import {fileURLToPath} from 'node:url';

const scripts = path.dirname(fileURLToPath(import.meta.url));
const realStyle = JSON.parse(fs.readFileSync(path.join(scripts, '../style.json'), 'utf8'));

const json = (body) => JSON.stringify(body, null, 2) + '\n';
const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
const webappSource = (entries) => json(Object.fromEntries(Object.entries(entries).map(([k, [defaultMessage, description]]) => [k, {defaultMessage, description}])));
const serverSource = (entries) => json(Object.entries(entries).map(([id, [translation, description]]) => ({id, translation, description})));
const serverCatalog = (entries) => json(Object.entries(entries).map(([id, translation]) => ({id, translation})));

function makeRepo() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-pipeline-'));
    const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();
    const write = (rel, text) => {
        fs.mkdirSync(path.dirname(path.join(root, rel)), {recursive: true});
        fs.writeFileSync(path.join(root, rel), text);
    };
    const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
    const commit = (message) => {
        git('add', '-A');
        git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', message);
        return git('rev-parse', 'HEAD');
    };
    const run = (script, ...args) => spawnSync(process.execPath, [path.join(scripts, script), ...args], {cwd: root, encoding: 'utf8'});
    git('init', '-q', '-b', 'master');
    return {root, git, write, read, commit, run};
}

// Commit A is translated; B records A as every locale's baseline; C is a day of
// development: a new key, a reworded one, two renames (one redescribed), and a
// removed key.
function seed(repo) {
    const webappA = {
        'app.archive': ['Archive', 'Menu item'],
        'app.count': ['{count, number} {count, plural, one {channel} other {channels}}', 'Number of channels a policy covers'],
        'app.gone': ['Obsolete text', 'Unused'],
        'app.hello': ['You have new mail', 'Banner when mail arrives'],
        'app.old': ['Remove member', 'Button that removes a member from the channel'],
        'app.plain': ['OK', ''],
        'app.reword': ['Delete the post', 'Confirm button in the delete dialog'],
        'app.title': ['Channel settings', 'Title of the channel settings modal'],
    };
    repo.write('webapp/channels/src/i18n/en.json', webappSource(webappA));
    repo.write('webapp/channels/src/i18n/ru.json', json(sorted({
        'app.archive': 'Архив',
        'app.count': '{count, number} {count, plural, one {канал} other {каналов}}',
        'app.gone': 'Устаревший текст',
        'app.hello': 'У тебя новая почта',
        'app.old': 'Удалить участника',
        'app.plain': 'ОК',
        'app.reword': 'Удалить сообщение',
        'app.title': 'Настройки канала',
    })));
    repo.write('webapp/channels/src/i18n/de.json', json(sorted({
        'app.archive': 'Archivieren',
        'app.count': '{count, number} {count, plural, one {Kanal} other {Kanäle}}',
        'app.gone': 'Veralteter Text',
        'app.hello': 'Du hast neue Post',
        'app.old': 'Mitglied entfernen',
        'app.plain': 'OK',
        'app.reword': 'Beitrag löschen',
        'app.title': 'Kanaleinstellungen',
    })));
    repo.write('server/i18n/en.json', serverSource({
        'api.error': ['Something failed', 'Generic error'],
        'api.items': [{one: '{{.Count}} item', other: '{{.Count}} items'}, 'Number of items in a list'],
    }));
    repo.write('server/i18n/ru.json', serverCatalog({
        'api.error': 'Что-то пошло не так',
        'api.items': {one: '{{.Count}} элемент', few: '{{.Count}} элемента', many: '{{.Count}} элементов', other: '{{.Count}} элемента'},
    }));
    repo.write('server/i18n/de.json', serverCatalog({
        'api.items': {one: '{{.Count}} Element', other: '{{.Count}} Elemente'},
        'api.error': 'Etwas ist fehlgeschlagen',
    }));
    repo.write('i18n/glossary/en.json', json({Mattermost: {definition: 'The product.', partOfSpeech: 'noun', doNotTranslate: true}}));
    repo.write('i18n/glossary/ru.json', json({Mattermost: {target: 'Mattermost'}}));
    repo.write('i18n/glossary/de.json', json({Mattermost: {target: 'Mattermost'}}));
    repo.write('i18n/style.json', json({de: realStyle.de, ru: realStyle.ru}));
    const A = repo.commit('A');

    repo.write('i18n/baseline.json', json({server: {de: A, ru: A}, webapp: {de: A, ru: A}}));
    repo.commit('B');

    const webappC = {...webappA};
    delete webappC['app.gone'];
    delete webappC['app.old'];
    delete webappC['app.archive'];
    webappC['app.remove_member'] = webappA['app.old'];
    webappC['app.archive_channel'] = ['Archive', 'Menu item that archives the channel'];
    webappC['app.reword'] = ['Delete the message', 'Confirm button in the delete dialog'];
    webappC['app.new'] = ['Save changes', 'Button that saves the settings form'];
    repo.write('webapp/channels/src/i18n/en.json', webappSource(webappC));
    repo.write('server/i18n/en.json', serverSource({
        'api.error': ['Something failed', 'Generic error'],
        'api.items': [{one: '{{.Count}} item', other: '{{.Count}} items'}, 'Number of items in a list'],
        'api.retry': ['Try again later', 'Error when the server is busy'],
    }));
    return {A, C: repo.commit('C')};
}

const ruPayload = {
    webapp: {
        'app.archive_channel': 'Архивировать канал',
        'app.count': '{count, number} {count, plural, one {канал} few {канала} many {каналов} other {канала}}',
        'app.hello': 'У вас новая почта',
        'app.new': 'Сохранить изменения',
        'app.reword': 'Удалить сообщение',
    },
    server: {'api.retry': 'Повторите попытку позже'},
};

describe('a translation run', () => {
    let repo;
    let base;
    let workdir;
    const worklist = (locale) => JSON.parse(fs.readFileSync(path.join(workdir, 'worklists', `${locale}.json`), 'utf8'));
    const payload = (locale, body) => {
        fs.mkdirSync(path.join(workdir, 'translations'), {recursive: true});
        fs.writeFileSync(path.join(workdir, 'translations', `${locale}.json`), JSON.stringify(body));
    };

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
            const r = repo.run('plan.mjs', scratch, '--base', base);
            assert.equal(r.status, 1);
            assert.match(r.stderr, /1 worklist keys have no description/);
            assert.deepEqual(JSON.parse(fs.readFileSync(path.join(scratch, 'undescribed.json'), 'utf8')).webapp, {'app.undescribed': 'Undo'});
            assert.equal(fs.existsSync(path.join(scratch, 'worklists')), false);
            assert.equal(fs.existsSync(path.join(scratch, 'plan.json')), false);
        } finally {
            repo.write('webapp/channels/src/i18n/en.json', original);
            fs.rmSync(scratch, {recursive: true, force: true});
        }
    });

    test('plan stops on a gap no day of development produces', () => {
        const original = repo.read('webapp/channels/src/i18n/en.json');
        const en = JSON.parse(original);
        for (let i = 0; i <= 1000; i++) {
            en[`bulk.key${i}`] = {defaultMessage: `Item ${i}`, description: 'Generated'};
        }
        repo.write('webapp/channels/src/i18n/en.json', json(en));
        const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-run-'));
        try {
            const r = repo.run('plan.mjs', scratch, '--base', base);
            assert.equal(r.status, 1);
            assert.match(r.stderr, /webapp: 1002 distinct new keys/);
            assert.equal(fs.existsSync(path.join(scratch, 'plan.json')), false);
            assert.equal(repo.run('plan.mjs', scratch, '--base', base, '--accept-unusual').status, 0);
        } finally {
            repo.write('webapp/channels/src/i18n/en.json', original);
            fs.rmSync(scratch, {recursive: true, force: true});
        }
    });

    test('plan refuses a baseline the base does not descend from', () => {
        const original = repo.read('i18n/baseline.json');
        const elsewhere = repo.git('commit-tree', 'HEAD^{tree}', '-m', 'elsewhere');
        repo.write('i18n/baseline.json', original.replace(/"de": "[0-9a-f]+"/, `"de": "${elsewhere}"`));
        const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-run-'));
        try {
            const r = repo.run('plan.mjs', scratch, '--base', base);
            assert.equal(r.status, 2);
            assert.match(r.stderr, new RegExp(`server/de is at ${elsewhere}, which ${base} does not descend from`));
        } finally {
            repo.write('i18n/baseline.json', original);
            fs.rmSync(scratch, {recursive: true, force: true});
        }
    });

    test('plan finds new, changed, renamed, removed and repairable keys', () => {
        const r = repo.run('plan.mjs', workdir, '--base', base);
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
            assert.equal(repo.run('plan.mjs', scratch, '--base', base).status, 0);
            const items = JSON.parse(fs.readFileSync(path.join(scratch, 'worklists', 'ru.json'), 'utf8')).webapp;
            assert.deepEqual(items['app.copy'].sameEnglish, ['Настройки канала']);
            assert.deepEqual(items['app.brand'].terms, [{term: 'Mattermost', target: 'Mattermost', doNotTranslate: true}]);
        } finally {
            repo.write('webapp/channels/src/i18n/en.json', original);
            fs.rmSync(scratch, {recursive: true, force: true});
        }
    });

    test('plan takes repairs up to the cap, and counts the rest', () => {
        const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-run-'));
        try {
            const r = repo.run('plan.mjs', scratch, '--base', base, '--max-repairs', '1');
            assert.equal(r.status, 0, r.stderr);
            const ru = JSON.parse(fs.readFileSync(path.join(scratch, 'plan.json'), 'utf8')).surfaces.webapp.locales.ru;
            assert.equal(Object.values(ru.items).filter((item) => item.kind === 'repair').length, 1);
            assert.equal(ru.repairsAvailable, 2);
            assert.match(r.stdout, /^ru\s+2\s+2\s+1\/2\s+1\s+3$/m);
        } finally {
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
            notes: {'webapp:app.title': 'not an item'},
        });
        const r = repo.run('validate.mjs', workdir, 'ru');
        assert.equal(r.status, 1);
        const out = r.stdout + r.stderr;
        for (const expected of [
            /server:api\.retry: missing from the payload/,
            /webapp:app\.count: .*no few\/many form/,
            /webapp:app\.hello: returned unchanged, but it is listed for repair/,
            /webapp:app\.new: identical to the English.*acknowledge/,
            /webapp:app\.title: not in this locale's worklist/,
            /acknowledge\.webapp:app\.reword: nothing to acknowledge/,
            /notes\.webapp:app\.title: not in this locale's worklist/,
        ]) {
            assert.match(out, expected);
        }

        payload('ru', ruPayload);
        const ok = repo.run('validate.mjs', workdir, 'ru');
        assert.equal(ok.status, 0, ok.stdout + ok.stderr);
        assert.match(ok.stdout, /6 answered/);
        assert.match(ok.stdout, /1 changed items? kept/);
    });

    test('a soft finding lands only with a reason', () => {
        payload('ru', {...ruPayload, webapp: {...ruPayload.webapp, 'app.new': 'Сохранить изменения в Mattermost'}});
        assert.equal(repo.run('validate.mjs', workdir, 'ru').status, 0);

        const dropped = {...ruPayload, webapp: {...ruPayload.webapp}};
        dropped.webapp['app.archive_channel'] = 'Архивировать канал Mattermost';
        payload('ru', dropped);
        assert.equal(repo.run('validate.mjs', workdir, 'ru').status, 0);

        payload('ru', {...ruPayload, webapp: {...ruPayload.webapp, 'app.new': 'Сохранить твои изменения'}});
        const r = repo.run('validate.mjs', workdir, 'ru');
        assert.equal(r.status, 1);
        assert.match(r.stdout + r.stderr, /"твои": ru addresses the user formally/);

        payload('ru', {
            ...ruPayload,
            webapp: {...ruPayload.webapp, 'app.new': 'Сохранить твои изменения'},
            acknowledge: {'webapp:app.new': 'Quoted from a user-facing message where the informal form is intended.'},
        });
        assert.equal(repo.run('validate.mjs', workdir, 'ru').status, 0);
        payload('ru', ruPayload);
    });
    test('apply writes the catalogs and advances only the baselines it brought up to date', () => {
        const r = repo.run('apply.mjs', workdir, '--no-verify');
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

        const report = fs.readFileSync(path.join(workdir, 'report.md'), 'utf8');
        assert.match(report, /\| ru \| 2 \| 1 \| 1 \| 2 \| 1 \| 3 \|/);
        assert.match(report, /- de: 3 webapp, 1 server/);
    });

    test('apply refuses a plan the repository has moved away from', () => {
        const r = repo.run('apply.mjs', workdir, '--no-verify');
        assert.equal(r.status, 1);
        assert.match(r.stderr, /changed since this plan was made/);
    });

    test('the next plan picks up where the last run stopped', () => {
        const next = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-run-'));
        const r = repo.run('plan.mjs', next, '--base', base);
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
});
