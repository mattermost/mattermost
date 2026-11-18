// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-template-curly-in-string -- cases quote template-literal syntax */

import assert from 'node:assert/strict';
import {test} from 'node:test';

import {countActionDisables, parseDisable} from './disables.js';

test('a directive is read as its rules and its reason', () => {
    assert.deepEqual(parseDisable(' eslint-disable-next-line test-surface/e2e-observe-actions -- the menu closes itself'), {rules: ['test-surface/e2e-observe-actions'], reason: 'the menu closes itself'});
    assert.deepEqual(parseDisable(' eslint-disable no-console, test-surface/e2e-no-floating-actions '), {rules: ['no-console', 'test-surface/e2e-no-floating-actions'], reason: ''});
    assert.deepEqual(parseDisable(' eslint-disable-line'), {rules: [], reason: ''});
    assert.equal(parseDisable(' a comment about eslint-disable'), null);
    assert.equal(parseDisable(' eslint-disabled'), null);
});

test('each action rule named in each directive counts once', () => {
    const source = [
        '// eslint-disable-next-line test-surface/e2e-observe-actions -- a',
        'await a.click();',
        '/* eslint-disable test-surface/e2e-observe-actions, test-surface/e2e-no-floating-actions -- b */',
        'f(); // eslint-disable-line test-surface/e2e-no-floating-actions -- c',
        '// eslint-disable-next-line no-console -- not ours',
        'console.log(1);',
        '// eslint-disable-next-line',
        'g();',
        '// eslint-enable test-surface/e2e-observe-actions',
    ].join('\n');
    assert.equal(countActionDisables(source), 4);
});

test('strings, templates and regular expressions are not comments', () => {
    const source = [
        "const a = '// eslint-disable-next-line test-surface/e2e-observe-actions -- x';",
        'const b = `/* eslint-disable test-surface/e2e-observe-actions -- ${a} */`;',
        'const c = /\\/\\/ eslint-disable test-surface\\/e2e-observe-actions/;',
        'const d = `${a /* eslint-disable-line test-surface/e2e-no-floating-actions -- inside a template expression */}`;',
    ].join('\n');
    assert.equal(countActionDisables(source), 1);
});

test('a comment at the end of the file counts', () => {
    assert.equal(countActionDisables('f();\n// eslint-disable-next-line test-surface/e2e-observe-actions -- last\n'), 1);
    assert.equal(countActionDisables(''), 0);
});
