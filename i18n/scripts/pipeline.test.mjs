// node --test i18n/scripts/*.test.mjs
//
// Each test drives the scripts as a translation run would, in a throwaway git
// repository holding only the files they read.
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {after, before, describe, test} from 'node:test';
import {fileURLToPath} from 'node:url';

import {checkTranslation} from './lib/rules.mjs';
import {readStyle} from './lib/glossary.mjs';

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
        assert.match(ru.items['app.hello'].problems[0], /"тебя"|"тебе"|"ты"|у тебя/i);
        assert.deepEqual(Object.keys(plan.surfaces.server.locales.ru.items), ['api.retry']);

        // de addresses the user informally, and its plurals need only one/other.
        assert.equal(plan.surfaces.webapp.locales.de.items['app.hello'], undefined);
        assert.equal(plan.surfaces.webapp.locales.de.items['app.count'], undefined);

        const w = worklist('ru');
        assert.equal(w.language.address.form, 'formal');
        assert.deepEqual(w.language.pluralForms.webapp.required, ['one', 'few', 'many', 'other']);
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

    describe('check_pr.mjs', () => {
        const check = () => repo.run('check_pr.mjs', '--base', base);
        const tamper = (rel, fn) => {
            const original = repo.read(rel);
            repo.write(rel, fn(original));
            try {
                return check();
            } finally {
                repo.write(rel, original);
            }
        };
        const editJSON = (rel, fn) => tamper(rel, (text) => {
            const body = JSON.parse(text);
            fn(body);
            return json(body);
        });

        before(() => {
            repo.git('checkout', '-q', '-b', 'run');
            repo.commit('Translate');
        });

        test('passes the run as apply wrote it', () => {
            const r = check();
            assert.equal(r.status, 0, r.stdout + r.stderr);
            assert.match(r.stdout, /checked as a translation run/);
        });

        test('rejects a change to the English', () => {
            const r = editJSON('webapp/channels/src/i18n/en.json', (b) => {
                b['app.title'].defaultMessage = 'Channel options';
            });
            assert.equal(r.status, 1);
            assert.match(r.stderr, /app\.title: the English changed/);
        });

        test('accepts a description that was empty, and rejects rewriting one that was not', () => {
            const ok = editJSON('webapp/channels/src/i18n/en.json', (b) => {
                b['app.plain'].description = 'Button that closes the dialog';
            });
            assert.equal(ok.status, 0, ok.stderr);

            const r = editJSON('webapp/channels/src/i18n/en.json', (b) => {
                b['app.title'].description = 'Something else';
            });
            assert.equal(r.status, 1);
            assert.match(r.stderr, /only descriptions that were empty/);
        });

        test('rejects a translation outside the worklist', () => {
            const r = editJSON('webapp/channels/src/i18n/ru.json', (b) => {
                b['app.title'] = 'Параметры канала';
            });
            assert.equal(r.status, 1);
            assert.match(r.stderr, /app\.title changed, but it is not in this locale's worklist/);
        });

        test('rejects a carried rename with a different translation', () => {
            const r = editJSON('webapp/channels/src/i18n/de.json', (b) => {
                b['app.remove_member'] = 'Mitglied rauswerfen';
            });
            assert.equal(r.status, 1);
            assert.match(r.stderr, /app\.remove_member is a rename of app\.old/);
        });

        test('rejects removing a key en.json still has', () => {
            const r = editJSON('webapp/channels/src/i18n/de.json', (b) => {
                delete b['app.title'];
            });
            assert.equal(r.status, 1);
            assert.match(r.stderr, /app\.title removed, but en\.json still has it/);
        });

        test('rejects a baseline moved before every new key is translated', () => {
            const r = editJSON('i18n/baseline.json', (b) => {
                b.webapp.de = base;
            });
            assert.equal(r.status, 1);
            assert.match(r.stderr, /webapp\/de moved, but 1 new key\(s\) have no translation, such as app\.new/);
        });

        test('rejects a baseline moved anywhere but the base', () => {
            const r = editJSON('i18n/baseline.json', (b) => {
                b.webapp.ru = repo.git('rev-parse', 'HEAD~2');
            });
            assert.equal(r.status, 1);
            assert.match(r.stderr, /but a run moves it to its base/);
        });

        test('rejects a changed glossary entry, and files a run has no business in', () => {
            const r = editJSON('i18n/glossary/ru.json', (b) => {
                b.Mattermost.note = 'changed';
            });
            assert.equal(r.status, 1);
            assert.match(r.stderr, /"Mattermost" changed; a run only adds terms/);

            const s = tamper('i18n/style.json', (text) => text.replace('"formal"', '"informal"'));
            assert.equal(s.status, 1);
            assert.match(s.stderr, /i18n\/style\.json: a run changes only/);
        });

        test('judges a run by the glossary it started from', () => {
            const en = repo.read('i18n/glossary/en.json');
            const ru = repo.read('i18n/glossary/ru.json');
            const de = repo.read('i18n/glossary/de.json');
            const catalog = repo.read('webapp/channels/src/i18n/ru.json');
            const add = (text, entry) => json({...JSON.parse(text), 'Save changes': entry});
            repo.write('i18n/glossary/en.json', add(en, {definition: 'x', partOfSpeech: 'noun', doNotTranslate: true}));
            repo.write('i18n/glossary/ru.json', add(ru, {target: 'Save changes'}));
            repo.write('i18n/glossary/de.json', add(de, {target: 'Save changes'}));
            repo.write('webapp/channels/src/i18n/ru.json', json({...JSON.parse(catalog), 'app.new': 'Save changes'}));
            try {
                const r = check();
                assert.equal(r.status, 0, r.stderr);
                assert.match(r.stdout, /warning: .*ru\.json: app\.new: identical to the English/);
            } finally {
                repo.write('i18n/glossary/en.json', en);
                repo.write('i18n/glossary/ru.json', ru);
                repo.write('i18n/glossary/de.json', de);
                repo.write('webapp/channels/src/i18n/ru.json', catalog);
            }
        });

        test('holds any pull request to the rules for what it changes', () => {
            repo.git('checkout', '-q', 'master');
            try {
                const r = editJSON('webapp/channels/src/i18n/ru.json', (b) => {
                    b['app.title'] = 'Настройки {count, plural, one {канала} other {каналов}}';
                });
                assert.equal(r.status, 1);
                assert.match(r.stderr, /ru\.json: app\.title: .*count/);
                assert.doesNotMatch(r.stdout, /translation run/);

                const w = editJSON('webapp/channels/src/i18n/ru.json', (b) => {
                    b['app.title'] = 'Channel settings';
                });
                assert.equal(w.status, 0);
                assert.match(w.stdout, /warning: .*app\.title: identical to the English/);
            } finally {
                repo.git('checkout', '-q', 'run');
            }
        });
    });
});

describe('describe.mjs', () => {
    let repo;
    let input;
    before(() => {
        repo = makeRepo();
        seed(repo);
        input = path.join(repo.root, '..', `${path.basename(repo.root)}-descriptions.json`);
    });
    after(() => {
        fs.rmSync(repo.root, {recursive: true, force: true});
        fs.rmSync(input, {force: true});
    });
    const describeWith = (body) => {
        fs.writeFileSync(input, JSON.stringify(body));
        return repo.run('describe.mjs', input);
    };

    test('refuses anything but filling an empty description, and then writes nothing', () => {
        const before = repo.read('webapp/channels/src/i18n/en.json');
        const r = describeWith({
            webapp: {'app.plain': 'Button that closes the dialog', 'app.title': 'Other', 'app.none': 'x'},
            server: {'api.error': 'Something failed'},
        });
        assert.equal(r.status, 1);
        assert.match(r.stderr, /webapp:app\.title: already described/);
        assert.match(r.stderr, /webapp:app\.none: not in/);
        assert.match(r.stderr, /server:api\.error: already described/);
        assert.equal(repo.read('webapp/channels/src/i18n/en.json'), before);
    });

    test('fills an empty description in place', () => {
        const before = repo.read('webapp/channels/src/i18n/en.json');
        assert.equal(describeWith({webapp: {'app.plain': 'OK'}}).status, 1);
        const r = describeWith({webapp: {'app.plain': 'Button that closes the dialog'}});
        assert.equal(r.status, 0, r.stderr);
        const after = repo.read('webapp/channels/src/i18n/en.json');
        assert.equal(JSON.parse(after)['app.plain'].description, 'Button that closes the dialog');
        assert.deepEqual(Object.keys(JSON.parse(after)), Object.keys(JSON.parse(before)));
        assert.equal(after.split('\n').length, before.split('\n').length);
    });
});

describe('check_glossary.mjs', () => {
    let repo;
    before(() => {
        repo = makeRepo();
        seed(repo);
    });
    after(() => fs.rmSync(repo.root, {recursive: true, force: true}));

    test('passes consistent files', () => {
        const r = repo.run('check_glossary.mjs');
        assert.equal(r.status, 0, r.stderr);
    });

    test('reports each kind of problem', () => {
        repo.write('i18n/glossary/en.json', json({
            Mattermost: {definition: 'The product.', partOfSpeech: 'noun', doNotTranslate: true},
            Boards: {definition: 'A product.', partOfSpeech: 'thing', doNotTranslate: false, commonWord: true, aliases: ['Mattermost']},
        }));
        repo.write('i18n/glossary/ru.json', json({Mattermost: {target: 'Маттермост'}}));
        repo.write('i18n/glossary/de.json', '{"Boards": {"target": "Boards"}, "Mattermost": {"target": "Mattermost", "extra": 1}}');
        repo.write('i18n/glossary/fr.json', json({}));
        repo.write('i18n/style.json', json({ru: {address: 'polite', use: ['вы'], avoid: ['вы']}}));
        const r = repo.run('check_glossary.mjs');
        assert.equal(r.status, 1);
        for (const expected of [
            /partOfSpeech is "thing"/,
            /commonWord is for doNotTranslate terms only/,
            /"Mattermost" is also "Mattermost"|"Mattermost" is also/,
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
});

describe('rules', () => {
    const glossary = [];
    const check = (locale, english, value, surface = 'webapp') => checkTranslation({
        item: {english, description: ''},
        value,
        locale,
        surface,
        glossary,
        style: readStyle({read: () => JSON.stringify(realStyle)}, locale),
    }).map((f) => `${f.severity} ${f.rule}`);

    test('English left as it is', () => {
        assert.deepEqual(check('ru', 'With CEL you can define conditions', 'With CEL you can define conditions'), ['error identical-to-english']);
        assert.deepEqual(check('pl', 'Confirm sending notifications to groups', 'Confirm sending notifications to groups'), ['error identical-to-english']);
        assert.deepEqual(check('ru', 'Azure Blob Storage', 'Azure Blob Storage'), ['soft identical-to-english']);
        assert.deepEqual(check('de', 'Save changes', 'Save changes'), ['soft identical-to-english']);
        assert.deepEqual(check('de', 'Status', 'Status'), []);
        assert.deepEqual(check('fr', '[on|off|status] [@username]', '[on|off|status] [@username]', 'server'), []);
        assert.deepEqual(check('en-AU', 'Save your changes now', 'Save your changes now'), []);
    });

    test('English words left in a non-Latin script', () => {
        assert.deepEqual(check('ru', '{count, plural, one {team} other {teams}}', '{count, plural, one {team} few {teams} many {teams} other {teams}}'), ['soft english-words']);
        assert.deepEqual(check('ru', 'Open the {name} webhook settings', 'Откройте настройки вебхука {name}'), []);
        assert.deepEqual(check('ru', 'Upload a .png file from https://example.com', 'Загрузите файл .png с https://example.com'), []);
        assert.deepEqual(check('ru', 'Type /header to set it', 'Введите /header, чтобы задать его'), []);
    });

    test('form of address', () => {
        assert.deepEqual(check('de', 'Enter a number', 'Geben Sie eine Zahl ein'), ['soft address']);
        assert.deepEqual(check('de', 'They agreed', 'Sie stimmten zu'), []);
        assert.deepEqual(check('de', 'Enter a number', 'Gib eine Zahl ein'), []);
        assert.deepEqual(check('ru', 'Your license', 'Твоя лицензия', 'server'), ['soft address']);
        assert.deepEqual(check('fr', 'You can do it', 'Tu peux le faire'), ['soft address']);
    });

    test('broken encoding is an error', () => {
        assert.deepEqual(check('de', 'Settings', 'Einstellun\uFFFDen'), ['error encoding']);
    });

    test('server plural forms follow go-i18n, not CLDR', () => {
        const english = {one: '{{.Count}} item', other: '{{.Count}} items'};
        assert.deepEqual(check('es', english, {one: '{{.Count}} elemento', other: '{{.Count}} elementos'}, 'server'), []);
        assert.deepEqual(check('es', english, {one: '{{.Count}} elemento', many: '{{.Count}} elementos', other: '{{.Count}} elementos'}, 'server'), ['error plural-category']);
        assert.deepEqual(check('ru', english, '{{.Count}} элементов', 'server'), ['error plural-demoted']);
    });
});
