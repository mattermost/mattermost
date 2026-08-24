// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import {createAttributeField, createLinkedAttributeField, deleteAttributeField, deleteLinkedAttributeField} from './utils';

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

        it('trims the display name and omits it when blank, same as createAttributeField', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

            await createLinkedAttributeField('user', 'my_attribute', 'text', '  My Attribute  ', 'template-id');
            expect(createPropertyField).toHaveBeenCalledWith('access_control', 'user', expect.objectContaining({
                attrs: {display_name: 'My Attribute'},
            }));

            await createLinkedAttributeField('user', 'my_attribute', 'text', '   ', 'template-id');
            expect(createPropertyField).toHaveBeenCalledWith('access_control', 'user', expect.objectContaining({
                attrs: {display_name: undefined},
            }));
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

    describe('deleteAttributeField', () => {
        beforeEach(() => {
            jest.restoreAllMocks();
        });

        it('calls Client4.deletePropertyField against the template object type', async () => {
            const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField').mockResolvedValue({status: 'OK'});

            await deleteAttributeField('field-id');

            expect(deletePropertyField).toHaveBeenCalledWith('access_control', 'template', 'field-id');
        });
    });

    describe('createLinkedAttributeField', () => {
        beforeEach(() => {
            jest.restoreAllMocks();
        });

        it('calls Client4.createPropertyField against the given resource object type with linked_field_id set', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

            await createLinkedAttributeField('channel', 'my_attribute', 'text', 'My Attribute', 'template-id');

            expect(createPropertyField).toHaveBeenCalledWith('access_control', 'channel', {
                name: 'my_attribute',
                type: 'text',
                target_type: 'system',
                target_id: '',
                linked_field_id: 'template-id',
                attrs: {display_name: 'My Attribute'},
            });
        });

        it.each((['user', 'channel', 'post'] as const))('sends %s as the object_type path segment', async (objectType) => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

            await createLinkedAttributeField(objectType, 'my_attribute', 'text', 'My Attribute', 'template-id');

            expect(createPropertyField).toHaveBeenCalledWith('access_control', objectType, expect.anything());
        });

        it('propagates a rejection from Client4', async () => {
            jest.spyOn(Client4, 'createPropertyField').mockRejectedValue(new Error('boom'));

            await expect(createLinkedAttributeField('user', 'name', 'text', 'Name', 'template-id')).rejects.toThrow('boom');
        });
    });

    describe('deleteLinkedAttributeField', () => {
        beforeEach(() => {
            jest.restoreAllMocks();
        });

        it('calls Client4.deletePropertyField against the given resource object type', async () => {
            const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField').mockResolvedValue({status: 'OK'});

            await deleteLinkedAttributeField('post', 'field-id');

            expect(deletePropertyField).toHaveBeenCalledWith('access_control', 'post', 'field-id');
        });
    });
});
