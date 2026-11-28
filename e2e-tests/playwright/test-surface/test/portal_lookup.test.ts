// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';

import {withSource} from './helpers.ts';

import type {scanProject} from '../src/cli.ts';
import {type ConfigFile} from '../src/config.ts';

function fixture(source: string, check: (scan: (entries?: ConfigFile['lookupPortals']) => ReturnType<typeof scanProject>) => void) {
    withSource({
        'portal-types.d.ts': [
            'declare module "react-dom" {export function createPortal(children:unknown, container:unknown):any;}',
            'declare module "@mui/material" {export function Popover(props:{children?:unknown}):any; export namespace Popover {function Header(props:{children?:unknown}):any;}}',
            'declare module "@floating-ui/react" {export function FloatingPortal(props:{children?:unknown}):any;}',
        ].join('\n'),
        'source.tsx': source,
    }, {include: ['*.tsx', '*.d.ts'], configFile: 'config.json'}, ({configPath, scan}) => {
        check((lookupPortals = []) => {
            fs.writeFileSync(configPath, JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json'}, lookupPortals}));
            return scan();
        });
    });
}

test('portal lookup resolves aliased createPortal wrappers and leaves an inline component named Modal inline', () => {
    fixture([
        'import {createPortal as relocate} from "react-dom";',
        'import * as DOM from "react-dom";',
        'function Float({children}:{children?:unknown}) {return relocate(children, document.body);}',
        'function OtherFloat({children}:{children?:unknown}) {return DOM["createPortal"](children, document.body);}',
        'function Modal({children}:{children?:unknown}) {return <aside>{children}</aside>;}',
        'export function App(){return <div data-testid="view"><Float><span data-testid="view.outside--text"/></Float><OtherFloat><span data-testid="view.other--text"/></OtherFloat><Modal><span data-testid="view.inside--text"/></Modal></div>;}',
    ].join('\n'), (scan) => {
        const out = scan();
        const parts = out.report.families[out.report.scopes.view.family].parts!;
        assert.equal(parts.outside.portal, true);
        assert.equal(parts.other.portal, true);
        assert.equal(parts.inside.portal, undefined);
        assert.ok(!out.diagnostics.some((d) => d.severity === 'error'));
    });
});

test('opaque portal exports require a reasoned contract and declaration aliases retain their identity', () => {
    fixture([
        'import {Popover as Float} from "@mui/material";',
        'function Popover({children}:{children?:unknown}) {return <span>{children}</span>;}',
        'export function App(){return <div data-testid="view"><Float><Float.Header><span data-testid="view.outside--text"/></Float.Header></Float><Popover><span data-testid="view.inside--text"/></Popover></div>;}',
    ].join('\n'), (scan) => {
        assert.ok(scan().diagnostics.some((d) => d.severity === 'error' && d.message.includes('needs a lookupPortals entry')));
        const out = scan([{from: '@mui/material', name: 'Popover', reason: 'The popover content is placed in the document portal.'}]);
        const parts = out.report.families[out.report.scopes.view.family].parts!;
        assert.equal(parts.outside.portal, true);
        assert.equal(parts.inside.portal, undefined);
        assert.ok(!out.diagnostics.some((d) => d.severity === 'error'));
        assert.ok(scan([{from: '@mui/material', name: 'Popover', reason: ''}]).diagnostics.some((d) => d.severity === 'error' && d.message.includes('specific reason')));
    });
});

test('source export contracts resolve by symbol, and unresolved portal calls fail closed', () => {
    fixture([
        'export function Host({children}:{children?:unknown}) {return children;}',
        'export default Host;',
        'const Alias = Host;',
        'export function App(){return <div data-testid="view"><Alias><span data-testid="view.outside--text"/></Alias></div>;}',
    ].join('\n'), (scan) => {
        const out = scan([{from: 'source.tsx', name: 'Host', reason: 'The host forwards children to an opaque portal implementation.'}]);
        assert.equal(out.report.families[out.report.scopes.view.family].parts!.outside.portal, true);
        assert.ok(!out.diagnostics.some((d) => d.severity === 'error'));
        const defaultExport = scan([{from: 'source.tsx', name: 'default', reason: 'The default host forwards children into a portal.'}]);
        assert.equal(defaultExport.report.families[defaultExport.report.scopes.view.family].parts!.outside.portal, true);
        assert.ok(scan([{from: 'source.tsx', name: 'Missing', reason: 'No such export.'}]).diagnostics.some((d) => d.severity === 'error' && d.message.includes('cannot resolve')));
    });
    fixture('declare function createPortal(children:unknown):any; export function App(){return createPortal(<span data-testid="view.outside--text"/>);}', (scan) => {
        assert.ok(scan().diagnostics.some((d) => d.severity === 'error' && d.message.includes('Cannot resolve createPortal')));
    });
});

test('FloatingPortal requires a contract and keeps aliased portalled parts outside their inline scope', () => {
    fixture([
        'import {FloatingPortal as Float} from "@floating-ui/react";',
        'export function App(){return <section data-testid="header"><Float><span data-testid="header.description--text"/></Float></section>;}',
    ].join('\n'), (scan) => {
        assert.ok(scan().diagnostics.some((d) => d.severity === 'error' && d.message.includes('FloatingPortal')));
        const out = scan([{from: '@floating-ui/react', name: 'FloatingPortal', reason: 'Floating UI places floating content in the document portal.'}]);
        assert.equal(out.report.families[out.report.scopes.header.family].parts!.description.portal, true);
        assert.ok(!out.diagnostics.some((d) => d.severity === 'error'));
    });
});

test('portal lookup follows immutable local call aliases and keeps local same-name functions inline', () => {
    fixture([
        'import {createPortal} from "react-dom";',
        'import * as DOM from "react-dom";',
        'const move = createPortal; const again = move; const elsewhere = DOM["createPortal"];',
        'function Float({children}:{children?:unknown}) {return again(children, document.body);}',
        'function Other({children}:{children?:unknown}) {return elsewhere(children, document.body);}',
        'function Local({children}:{children?:unknown}) {function createPortal(value:unknown){return <span>{value}</span>;} const move=createPortal; return move(children);}',
        'export function App(){return <section data-testid="view"><Float><span data-testid="view.outside--text"/></Float><Other><span data-testid="view.other--text"/></Other><Local><span data-testid="view.inside--text"/></Local></section>;}',
    ].join('\n'), (scan) => {
        const out = scan();
        const parts = out.report.families[out.report.scopes.view.family].parts!;
        assert.equal(parts.outside.portal, true);
        assert.equal(parts.other.portal, true);
        assert.equal(parts.inside.portal, undefined);
        assert.ok(!out.diagnostics.some((diagnostic) => diagnostic.rule === 'input'));
    });
});
