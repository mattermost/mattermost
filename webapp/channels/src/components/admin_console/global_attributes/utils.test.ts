// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import {
    createAttributeField,
    createLinkedAttributeField,
    deleteAttributeField,
    deleteLinkedAttributeField,
    fetchAttributeField,
    fetchLinkedFieldsForTemplate,
    linkedFieldsByResourceType,
    updateAttributeField,
} from './utils';

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

    describe('updateAttributeField', () => {
        beforeEach(() => {
            jest.restoreAllMocks();
        });

        it('PATCHes the template and keeps option ids, sending null ldap/saml to unlink', async () => {
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue({} as PropertyField);

            await updateAttributeField('field-id', {
                name: 'renamed',
                type: 'select',
                displayName: 'Renamed',
                options: [{id: 'opt-1', name: 'Engineering'}, {id: '', name: 'Sales'}],
                ldapAttr: '',
                samlAttr: '',
            });

            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'template', 'field-id', {
                name: 'renamed',
                type: 'select',
                attrs: {
                    display_name: 'Renamed',
                    options: [{id: 'opt-1', name: 'Engineering'}, {id: '', name: 'Sales'}],
                    ldap: null,
                    saml: null,
                },
            });
        });

        it('omits name when it is not in the patch, and sends options: null for text', async () => {
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue({} as PropertyField);

            await updateAttributeField('field-id', {
                type: 'text',
                displayName: 'Cost center',
                options: [{id: 'opt-1', name: ' leftover '}],
                ldapAttr: 'department',
                samlAttr: '',
            });

            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'template', 'field-id', {
                type: 'text',
                attrs: {
                    display_name: 'Cost center',
                    options: null,
                    ldap: 'department',
                    saml: null,
                },
            });
        });
    });

    describe('fetchAttributeField', () => {
        beforeEach(() => {
            jest.restoreAllMocks();
        });

        it('returns the matching live template field and ignores deleted ones', async () => {
            const live = {id: 'field-1', delete_at: 0} as PropertyField;
            jest.spyOn(Client4, 'getPropertyFields').mockResolvedValue([
                {id: 'field-1', delete_at: 1} as PropertyField,
                live,
            ]);

            await expect(fetchAttributeField('field-1')).resolves.toBe(live);
        });

        it('returns undefined when the id is not in the page', async () => {
            jest.spyOn(Client4, 'getPropertyFields').mockResolvedValue([{id: 'other', delete_at: 0} as PropertyField]);

            await expect(fetchAttributeField('field-1')).resolves.toBeUndefined();
        });
    });

    describe('fetchLinkedFieldsForTemplate', () => {
        beforeEach(() => {
            jest.restoreAllMocks();
        });

        it('queries user, channel, and post and keeps fields pointing at the template', async () => {
            const getPropertyFields = jest.spyOn(Client4, 'getPropertyFields').mockImplementation((_group, objectType) => {
                if (objectType === 'user') {
                    return Promise.resolve([
                        {id: 'u1', object_type: 'user', linked_field_id: 'template-id', delete_at: 0} as PropertyField,
                        {id: 'u2', object_type: 'user', linked_field_id: 'other', delete_at: 0} as PropertyField,
                    ]);
                }
                if (objectType === 'channel') {
                    return Promise.resolve([
                        {id: 'c1', object_type: 'channel', linked_field_id: 'template-id', delete_at: 0} as PropertyField,
                    ]);
                }
                return Promise.resolve([]);
            });

            const fields = await fetchLinkedFieldsForTemplate('template-id');

            expect(getPropertyFields).toHaveBeenCalledWith('access_control', 'user', 'system', undefined, expect.objectContaining({perPage: 200}));
            expect(getPropertyFields).toHaveBeenCalledWith('access_control', 'channel', 'system', undefined, expect.objectContaining({perPage: 200}));
            expect(getPropertyFields).toHaveBeenCalledWith('access_control', 'post', 'system', undefined, expect.objectContaining({perPage: 200}));
            expect(fields.map((field) => field.id)).toEqual(['u1', 'c1']);
        });
    });

    describe('linkedFieldsByResourceType', () => {
        it('indexes the first live field per resource object type', () => {
            const byType = linkedFieldsByResourceType([
                {id: 'u1', object_type: 'user'} as PropertyField,
                {id: 'u2', object_type: 'user'} as PropertyField,
                {id: 'c1', object_type: 'channel'} as PropertyField,
            ]);

            expect(byType.user?.id).toBe('u1');
            expect(byType.channel?.id).toBe('c1');
            expect(byType.post).toBeUndefined();
        });
    });
});
