// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {test} from 'node:test';

import {Linter} from 'eslint';

import {computeBaseline, diffBaseline, legacyIds, serializeBaseline} from '../dist/ratchet.js';
import webappPlugin from '../lint/webapp.mjs';

test('legacyIds counts only non-grammar, non-surface-paired data-testids', () => {
    // Grammar id and a surface-paired id are not legacy; a plain id and a dynamic id are.
    assert.deepEqual(
        legacyIds(
            [
                'export const C = ({name}) => (<div>',
                '  <button data-testid="panel.save--button"/>',
                '  <button data-testid="save" data-surface="panel.save--button"/>',
                '  <button data-testid="legacy_plain_id"/>',
                '  <button data-testid={name}/>',
                // eslint-disable-next-line no-template-curly-in-string
                '  <li data-testid={`post_list.post:${id}--listitem`}/>',
                '</div>);',
            ].join('\n'),
        ),
        ['<dyn:name>', 'legacy_plain_id'],
    );
});

test('ratchet fails on growth, allows shrink, and refuses to grow the baseline without --allow-growth', () => {
    const files = {'a.tsx': 'export const A = () => <button data-testid="one"/>;'};
    const baseline = computeBaseline({roots: [], cwd: '.', files});
    assert.equal(baseline['a.tsx'].count, 1);

    // Adding a new legacy id grows the file -> diff reports it.
    const grown = computeBaseline({
        roots: [],
        cwd: '.',
        files: {'a.tsx': 'export const A = () => (<div><button data-testid="one"/><button data-testid="two"/></div>);'},
    });
    assert.equal(diffBaseline(baseline, grown).grown.length, 1);

    // Removing one is a shrink, never a failure.
    const shrunk = computeBaseline({roots: [], cwd: '.', files: {'a.tsx': 'export const A = () => <div/>;'}});
    const d = diffBaseline(baseline, shrunk);
    assert.equal(d.grown.length, 0);
    assert.equal(d.shrunk.length, 1);

    // A same-count swap (one removed, one added) is reported as changed by the hash.
    const swapped = computeBaseline({
        roots: [],
        cwd: '.',
        files: {'a.tsx': 'export const A = () => <button data-testid="three"/>;'},
    });
    assert.equal(diffBaseline(baseline, swapped).changed.length, 1);

    assert.match(serializeBaseline(baseline), /"a\.tsx": \{"count": 1/);
});

function lint(ruleName, code) {
    return new Linter().verify(code, [
        {
            languageOptions: {ecmaVersion: 2022, sourceType: 'module', parserOptions: {ecmaFeatures: {jsx: true}}},
            plugins: {'ui-surface': webappPlugin},
            rules: {[`ui-surface/${ruleName}`]: 'error'},
        },
    ]);
}

test('webapp rules flag duplicate and dynamic data-testid without a surface pairing', () => {
    assert.equal(lint('no-duplicate-testid', '<div><a data-testid="x"/><b data-testid="x"/></div>').length, 1);
    assert.equal(lint('no-duplicate-testid', '<div><a data-testid="x"/><b data-testid="y"/></div>').length, 0);
    assert.equal(lint('no-dynamic-testid', '<a data-testid={name}/>').length, 1);
    assert.equal(lint('no-dynamic-testid', '<a data-testid={name} data-surface="s.a--button"/>').length, 0);
    assert.equal(lint('no-dynamic-testid', '<a data-testid="literal"/>').length, 0);
});
