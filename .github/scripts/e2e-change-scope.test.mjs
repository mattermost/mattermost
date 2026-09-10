import assert from 'node:assert/strict';
import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {classifyChanges, readChanges, main} from './e2e-change-scope.mjs';

for (const file of [
    'webapp/channels/src/components/menu/menu.scss', 'webapp/package-lock.json', 'webapp/channels/package.json',
    'server/channels/db/migrations/postgres/000999_limit.up.sql', 'server/config/config.json', 'server/go.sum',
    'webapp/channels/src/i18n/en.json', 'webapp/channels/src/images/logo.svg', '.nvmrc', 'Makefile',
    '.github/actions/runner-prep-openldap/action.yml', '.github/scripts/e2e-change-scope.mjs',
    'e2e-tests/cypress/fixtures/example.json', 'server/build/Dockerfile', 'future-component/rules.data',
]) test(`runs E2E for ${file}`, () => assert.equal(classifyChanges([file]).should_run, true));

test('documentation exception requires every file to qualify', () => {
    assert.equal(classifyChanges(['README.md', 'docs/site/index.md', 'NOTICE.txt']).should_run, false);
    assert.equal(classifyChanges(['README.md', 'server/plugin.go']).should_run, true);
    assert.equal(classifyChanges(['server/config/README.template']).should_run, true);
    assert.equal(classifyChanges(['README.md'], {manual: true}).should_run, true);
    assert.equal(classifyChanges([]).should_run, true);
});
test('Go dependency resolution changes request both ordinary and FIPS runs', () => {
    for (const file of ['server/go.mod', 'server/go.sum', 'go.work', 'go.work.sum', 'server/build/Dockerfile.buildenv-fips']) {
        const result = classifyChanges([file]);
        assert.equal(result.should_run, true);
        assert.equal(result.should_run_fips, true);
    }
    assert.equal(classifyChanges(['README.md'], {headRef: 'fix/FIPS-build'}).should_run_fips, true);
});
test('application build actions cannot select a base-branch image as test-only changes', () => {
    assert.equal(classifyChanges(['.github/actions/build-server/action.yml']).e2e_test_only, false);
    assert.equal(classifyChanges(['e2e-tests/cypress/spec.js', '.github/workflows/e2e-tests-ci.yml']).e2e_test_only, true);
    assert.equal(classifyChanges(['e2e-tests/cypress/spec.js', 'webapp/package-lock.json']).e2e_test_only, false);
});
test('unusual filenames cannot hide runtime changes behind a documentation entry', () => {
    assert.equal(classifyChanges(['docs/file.md\nserver/plugin.go']).should_run, false); // one actual docs path
    assert.equal(classifyChanges(['docs/file.md', 'server/plugin.go\nREADME.md']).should_run, true);
});
test('complete immutable diff includes both rename sides, deletions and more than one API page', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'e2e-scope-'));
    const git = (...args) => execFileSync('git', args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
    const write = (file, value = file) => { mkdirSync(dirname(join(cwd, file)), {recursive: true}); writeFileSync(join(cwd, file), value); };
    try {
        git('init'); git('config', 'user.name', 'Scope Test'); git('config', 'user.email', 'scope@example.invalid');
        write('server/deleted.sql'); write('server/moved.sql'); git('add', '.'); git('commit', '-m', 'base'); const base = git('rev-parse', 'HEAD');
        rmSync(join(cwd, 'server/deleted.sql')); mkdirSync(join(cwd, 'docs'), {recursive: true}); renameSync(join(cwd, 'server/moved.sql'), join(cwd, 'docs/moved.md'));
        for (let i = 0; i < 110; i++) write(`docs/${i}.md`);
        write('webapp/style\nnew.scss'); git('add', '.'); git('commit', '-m', 'change'); const head = git('rev-parse', 'HEAD');
        const result = readChanges({base, head, cwd});
        assert.equal(result.files.length, 114);
        for (const file of ['server/deleted.sql', 'server/moved.sql', 'docs/moved.md', 'webapp/style\nnew.scss']) assert.ok(result.files.includes(file));
        assert.equal(classifyChanges(result.files).should_run, true);
        git('checkout', '--detach', base); // policy checkout need not be tested checkout
        assert.deepEqual(readChanges({base, head, cwd}), result);
        assert.throws(() => readChanges({base, head: 'f'.repeat(40), cwd}));
        assert.throws(() => readChanges({base: '--help', head, cwd}));
    } finally { rmSync(cwd, {recursive: true, force: true}); }
});
test('crisscross history cannot choose an arbitrary merge base and emit a docs-only skip', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'e2e-scope-crisscross-'));
    const git = (...args) => execFileSync('git', args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
    try {
        git('init'); git('config', 'user.name', 'Scope Test'); git('config', 'user.email', 'scope@example.invalid');
        writeFileSync(join(cwd, 'server_runtime.go'), 'initial'); git('add', '.'); git('commit', '-m', 'root');
        const root = git('rev-parse', 'HEAD');
        writeFileSync(join(cwd, 'server_runtime.go'), 'left'); git('add', '.'); const leftTree = git('write-tree');
        const left = git('commit-tree', leftTree, '-p', root, '-m', 'left');
        writeFileSync(join(cwd, 'server_runtime.go'), 'right'); git('add', '.'); const rightTree = git('write-tree');
        const right = git('commit-tree', rightTree, '-p', root, '-m', 'right');
        const base = git('commit-tree', leftTree, '-p', left, '-p', right, '-m', 'base merge');
        writeFileSync(join(cwd, 'README.md'), 'docs'); git('add', '.');
        const head = git('commit-tree', git('write-tree'), '-p', right, '-p', left, '-m', 'head merge');
        assert.equal(git('merge-base', '--all', base, head).split('\n').length, 2);
        assert.throws(() => readChanges({base, head, cwd}), /single merge base/);
    } finally { rmSync(cwd, {recursive: true, force: true}); }
});
test('submodule ignore settings cannot conceal a changed dependency revision', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'e2e-scope-submodule-'));
    const git = (...args) => execFileSync('git', args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
    try {
        git('init'); git('config', 'user.name', 'Scope Test'); git('config', 'user.email', 'scope@example.invalid');
        writeFileSync(join(cwd, '.gitmodules'), '[submodule "vendor"]\n path = vendor\n url = https://example.invalid/vendor\n ignore = all\n');
        git('add', '.'); const tree = git('write-tree');
        const first = git('commit-tree', tree, '-m', 'dependency one');
        const second = git('commit-tree', tree, '-p', first, '-m', 'dependency two');
        git('update-index', '--add', '--cacheinfo', `160000,${first},vendor`); git('commit', '-m', 'base'); const base = git('rev-parse', 'HEAD');
        git('update-index', '--cacheinfo', `160000,${second},vendor`); writeFileSync(join(cwd, 'README.md'), 'docs'); git('add', 'README.md'); git('commit', '-m', 'head');
        const result = readChanges({base, head: git('rev-parse', 'HEAD'), cwd});
        assert.ok(result.files.includes('vendor'));
        assert.equal(classifyChanges(result.files).should_run, true);
    } finally { rmSync(cwd, {recursive: true, force: true}); }
});
test('malformed CLI arguments cannot emit a skip', () => {
    assert.throws(() => main(['--base', 'a'.repeat(40), '--base', 'b'.repeat(40)]));
    assert.throws(() => main(['--head']));
    assert.throws(() => main(['--unknown']));
});

test('rolling-upgrade selection preserves early matches in large PR diffs under pipefail', () => {
    const workflow = readFileSync(new URL('../workflows/e2e-tests-ci.yml', import.meta.url), 'utf8');
    const block = workflow.match(/          SHOULD_RUN_ROLLING_UPGRADES="false"[\s\S]*?          echo "Should run rolling upgrades:[^\n]*\n/);
    assert.ok(block, 'The actual workflow selection step must be exercised');
    const script = 'set -euo pipefail\nCHANGED_FILES=$(cat)\n' + block[0].replace(/^ {10}/gm, '');
    const cwd = mkdtempSync(join(tmpdir(), 'e2e-rolling-scope-'));
    const rest = Array.from({length: 20000}, (_, i) => `server/ordinary/path_${i}.go`).join('\n');
    try {
        for (const [file, manual, expected] of [
            ['e2e-tests/playwright/upgrade-specs/example.spec.ts', 'false', true],
            ['.github/workflows/e2e-tests-playwright-rolling-upgrades.yml', 'false', true],
            ['server/config/migrations/example.go', 'false', true],
            ['README.md', 'false', false],
            ['README.md', 'true', true],
        ]) {
            const output = execFileSync('/bin/bash', ['-c', script], {cwd, encoding: 'utf8', input: `${file}\n${rest}\n`,
                env: {...process.env, INPUT_RUN_ROLLING_UPGRADES: manual, GITHUB_OUTPUT: join(cwd, 'outputs')}});
            assert.match(output, new RegExp(`Should run rolling upgrades: ${expected}`));
        }
    } finally { rmSync(cwd, {recursive: true, force: true}); }
});
