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
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: 'department',
                operator: 'is',
                values: ['Engineering'],
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
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: 'location',
                operator: 'in',
                values: ['US', 'CA'],
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
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: 'email',
                operator: 'starts with',
                values: ['admin'],
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
                },
                {
                    attribute: 'user.attributes.department',
                    operator: '==',
                    value: 'Engineering',
                    value_type: 0,
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: 'email',
                operator: 'starts with',
                values: ['admin'],
            },
            {
                attribute: 'department',
                operator: 'is',
                values: ['Engineering'],
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
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: 'department',
                operator: 'is',
                values: ['foo'],
            },
        ]);
    });
});
