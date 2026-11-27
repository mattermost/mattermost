// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// A throwaway git repository holding only the files the pipeline reads, for
// the tests that drive its commands as a translation run would.
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scripts = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const realStyle = JSON.parse(fs.readFileSync(path.join(scripts, '../style.json'), 'utf8'));

export const json = (body) => JSON.stringify(body, null, 2) + '\n';
const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
export const webappSource = (entries) => json(Object.fromEntries(Object.entries(entries).map(([k, [defaultMessage, description]]) => [k, {defaultMessage, description}])));
export const serverSource = (entries) => json(Object.entries(entries).map(([id, [translation, description]]) => ({id, translation, description})));
const serverCatalog = (entries) => json(Object.entries(entries).map(([id, translation]) => ({id, translation})));

export function makeRepo() {
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

// Commit A is translated; B records A as every locale's baseline; C is
// ordinary development: a new key, a reworded one, two renames (one
// redescribed), and a removed key.
export function seed(repo) {
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

export const ruPayload = {
    webapp: {
        'app.archive_channel': 'Архивировать канал',
        'app.count': '{count, number} {count, plural, one {канал} few {канала} many {каналов} other {канала}}',
        'app.hello': 'У вас новая почта',
        'app.new': 'Сохранить изменения',
        'app.reword': 'Удалить сообщение',
    },
    server: {'api.retry': 'Повторите попытку позже'},
};

/**
 * The state a finished run leaves: plan, answer for ru only, finalize, and
 * commit the result on a branch, translations/test, off master.
 */
export function finishRun(repo, base, workdir) {
    const step = (script, ...args) => {
        const r = repo.run(script, ...args);
        if (r.status !== 0) {
            throw new Error(`${script}: ${r.stdout}${r.stderr}`);
        }
    };
    step('plan_translations.mjs', workdir, '--base', base);
    const file = path.join(workdir, 'translations', 'ru', 'all.json');
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, JSON.stringify(ruPayload));
    step('finalize.mjs', workdir, '--no-verify');
    repo.git('checkout', '-q', '-b', 'translations/test');
    repo.commit('Translate');
}
