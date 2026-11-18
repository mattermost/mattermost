// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {test} from 'node:test';

import {formatTestId, isGrammarError, parseTestId, toWord} from '../src/grammar.ts';

test('grammar: parses scope, name, key and role', () => {
    assert.deepEqual(parseTestId('lhs.channel_list.channel:{key}--link'), {scope: ['lhs', 'channel_list'], name: 'channel', hasKey: true, key: null, role: 'link'});
    assert.deepEqual(parseTestId('channel_settings_modal.tabs.tab:info--tab'), {scope: ['channel_settings_modal', 'tabs'], name: 'tab', hasKey: true, key: 'info', role: 'tab'});
    assert.deepEqual(parseTestId('channel_header.menu'), {scope: ['channel_header'], name: 'menu', hasKey: false, key: null, role: null});
});

test('grammar: rejects what the rules forbid, with a fix', () => {
    const cases: Array<[string, string]> = [
        ['SendMessageButton', 'grammar'],
        ['post_textbox--textbox', 'unscoped'],
        ['a.b--input', 'grammar'],
        ['a.{key}--text', 'grammar'],
        ['a.b--c--button', 'grammar'],
        ['a.b:--text', 'grammar'],
    ];
    for (const [id, rule] of cases) {
        const p = parseTestId(id);
        assert.ok(isGrammarError(p), id);
        assert.equal(p.rule, rule, id);
        assert.ok(p.fix.length > 0);
    }
});

test('grammar: round trip and helpers', () => {
    const p = parseTestId('a.b.c:{key}--button');
    assert.ok(!isGrammarError(p));
    assert.equal(formatTestId(p), 'a.b.c:{key}--button');
    assert.equal(toWord('SendMessageButton'), 'send_message_button');
    assert.equal(toWord('post-priority-label'), 'post_priority_label');
});

test('grammar: raw keys include punctuation, unknown suffixes and line breaks', () => {
    for (const [id, key, role] of [
        ['x.item:com.mattermost.calls--menuitem', 'com.mattermost.calls', 'menuitem'],
        ['admin.setting:ServiceSettings.SiteURL', 'ServiceSettings.SiteURL', null],
        ['x.item:a:b--c--option', 'a:b--c', 'option'],
        ['x.item:a--nonsense', 'a--nonsense', null],
        ['x.item:line\nnext--text', 'line\nnext', 'text'],
    ]) {
        const parsed = parseTestId(id!);
        assert.ok(!isGrammarError(parsed), id!);
        assert.equal(parsed.key, key);
        assert.equal(parsed.role, role);
    }
});
