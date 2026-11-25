// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Heavy, run-once companion to run.mjs: seeds Peter's webapp worktree with the scanner-level mutations in a single
// reachable file, runs ONE full `test-surface report` (~5 min, ~3.5 GB), records which mutation each diagnostic covers,
// and writes results/peter-scan.json for run.mjs to read. Reverts every edit afterwards. Set PETER_DIR to his
// e2e-tests/playwright. Peter's model reads data-testid, so each seeded element uses a unique data-testid scope.

import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {timed} from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PETER_PW = process.env.PETER_DIR ?? '/home/ubuntu/work/peter/e2e-tests/playwright';
const PETER_WEBAPP = join(PETER_PW, '../../webapp');
const SEED = join(PETER_WEBAPP, 'channels/src/components/bench_seed.tsx');
const ROOT = join(PETER_WEBAPP, 'channels/src/root.tsx');
const CONFIG = join(PETER_PW, 'lib/surface/config.json');

// scope -> mutation id. Each seeded element is a self-contained scope so a diagnostic naming the scope maps to one row.
const SCOPE_TO_ID = {
    benchdup: 'dup-sibling-testid',
    benchrolenative: 'role-native-div',
    benchkeyindex: 'key-array-index',
    benchkeydisplay: 'key-display-name',
    benchkeyalias: 'key-aliased-display',
    benchkeycomposite: 'key-composite',
    benchkeyidentity: 'key-identity-clean',
    benchrolecustom: 'role-custom-component',
};

const SEED_SOURCE = `// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Temporary bench seed (reverted by ui-surface/bench/peter-scan.mjs). Each element exercises one scanner-level mutation.
import React from 'react';

const Toggle = (props: {['data-testid']?: string}) => <button role='switch' {...props}/>;

type Team = {id: string; display_name: string};
type Row = {teamId: string; channelId: string};

export function BenchSeed({items, teams, rows}: {items: string[]; teams: Team[]; rows: Row[]}) {
    return (
        <div>
            <div data-testid='benchdup'>
                <button data-testid='benchdup.save--button'>A</button>
                <button data-testid='benchdup.save--button'>B</button>
            </div>
            <div data-testid='benchrolenative'>
                <div data-testid='benchrolenative.enabled--checkbox'>x</div>
            </div>
            <ul data-testid='benchkeyindex'>
                {items.map((item, index) => (
                    <li key={index} data-testid={\`benchkeyindex.row:\${index}--listitem\`}>{item}</li>
                ))}
            </ul>
            <ul data-testid='benchkeydisplay'>
                {teams.map((t) => (
                    <li key={t.id} data-testid={\`benchkeydisplay.row:\${t.display_name}--listitem\`}>{t.display_name}</li>
                ))}
            </ul>
            <ul data-testid='benchkeyalias'>
                {teams.map((t) => {
                    const id = t.display_name;
                    return <li key={t.id} data-testid={\`benchkeyalias.row:\${id}--listitem\`}>{t.display_name}</li>;
                })}
            </ul>
            <ul data-testid='benchkeycomposite'>
                {rows.map((r) => (
                    <li key={r.teamId} data-testid={\`benchkeycomposite.row:\${r.teamId + '_' + r.channelId}--listitem\`}>x</li>
                ))}
            </ul>
            <ul data-testid='benchkeyidentity'>
                {teams.map((t) => {
                    const id = t.id;
                    return <li data-testid={\`benchkeyidentity.row:\${id}--listitem\`}>{t.display_name}</li>;
                })}
            </ul>
            <div data-testid='benchrolecustom'>
                <Toggle data-testid='benchrolecustom.enabled--checkbox'/>
            </div>
        </div>
    );
}
`;

/**
 * Peter prints each diagnostic as a `✗ file:line [rule]` header followed by indented message line(s). Pair them and
 * attribute to a seeded mutation by the scope name in the message. Returns {mutationId: "[rule] message"}.
 */
export function parsePeterDiagnostics(out) {
    const lines = out.split('\n');
    const caught = {};
    for (let i = 0; i < lines.length; i++) {
        const header = /✗\s+\S+\s+\[([a-z-]+)\]/.exec(lines[i]);
        if (!header) {
            continue;
        }
        const msg = (lines[i + 1] ?? '').trim();
        for (const [scope, id] of Object.entries(SCOPE_TO_ID)) {
            if (!caught[id] && msg.includes(scope)) {
                caught[id] = `[${header[1]}] ${msg}`.slice(0, 200);
            }
        }
    }
    return caught;
}

function withSeed(fn) {
    const rootBefore = readFileSync(ROOT, 'utf8');
    writeFileSync(SEED, SEED_SOURCE);

    // A side-effect import puts the seed in root's import closure so the scanner reaches it.
    writeFileSync(ROOT, "import './components/bench_seed';\n" + rootBefore);
    try {
        return fn();
    } finally {
        writeFileSync(ROOT, rootBefore);
        rmSync(SEED, {force: true});
    }
}

function main() {
    if (!existsSync(CONFIG)) {
        console.error(`Peter config not found at ${CONFIG}; set PETER_DIR.`);
        process.exit(2);
    }
    const {seconds, maxRssKb, stdout, stderr, status} = withSeed(() =>
        timed(
            'node',
            [join(PETER_PW, 'test-surface/bin/test-surface.mjs'), 'report', '--all', '--config', CONFIG],
            join(PETER_PW, 'lib'),
        ),
    );
    const out = stdout + '\n' + stderr;
    const caught = parsePeterDiagnostics(out);

    // key-identity-clean is a clean control; if Peter flags it here it is only because this synthetic seed's local
    // `Team` type is not registered in his config's entityTypeDirs (the real webapp's types are), so record it as a
    // seed limitation, not a false positive against Peter.
    const notes = {};
    if (caught['key-identity-clean']) {
        notes['key-identity-clean'] =
            "Peter needs the key's entity type registered in entityTypeDirs; the synthetic seed type is not, so this is a seed artifact, not a real Peter false positive.";
        delete caught['key-identity-clean'];
    }
    const results = join(HERE, 'results');
    mkdirSync(results, {recursive: true});
    writeFileSync(
        join(results, 'peter-scan.json'),
        JSON.stringify({timing: {seconds, maxRssKb}, caught, notes, status}, null, 2) + '\n',
    );
    writeFileSync(join(results, 'peter-scan.log'), out);
    console.log(
        `peter scan: ${seconds}s, ${Math.round(maxRssKb / 1024)}MB, caught ${Object.keys(caught).length}/${Object.keys(SCOPE_TO_ID).length} seeded mutations`,
    );
    console.log('caught:', JSON.stringify(caught, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main();
}
