// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {FIXTURES, installFixtureCompiler} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig, type KeyFieldAllow} from '../src/config.ts';

test('qualified prop identities stop at their declaration and do not match another module Props', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-qualified-key-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['*.tsx', path.join(FIXTURES, '_lib')]}));
        // eslint-disable-next-line no-template-curly-in-string -- fixture source
        fs.writeFileSync(path.join(root, 'emoji.tsx'), 'type Props={name:string; unused?:string}; export function Emoji({name}:Props){return <span data-testid={`markdown.emoji:${name}--text`}/>;}');
        // eslint-disable-next-line no-template-curly-in-string -- fixture source
        fs.writeFileSync(path.join(root, 'other.tsx'), 'type Props={name:string}; export function Other({name}:Props){return <span data-testid={`other.emoji:${name}--text`}/>;}');
        fs.writeFileSync(path.join(root, 'source.tsx'), 'import {Emoji} from "./emoji"; import {Other} from "./other"; declare const node:any; export function App(){return <><Emoji name={node.attribs["data-emoticon"]}/><Other name={node.attribs["data-emoticon"]}/></>;}');
        const entry: KeyFieldAllow = {entity: 'Props', module: './emoji', field: 'name', value: 'emoji', reason: 'Markdown emoji names are canonical identifiers read from parsed HTML.'};
        const scan = (entries: KeyFieldAllow[]) => {
            const config = path.join(root, 'config.json');
            fs.writeFileSync(config, JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json'}, checks: {keyFields: {allow: entries}}}));
            return scanProject(loadConfig(config));
        };
        const out = scan([entry]);
        assert.deepEqual(out.manifest.elements.find((e) => e.template === 'markdown.emoji:{key}--text')?.key, {kind: 'id', value: 'emoji', type: 'string'});
        assert.ok(!out.diagnostics.some((d) => d.severity === 'error' && (d.template === 'markdown.emoji:{key}--text' || d.rule === 'allow')));
        assert.ok(out.diagnostics.some((d) => d.rule === 'key-origin' && d.template === 'other.emoji:{key}--text'));
        assert.ok(scan([{...entry, module: undefined}]).diagnostics.some((d) => d.severity === 'error' && d.message.includes('needs module')));
        assert.ok(scan([{...entry, module: './missing'}]).diagnostics.some((d) => d.severity === 'error' && d.message.includes('Cannot resolve')));
        assert.ok(scan([{...entry, field: 'missing'}]).diagnostics.some((d) => d.severity === 'error' && d.message.includes('Cannot resolve')));
        assert.ok(scan([{...entry, field: 'unused'}]).diagnostics.some((d) => d.severity === 'error' && d.message.includes('no longer matches any key')));
        // eslint-disable-next-line no-template-curly-in-string -- fixture source
        fs.writeFileSync(path.join(root, 'emoji.tsx'), 'type Props={name?:string}; export function Emoji({name}:Props){return <span data-testid={`markdown.emoji:${name}--text`}/>;}');
        assert.ok(scan([entry]).diagnostics.some((d) => d.rule === 'undefined' && d.template === 'markdown.emoji:{key}--text'));
        // eslint-disable-next-line no-template-curly-in-string -- fixture source
        fs.writeFileSync(path.join(root, 'emoji.tsx'), 'type Props={name?:string}; export function Emoji({name}:Props){return <span data-testid={name ? `markdown.emoji:${name}--text` : undefined}/>;}');
        assert.ok(!scan([entry]).diagnostics.some((d) => d.rule === 'undefined' && d.template?.startsWith('markdown.emoji')));
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
