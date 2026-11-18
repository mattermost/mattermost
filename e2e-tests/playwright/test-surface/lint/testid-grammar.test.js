// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-template-curly-in-string -- source fixture strings contain template literals */

import parser from '@typescript-eslint/parser';
import {RuleTester} from 'eslint';

import grammar from './testid-grammar.js';
import unscoped from './testid-no-unscoped-data.js';

const tester = new RuleTester({languageOptions: {parser, parserOptions: {ecmaFeatures: {jsx: true}}}});

tester.run('testid-grammar', grammar, {
    valid: [
        '<button data-testid="header.save--button"/>',
        '<div data-testid="panel"/>',
        '<span data-testid="x.item:a:b--c--text"/>',
        '<span data-testid="x.item:a--nonsense"/>',
        '<button data-testid={`menu.plugin:${pluginId}--button`}/>',
        '<div data-testid={`admin.setting:${path}`}/>',
        '<div data-testid={testId ? `${testId}.close--button` : undefined}/>',
        '<div data-testid={testId ? `${testId}--dialog` : undefined}/>',
        '<div data-testid={testId ? `${testId}:${id}--listitem` : undefined}/>',
        '<Widget testId="settings.modal"/>',
        'const id = "header.save--button"; <button data-testid={id}/>;',
        '<span data-testid={flag ? "x.first--text" : "x.second--text"}/>',
    ],
    invalid: [
        {code: '<button data-testid="BadName"/>', errors: [{message: /lower_snake_case/}]},
        {code: '<button data-testid="x.save--buton"/>', errors: [{message: /unknown role/}]},
        {code: '<button data-testid="x.item:--button"/>', errors: [{message: /empty key/}]},
        {code: '<span data-testid={`x.item:${parent}-${child}--text`}/>', errors: [{message: /exactly one interpolation/}]},
        {code: '<span data-testid={`x.item:${id}.label--text`}/>', errors: [{message: /exactly one interpolation/}]},
        {code: '<Widget testId={`x.row:${id}`}/>', errors: [{message: /path only/}]},
        {code: '<Widget testId="x.modal--dialog"/>', errors: [{message: /path only/}]},
        {code: '<div data-testid={testId && `${testId}.close--button`}/>', errors: [{message: /conditional expression/}]},
        {code: '<button data-testid={buildId()}/>', errors: [{message: /string literals or template literals/}]},
        {code: '<span data-testid={flag ? "x.ok--text" : "BadName"}/>', errors: [{message: /lower_snake_case/}]},
    ],
});

tester.run('testid-no-unscoped-data', unscoped, {
    valid: [
        '<span data-testid="header.name--text"/>',
        '<div data-testid={testId}/>',
        '<div data-testid={props.testId}/>',
        '<span data-testid={`header.item:${id}--text`}/>',
    ],
    invalid: [
        {code: '<span data-testid={props.id}/>', errors: [{message: /entirely of runtime data/}]},
        {code: '<span data-testid={buildId()}/>', errors: [{message: /entirely of runtime data/}]},
    ],
});
