// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import {buildOptionsAttr, createAttributeField} from './utils';

describe('global_attributes/utils', () => {
    describe('createAttributeField', () => {
        beforeEach(() => {
            jest.restoreAllMocks();
        });

        it('calls Client4.createPropertyField with the expected bare-text template shape', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

            await createAttributeField('My Attribute', 'my_attribute', 'text', []);

            expect(createPropertyField).toHaveBeenCalledWith('access_control', 'template', {
                name: 'my_attribute',
                type: 'text',
                target_type: 'system',
                target_id: '',
                attrs: {display_name: 'My Attribute'},
            });
        });

        it('trims the display name and omits it entirely when blank', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

            await createAttributeField('  Padded Name  ', 'padded_name', 'text', []);
            expect(createPropertyField).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({
                attrs: {display_name: 'Padded Name'},
            }));

            await createAttributeField('   ', 'placeholder', 'text', []);
            expect(createPropertyField).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({
                attrs: {display_name: undefined},
            }));
        });

        it('sends id-only-empty {id, name} options for select, with no rank key', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

            await createAttributeField('Department', 'department', 'select', [
                {id: 'local-1', name: 'Engineering'},
                {id: 'local-2', name: 'Sales'},
            ]);

            expect(createPropertyField).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({
                type: 'select',
                attrs: expect.objectContaining({
                    options: [
                        {id: '', name: 'Engineering'},
                        {id: '', name: 'Sales'},
                    ],
                }),
            }));
        });

        it('sends {id, name} options for multiselect, same shape as select', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

            await createAttributeField('Caveats', 'caveats', 'multiselect', [{id: 'local-1', name: 'NOFORN'}]);

            expect(createPropertyField).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({
                type: 'multiselect',
                attrs: expect.objectContaining({
                    options: [{id: '', name: 'NOFORN'}],
                }),
            }));
        });

        it('sends {id, name, rank} options for rank, with rank always explicitly present', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

            await createAttributeField('Clearance', 'clearance', 'rank', [
                {id: 'local-1', name: 'Low', rank: 1},
                {id: 'local-2', name: 'High', rank: 2},
            ]);

            expect(createPropertyField).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({
                type: 'rank',
                attrs: expect.objectContaining({
                    options: [
                        {id: '', name: 'Low', rank: 1},
                        {id: '', name: 'High', rank: 2},
                    ],
                }),
            }));
        });

        it('sends {id, name, parents} options for graph, stripping local ids and always setting parents', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

            await createAttributeField('Org chart', 'org_chart', 'graph', [
                {id: 'local-1', name: 'Root', parents: []},
                {id: 'local-2', name: 'Child', parents: ['Root']},
            ]);

            expect(createPropertyField).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({
                type: 'graph',
                attrs: expect.objectContaining({
                    options: [
                        {id: '', name: 'Root', parents: []},
                        {id: '', name: 'Child', parents: ['Root']},
                    ],
                }),
            }));

            const attrs = createPropertyField.mock.calls[0][2].attrs as {options: Array<Record<string, unknown>>};
            expect(attrs.options[0]).not.toHaveProperty('rank');
            expect(attrs.options[0]).not.toHaveProperty('color');
            expect(attrs.options[1]).not.toHaveProperty('rank');
            expect(attrs.options[1]).not.toHaveProperty('color');
            expect(JSON.stringify(attrs.options[0])).toContain('"parents":[]');
        });

        it('coalesces missing parents on a graph root to [] rather than omitting the key', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

            await createAttributeField('Org chart', 'org_chart', 'graph', [
                {id: 'local-1', name: 'Root'},
            ]);

            const attrs = createPropertyField.mock.calls[0][2].attrs as {options: Array<Record<string, unknown>>};
            expect(attrs.options).toEqual([{id: '', name: 'Root', parents: []}]);
            expect(attrs.options[0]).toHaveProperty('parents');
            expect(JSON.stringify(attrs.options[0])).toContain('"parents":[]');
            expect(JSON.stringify(attrs.options[0])).not.toEqual(expect.stringMatching(/^{"id":"","name":"Root"}$/));
        });

        it('sends no options key at all for text', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

            await createAttributeField('Cost center', 'cost_center', 'text', []);

            const attrs = createPropertyField.mock.calls[0][2].attrs as Record<string, unknown>;
            expect(attrs).not.toHaveProperty('options');
        });

        it('propagates a rejection from Client4', async () => {
            const error = new Error('boom');
            jest.spyOn(Client4, 'createPropertyField').mockRejectedValue(error);

            await expect(createAttributeField('Name', 'name', 'text', [])).rejects.toThrow('boom');
        });

        it('omits ldap/saml entirely when the links parameter is not passed', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

            await createAttributeField('My Attribute', 'my_attribute', 'text', []);

            expect(createPropertyField).toHaveBeenCalledWith('access_control', 'template', {
                name: 'my_attribute',
                type: 'text',
                target_type: 'system',
                target_id: '',
                attrs: {display_name: 'My Attribute'},
            });
        });

        it('omits ldap/saml when links is passed but both fields are empty', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

            await createAttributeField('My Attribute', 'my_attribute', 'text', [], {ldapAttr: '', samlAttr: ''});

            expect(createPropertyField).toHaveBeenCalledWith('access_control', 'template', {
                name: 'my_attribute',
                type: 'text',
                target_type: 'system',
                target_id: '',
                attrs: {display_name: 'My Attribute'},
            });
        });

        it('includes only attrs.ldap when only ldapAttr is set', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

            await createAttributeField('My Attribute', 'my_attribute', 'text', [], {ldapAttr: 'department'});

            expect(createPropertyField).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({
                attrs: {display_name: 'My Attribute', ldap: 'department'},
            }));
        });

        it('includes only attrs.saml when only samlAttr is set', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

            await createAttributeField('My Attribute', 'my_attribute', 'text', [], {samlAttr: 'department'});

            expect(createPropertyField).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({
                attrs: {display_name: 'My Attribute', saml: 'department'},
            }));
        });

        it('includes both attrs.ldap and attrs.saml when both are set', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

            await createAttributeField('My Attribute', 'my_attribute', 'text', [], {ldapAttr: 'department', samlAttr: 'dept'});

            expect(createPropertyField).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({
                attrs: {display_name: 'My Attribute', ldap: 'department', saml: 'dept'},
            }));
        });
    });

    describe('buildOptionsAttr', () => {
        // Helper contract only. Manage Attributes Save is disabled at 0 graph
        // options (Phase 3/8 / D2). Do not treat this as a Save happy path.
        it('returns [] for graph with no options', () => {
            expect(buildOptionsAttr('graph', [])).toEqual([]);
        });

        it('always sets parents, coalescing missing parents to []', () => {
            expect(buildOptionsAttr('graph', [
                {id: 'local-1', name: 'Root'},
                {id: 'local-2', name: 'Child', parents: ['Root']},
            ])).toEqual([
                {id: '', name: 'Root', parents: []},
                {id: '', name: 'Child', parents: ['Root']},
            ]);
        });
    });
});
