// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {test} from 'node:test';

import {checkStaleRefs, extractSurface, indexSourceIds, parseTestId} from '../dist/scan.js';

test('parseTestId validates scope.name[:key][--role] grammar', () => {
    assert.deepEqual(parseTestId('channel_settings.save--button'), {
        raw: 'channel_settings.save--button',
        scope: 'channel_settings',
        name: 'save',
        key: undefined,
        role: 'button',
        valid: true,
    });
    assert.equal(parseTestId('post_list.post:abc123--listitem').key, 'abc123');
    assert.equal(parseTestId('unscoped').valid, false);
    assert.equal(parseTestId('channel.save--bogus').valid, false);
});

test('extractSurface extracts literal, keyed, and data-surface scopes while catching duplicates and role mismatches', () => {
    const report = extractSurface({
        roots: [],
        files: {
            'panel.tsx': [
                'const Panel = ({id, editing}: {id: string; editing: boolean}) => (',
                '  <div data-surface="channel_settings">',
                '    <button data-testid="channel_settings.save--button">Save</button>',
                '    <span data-testid="channel_settings.bad--checkbox">Not a checkbox</span>',
                '    <input type="checkbox" data-testid="channel_settings.ok--checkbox" />',
                // eslint-disable-next-line no-template-curly-in-string
                '    <li data-testid={`channel_settings.row:${id}--listitem`} />',
                '    {editing ? <p data-testid="channel_settings.dup--text" /> : <p data-testid="channel_settings.dup--text" />}',
                '    <p data-testid="channel_settings.sib--text" />',
                '    <p data-testid="channel_settings.sib--text" />',
                '  </div>',
                ');',
            ].join('\n'),
        },
    });

    assert.equal(report.entries.length, 8);
    assert.deepEqual(report.scopes.channel_settings.containerFiles, ['panel.tsx']);
    assert.deepEqual(
        report.diagnostics.map((d) => ({rule: d.rule, id: d.id})),
        [
            {rule: 'role-fit', id: 'channel_settings.bad--checkbox'},
            {rule: 'duplicates', id: 'channel_settings.sib--text'},
        ],
    );
});

test('checkStaleRefs detects stale Playwright and Cypress literals and ignores comments', () => {
    const report = extractSurface({
        roots: [],
        files: {'panel.tsx': 'export const P = () => <button data-testid="settings.save--button" />;'},
    });
    const knownIds = new Set(report.entries.map((e) => e.id));
    const diags = checkStaleRefs({
        knownIds,
        files: {
            'good.spec.ts':
                '// page.getByTestId("settings.missing--button")\npage.getByTestId("settings.save--button").click();',
            'bad.spec.ts':
                'page.getByTestId("settings.old--button").click();\ncy.findByTestId("settings.gone--button").click();\ncy.get(\'[data-testid="settings.css_gone--button"]\');',
        },
    });
    assert.deepEqual(
        diags.map((d) => d.id),
        ['settings.old--button', 'settings.gone--button', 'settings.css_gone--button'],
    );
});

test('checkStaleRefs flags legacy ids missing from webapp source and resolves props, keys, HTML and patterns', () => {
    const webapp = {
        'stat.tsx': 'export const S = ({id}) => <div data-testid={id ? id + "Chart" : undefined}/>;',
        'use.tsx': 'export const U = () => <Stat id="totalPosts"/>;',
        // eslint-disable-next-line no-template-curly-in-string
        'text.tsx': 'export const T = (p) => <input data-testid={`${p.id}input`}/>;',
        'defs.tsx': 'export const defs = {system_attributes: {}};',
        // eslint-disable-next-line no-template-curly-in-string
        'html.tsx': 'export const h = (w) => `<span data-testid="search-highlight">${w}</span>`;',
        // eslint-disable-next-line no-template-curly-in-string
        'opaque.tsx': 'export const O = (p) => <input data-testid={`${p.id}${p.type}`}/>;',
    };
    const sourceIds = indexSourceIds({roots: [], files: webapp});
    const diags = checkStaleRefs({
        knownIds: new Set(),
        sourceIds,
        allow: new Set(['fieldemail']),
        files: {
            'a.spec.ts': [
                'page.getByTestId("totalPosts");',
                'page.getByTestId("totalPostsChart");',
                'page.getByTestId("nameinput");',
                'page.getByTestId("system_attributes");',
                'page.getByTestId("search-highlight");',
                'page.getByTestId("fieldemail");',
                'page.getByTestId("renamedLegacyId");',
                'page.getByTestId("ab");',
            ].join('\n'),
        },
    });
    assert.deepEqual(
        diags.map((d) => `${d.line}:${d.id}`),
        ['7:renamedLegacyId', '8:ab'],
    );
    assert.match(diags[0].message, /does not appear anywhere in webapp source/);
});

test('checkStaleRefs skips legacy ids when no source index is given', () => {
    const diags = checkStaleRefs({knownIds: new Set(), files: {'a.spec.ts': 'page.getByTestId("anything");'}});
    assert.deepEqual(diags, []);
});

test('extractSurface supports dual data-surface coexistence alongside legacy data-testid', () => {
    const report = extractSurface({
        roots: [],
        files: {
            'save_panel.tsx': [
                'export const Panel = () => (',
                '  <div data-surface="save_panel">',
                '    <button data-testid="SaveChangesPanel__save-btn" data-surface="save_panel.save--button">Save</button>',
                '  </div>',
                ');',
            ].join('\n'),
        },
    });
    assert.equal(report.diagnostics.length, 0);
    assert.deepEqual(report.scopes.save_panel.containerFiles, ['save_panel.tsx']);
    assert.equal(report.entries.length, 1);
    assert.equal(report.entries[0].id, 'save_panel.save--button');
    assert.equal(report.entries[0].attr, 'data-surface');
});

test('extractSurface rejects unresolvable data-surface values, display-text keys, and cross-file duplicates', () => {
    const report = extractSurface({
        roots: [],
        files: {
            'a.tsx': [
                'export const A = ({post, name, kind}: {post: {id: string; message: string}; name: string; kind: string}) => (<>',
                // eslint-disable-next-line no-template-curly-in-string
                '  <li data-surface={`feed.post:${post.id}--listitem`} />',
                // eslint-disable-next-line no-template-curly-in-string
                '  <li data-surface={`feed.label:${post.message}--listitem`} />',
                // eslint-disable-next-line no-template-curly-in-string
                '  <button data-surface={`feed.edit:${this.props.section}--button`} />',
                '  <div data-surface={kind} />',
                '  <div data-testid={kind} />',
                '  <button data-surface="feed.shared--button" />',
                '</>);',
            ].join('\n'),
            'b.tsx': 'export const B = () => <button data-surface="feed.shared--button" />;',
        },
    });
    assert.deepEqual(
        report.diagnostics.map((d) => ({rule: d.rule, file: d.file, id: d.id})),
        [
            {rule: 'key-origin', file: 'a.tsx', id: 'feed.label:--listitem'},
            {rule: 'dynamic', file: 'a.tsx', id: 'kind'},
            {rule: 'duplicates', file: 'a.tsx', id: 'feed.shared--button'},
        ],
    );
});
