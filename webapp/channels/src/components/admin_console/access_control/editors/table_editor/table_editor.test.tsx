// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AccessControlVisualAST} from '@mattermost/types/access_control';

import {parseExpression} from 'components/admin_console/access_control/editors/table_editor/table_editor';

describe('parseExpression', () => {
    test('handles "==" operator mapping to "is"', () => {
        const ast: AccessControlVisualAST = {
            conditions: [
                {
                    attribute: 'user.attributes.department',
                    operator: '==',
                    value: 'Engineering',
                    value_type: 0,
                    attribute_type: 'text',
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: 'department',
                operator: 'is',
                values: ['Engineering'],
                attribute_type: 'text',
            },
        ]);
    });

    test('handles "in" operator with multiple values', () => {
        const ast: AccessControlVisualAST = {
            conditions: [
                {
                    attribute: 'user.attributes.location',
                    operator: 'in',
                    value: ['US', 'CA'],
                    value_type: 0,
                    attribute_type: 'text',
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: 'location',
                operator: 'in',
                values: ['US', 'CA'],
                attribute_type: 'text',
            },
        ]);
    });

    test('handles "!=" operator mapping to "is not"', () => {
        const ast: AccessControlVisualAST = {
            conditions: [
                {
                    attribute: 'user.attributes.role',
                    operator: '!=',
                    value: 'guest',
                    value_type: 0,
                    attribute_type: 'text',
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: 'role',
                operator: 'is not',
                values: ['guest'],
            },
        ]);
    });

    test('handles method style operators like "startsWith"', () => {
        const ast: AccessControlVisualAST = {
            conditions: [
                {
                    attribute: 'user.attributes.email',
                    operator: 'startsWith',
                    value: 'admin',
                    value_type: 0,
                    attribute_type: 'text',
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: 'email',
                operator: 'starts with',
                values: ['admin'],
                attribute_type: 'text',
            },
        ]);
    });

    test('handles multiple conditions', () => {
        const ast: AccessControlVisualAST = {
            conditions: [
                {
                    attribute: 'user.attributes.email',
                    operator: 'startsWith',
                    value: 'admin',
                    value_type: 0,
                    attribute_type: 'text',
                },
                {
                    attribute: 'user.attributes.department',
                    operator: '==',
                    value: 'Engineering',
                    value_type: 0,
                    attribute_type: 'text',
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: 'email',
                operator: 'starts with',
                values: ['admin'],
                attribute_type: 'text',
            },
            {
                attribute: 'department',
                operator: 'is',
                values: ['Engineering'],
                attribute_type: 'text',
            },
        ]);
    });

    test('throws on unknown operator', () => {
        const ast: AccessControlVisualAST = {
            conditions: [
                {
                    attribute: 'user.attributes.department',
                    operator: 'unknownOp',
                    value: 'foo',
                    value_type: 0,
                    attribute_type: 'text',
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: 'department',
                operator: 'is',
                values: ['foo'],
                attribute_type: 'text',
            },
        ]);
    });

    test('handles empty or null AST', () => {
        expect(parseExpression(null as any)).toEqual([]);
        expect(parseExpression(undefined as any)).toEqual([]);
        expect(parseExpression({conditions: []})).toEqual([]);
    });
});
