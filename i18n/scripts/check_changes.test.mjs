// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Each test changes a branch, and checks what check_changes.mjs says about it:
// first a finished translation run, then a hand edit on master.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {after, before, describe, test} from 'node:test';

import {finishRun, json, makeRepo, seed, serverSource, webappSource} from './lib/fixture.mjs';

describe('check_changes.mjs', () => {
    let repo;
    let base;
    let workdir;
    const check = () => repo.run('check_changes.mjs', '--base', base);
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
        repo = makeRepo();
        base = seed(repo).C;
        workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-run-'));
        finishRun(repo, base, workdir);
    });
    after(() => {
        fs.rmSync(repo.root, {recursive: true, force: true});
        fs.rmSync(workdir, {recursive: true, force: true});
    });

    describe('a translation run', () => {
        test('passes as finalize wrote it', () => {
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

        test('rejects a deleted catalog', () => {
            const file = path.join(repo.root, 'server/i18n/de.json');
            const original = repo.read('server/i18n/de.json');
            fs.rmSync(file);
            try {
                const d = check();
                assert.equal(d.status, 1, d.stdout + d.stderr);
                assert.match(d.stderr, /server\/i18n\/de\.json: removed; removing a locale is a pull request of its own/);
            } finally {
                repo.write('server/i18n/de.json', original);
            }
        });

        test('rejects a baseline moved before every worklist key is translated', () => {
            const r = editJSON('i18n/baseline.json', (b) => {
                b.webapp.de = base;
            });
            assert.equal(r.status, 1);
            assert.match(r.stderr, /webapp\/de moved, but 2 worklist key\(s\) have no translation, such as app\.archive_channel, app\.new/);
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

        test('is judged by the glossary it started from', () => {
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
    });

    describe('a hand edit', () => {
        before(() => repo.git('checkout', '-q', 'master'));
        after(() => repo.git('checkout', '-q', 'translations/test'));

        test('passes a correct fix without warnings, and does not treat it as a run', () => {
            const r = editJSON('webapp/channels/src/i18n/ru.json', (b) => {
                b['app.title'] = 'Параметры канала';
            });
            assert.equal(r.status, 0, r.stdout + r.stderr);
            assert.doesNotMatch(r.stdout, /^warning:|translation run/m);
            assert.match(r.stdout, /1 catalog entries changed .*: 0 error\(s\), 0 warning\(s\)/);
        });

        test('fails a key added to en.json with no description', () => {
            const r = editJSON('webapp/channels/src/i18n/en.json', (b) => {
                b['app.added'] = {defaultMessage: 'Export', description: ''};
            });
            assert.equal(r.status, 1);
            assert.match(r.stderr, /en\.json: app\.added: added with no description/);

            const s = editJSON('server/i18n/en.json', (b) => {
                b.push({id: 'api.added', translation: 'Export failed', description: ' '});
            });
            assert.equal(s.status, 1);
            assert.match(s.stderr, /server\/i18n\/en\.json: api\.added: added with no description/);

            const ok = editJSON('webapp/channels/src/i18n/en.json', (b) => {
                b['app.added'] = {defaultMessage: 'Export', description: 'Button that exports the channel to a file'};
            });
            assert.equal(ok.status, 0, ok.stdout + ok.stderr);
        });

        test('fails a fix that breaks a rule, and warns about a likely mistake', () => {
            const r = editJSON('webapp/channels/src/i18n/ru.json', (b) => {
                b['app.title'] = 'Настройки {count, plural, one {канала} other {каналов}}';
            });
            assert.equal(r.status, 1);
            assert.match(r.stderr, /ru\.json: app\.title: .*count/);

            const w = editJSON('webapp/channels/src/i18n/ru.json', (b) => {
                b['app.title'] = 'Channel settings';
            });
            assert.equal(w.status, 0);
            assert.match(w.stdout, /warning: .*app\.title: identical to the English/);
        });
    });
});

// A key added in one cycle reaches the next baseline with no description,
// since descriptions are written at the start of a run. Renamed in the next
// cycle, it is a carry by the base's en.json and a changed item by the run's.
describe('check_changes.mjs on a run that describes a renamed key', () => {
    let repo;
    let workdir;

    before(() => {
        repo = makeRepo();
        repo.write('webapp/channels/src/i18n/en.json', webappSource({'app.old': ['Remove member', '']}));
        repo.write('webapp/channels/src/i18n/de.json', json({'app.old': 'Mitglied entfernen'}));
        repo.write('server/i18n/en.json', serverSource({}));
        const A = repo.commit('A');
        repo.write('i18n/baseline.json', json({server: {}, webapp: {de: A}}));
        repo.commit('B');
        repo.write('webapp/channels/src/i18n/en.json', webappSource({'app.remove_member': ['Remove member', '']}));
        repo.commit('C');
        workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-run-'));
    });
    after(() => {
        fs.rmSync(repo.root, {recursive: true, force: true});
        fs.rmSync(workdir, {recursive: true, force: true});
    });

    test('passes the run as its own plan saw it', () => {
        const base = repo.git('rev-parse', 'HEAD');
        repo.git('checkout', '-q', '-b', 'translations/rename');
        const step = (script, ...args) => {
            const r = repo.run(script, ...args);
            assert.equal(r.status, 0, `${script}: ${r.stdout}${r.stderr}`);
        };
        fs.writeFileSync(path.join(workdir, 'descriptions.json'), JSON.stringify({webapp: {'app.remove_member': 'Button that removes a member from the channel'}}));
        step('fill_empty_descriptions.mjs', workdir);
        repo.commit('Describe');
        step('plan_translations.mjs', workdir, '--base', base);
        const de = JSON.parse(fs.readFileSync(path.join(workdir, 'worklists', 'de', '01.json'), 'utf8'));
        assert.equal(de.webapp['app.remove_member'].carriedFrom, 'app.old');

        const answers = path.join(workdir, 'translations', 'de', 'all.json');
        fs.mkdirSync(path.dirname(answers), {recursive: true});
        fs.writeFileSync(answers, JSON.stringify({webapp: {'app.remove_member': 'Mitglied aus dem Kanal entfernen'}}));
        step('finalize.mjs', workdir, '--no-verify');
        repo.commit('Translate');

        const r = repo.run('check_changes.mjs', '--base', base);
        assert.equal(r.status, 0, r.stdout + r.stderr);
        assert.match(r.stdout, /checked as a translation run/);
    });
});

describe('check_changes.mjs on a run master has moved past', () => {
    let repo;
    let base;
    let workdir;

    before(() => {
        repo = makeRepo();
        base = seed(repo).C;
        workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-run-'));
        finishRun(repo, base, workdir);
        repo.git('checkout', '-q', 'master');
        const en = JSON.parse(repo.read('webapp/channels/src/i18n/en.json'));
        en['app.later'] = {defaultMessage: 'Try later', description: 'Button that postpones the action'};
        repo.write('webapp/channels/src/i18n/en.json', json(en));
        repo.commit('D');
        repo.git('checkout', '-q', 'translations/test');
    });
    after(() => {
        fs.rmSync(repo.root, {recursive: true, force: true});
        fs.rmSync(workdir, {recursive: true, force: true});
    });

    test('fails a merge from master, and says how to refresh the run', () => {
        repo.git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'merge', '-q', '--no-edit', 'master');
        const r = repo.run('check_changes.mjs', '--upstream', 'master');
        assert.equal(r.status, 1);
        assert.match(r.stderr, /If its target branch has moved on since the run planned, rebuild the branch from the target/);
    });

    test('passes the run rebuilt from master, which translates only what master added', () => {
        repo.git('switch', '-q', '-C', 'translations/test', 'master');
        const next = repo.git('rev-parse', 'HEAD');
        const plan = repo.run('plan_translations.mjs', workdir, '--base', next);
        assert.equal(plan.status, 0, plan.stderr);
        assert.match(plan.stdout, /kept 6 answer\(s\) from the last plan, and dropped 0/);

        // For ru, which the run translated, only what master added is left,
        // in the slice the next translator takes.
        const todo = JSON.parse(fs.readFileSync(path.join(workdir, 'remaining', 'ru', '01.json'), 'utf8'));
        assert.deepEqual(Object.keys(todo.webapp), ['app.later']);
        fs.mkdirSync(path.dirname(path.join(workdir, todo.answers)), {recursive: true});
        fs.writeFileSync(path.join(workdir, todo.answers), JSON.stringify({webapp: {'app.later': 'Попробовать позже'}}));
        const finalize = repo.run('finalize.mjs', workdir, '--no-verify');
        assert.equal(finalize.status, 0, finalize.stdout + finalize.stderr);
        repo.commit('Translate');

        const r = repo.run('check_changes.mjs', '--upstream', 'master');
        assert.equal(r.status, 0, r.stdout + r.stderr);
        assert.match(r.stdout, /checked as a translation run/);
    });
});

// A rename carries the catalog's own translation as it is, so it is not held to
// the rules for new work, any more than the key under its old name was.
describe('check_changes.mjs on a run that carries a translation breaking a rule', () => {
    let repo;
    let workdir;

    before(() => {
        repo = makeRepo();
        const english = '{count, plural, one {# channel} other {# channels}}';
        repo.write('webapp/channels/src/i18n/en.json', webappSource({'app.old_count': [english, 'Number of channels']}));
        repo.write('webapp/channels/src/i18n/ru.json', json({'app.old_count': '{count, plural, one {# канал} other {# каналов}}'}));
        repo.write('server/i18n/en.json', serverSource({}));
        const A = repo.commit('A');
        repo.write('i18n/baseline.json', json({server: {}, webapp: {ru: A}}));
        repo.commit('B');
        repo.write('webapp/channels/src/i18n/en.json', webappSource({'app.channel_count': [english, 'Number of channels']}));
        repo.commit('C');
        workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-run-'));
    });
    after(() => {
        fs.rmSync(repo.root, {recursive: true, force: true});
        fs.rmSync(workdir, {recursive: true, force: true});
    });

    test('passes the carried translation', () => {
        const base = repo.git('rev-parse', 'HEAD');
        repo.git('checkout', '-q', '-b', 'translations/master/carry');
        for (const args of [['plan_translations.mjs', workdir, '--base', base], ['finalize.mjs', workdir, '--no-verify']]) {
            const r = repo.run(...args);
            assert.equal(r.status, 0, `${args[0]}: ${r.stdout}${r.stderr}`);
        }
        assert.equal(JSON.parse(repo.read('webapp/channels/src/i18n/ru.json'))['app.channel_count'], '{count, plural, one {# канал} other {# каналов}}');
        repo.commit('Translate');

        const r = repo.run('check_changes.mjs', '--base', base);
        assert.equal(r.status, 0, r.stdout + r.stderr);
        assert.match(r.stdout, /checked as a translation run/);
    });
});
