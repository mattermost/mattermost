// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {buildCELSchemas} from './editor';

jest.mock('monaco-editor', () => ({
    editor: {
        create: jest.fn(),
        addKeybindingRule: jest.fn(),
    },
    KeyMod: {CtrlCmd: 0},
    KeyCode: {KeyF: 0},
}));

describe('buildCELSchemas', () => {
    test('offers only user.attributes when no session attributes are present', () => {
        const schemas = buildCELSchemas([
            {attribute: 'department', values: [], objectType: 'user'},
            {attribute: 'location', values: [], objectType: 'user'},
        ]);

        expect(schemas.user).toEqual(['attributes']);
        expect(schemas['user.attributes']).toEqual(['department', 'location']);
        expect(schemas['user.session']).toBeUndefined();
    });

    test('adds the user.session bucket when a session attribute is present', () => {
        const schemas = buildCELSchemas([
            {attribute: 'department', values: [], objectType: 'user'},
            {attribute: 'ip_address', values: [], objectType: 'session'},
        ]);

        expect(schemas.user).toEqual(['attributes', 'session']);
        expect(schemas['user.attributes']).toEqual(['department']);
        expect(schemas['user.session']).toEqual(['ip_address']);
    });

    test('drops names with spaces or that are empty', () => {
        const schemas = buildCELSchemas([
            {attribute: 'has space', values: [], objectType: 'user'},
            {attribute: '   ', values: [], objectType: 'user'},
            {attribute: 'valid', values: [], objectType: 'user'},
            {attribute: 'session valid', values: [], objectType: 'session'},
            {attribute: 'ip_address', values: [], objectType: 'session'},
        ]);

        expect(schemas['user.attributes']).toEqual(['valid']);
        expect(schemas['user.session']).toEqual(['ip_address']);
    });
});
