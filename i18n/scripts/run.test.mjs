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

describe('a translation run', () => {
    let repo;
    let base;
    let workdir;
    const worklist = (locale) => JSON.parse(fs.readFileSync(path.join(workdir, 'worklists', `${locale}.json`), 'utf8'));

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

    test('plan finds new, changed, renamed and removed keys', () => {
        const r = repo.run('plan.mjs', workdir, '--base', base);
        assert.equal(r.status, 0, r.stderr);
        const plan = JSON.parse(fs.readFileSync(path.join(workdir, 'plan.json'), 'utf8'));
        const ru = plan.surfaces.webapp.locales.ru;

        assert.deepEqual(ru.carry, {'app.remove_member': 'app.old'});
        assert.deepEqual(Object.keys(ru.prune).sort(), ['app.archive', 'app.gone', 'app.old']);
        const kinds = Object.fromEntries(Object.entries(ru.items).map(([k, item]) => [k, item.kind]));
        assert.deepEqual(kinds, {
            'app.archive_channel': 'changed',
            'app.new': 'new',
            'app.reword': 'changed',
        });
        assert.equal(ru.items['app.archive_channel'].carriedFrom, 'app.archive');
        assert.equal(ru.items['app.archive_channel'].current, 'Архив');
        assert.equal(ru.items['app.reword'].previous.english, 'Delete the post');
        assert.equal(ru.items['app.reword'].current, 'Удалить сообщение');
        assert.deepEqual(Object.keys(plan.surfaces.server.locales.ru.items), ['api.retry']);
        assert.deepEqual(Object.keys(worklist('ru').webapp), Object.keys(ru.items));
    });
});
