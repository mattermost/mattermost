// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import {ALL_RESOURCE_TYPES} from './attribute_details/attribute_applies_to_constants';
import type {ResourceObjectType} from './attribute_details/attribute_applies_to_constants';
import {
    ATTRIBUTE_FIELD_TYPES,
    appliedResourceTypesByTemplateId,
    buildOptionsAttr,
    createAttributeField,
    createLinkedAttributeField,
    deleteAttributeField,
    deleteLinkedAttributeField,
    fetchAttributeField,
    fetchLinkedFieldsForTemplate,
    isAttributeFieldType,
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
            expect(attrs).not.toHaveProperty('value_type');
        });

        it('sends type text with attrs.value_type for phone and url', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

            await createAttributeField('Work phone', 'work_phone', 'phone', []);
            expect(createPropertyField).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({
                type: 'text',
                attrs: {display_name: 'Work phone', value_type: 'phone'},
            }));

            await createAttributeField('Homepage', 'homepage', 'url', []);
            expect(createPropertyField).toHaveBeenLastCalledWith('access_control', 'template', expect.objectContaining({
                type: 'text',
                attrs: {display_name: 'Homepage', value_type: 'url'},
            }));
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

    describe('buildOptionsAttr', () => {
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

    describe('deleteAttributeField', () => {
        beforeEach(() => {
            jest.restoreAllMocks();
        });

        it('calls Client4.deletePropertyField against the template object type', async () => {
            const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField').mockResolvedValue({status: 'OK'});

            await deleteAttributeField('template', 'field-id');

            expect(deletePropertyField).toHaveBeenCalledWith('access_control', 'template', 'field-id');
        });

        it.each((['user', 'channel', 'post'] as const))('passes %s through unchanged as the object_type path segment', async (objectType) => {
            const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField').mockResolvedValue({status: 'OK'});

            await deleteAttributeField(objectType, 'field-id');

            expect(deletePropertyField).toHaveBeenCalledWith('access_control', objectType, 'field-id');
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

        it('sends attrs.value_type on a linked phone/url field because the server does not copy it from the template', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

            await createLinkedAttributeField('user', 'work_phone', 'phone', 'Work phone', 'template-id');

            expect(createPropertyField).toHaveBeenCalledWith('access_control', 'user', expect.objectContaining({
                type: 'text',
                attrs: {display_name: 'Work phone', value_type: 'phone'},
            }));
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

            await updateAttributeField('template', 'field-id', {
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
                    value_type: null,
                },
            });
        });

        it('omits name when it is not in the patch, and sends options: null for text', async () => {
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue({} as PropertyField);

            await updateAttributeField('template', 'field-id', {
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
                    value_type: null,
                },
            });
        });

        it('keeps option ids and always sets parents on a graph PATCH', async () => {
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue({} as PropertyField);

            await updateAttributeField('template', 'field-id', {
                type: 'graph',
                displayName: 'Org chart',
                options: [
                    {id: 'opt-1', name: 'Air'},
                    {id: '', name: 'Fighter', parents: ['Air']},
                ],
                ldapAttr: '',
                samlAttr: '',
            });

            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'template', 'field-id', {
                type: 'graph',
                attrs: {
                    display_name: 'Org chart',
                    options: [
                        {id: 'opt-1', name: 'Air', parents: []},
                        {id: '', name: 'Fighter', parents: ['Air']},
                    ],
                    ldap: null,
                    saml: null,
                    value_type: null,
                },
            });
        });

        it('passes a non-template object type through as the PATCH path segment', async () => {
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue({} as PropertyField);

            await updateAttributeField('user', 'field-id', {
                type: 'text',
                displayName: 'Cost center',
                options: [],
                ldapAttr: '',
                samlAttr: '',
            });

            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'user', 'field-id', expect.anything());
        });

        it('preserves option metadata such as color when PATCHing a standalone channel select', async () => {
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue({} as PropertyField);

            await updateAttributeField('channel', 'field-id', {
                type: 'select',
                displayName: 'Marking',
                options: [
                    {id: 'opt-1', name: 'DARKBG', color: '#1e325c'},
                    {id: '', name: 'LIGHTBG', color: '#ffffff'},
                ],
                ldapAttr: '',
                samlAttr: '',
            });

            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'channel', 'field-id', {
                type: 'select',
                attrs: {
                    display_name: 'Marking',
                    options: [
                        {id: 'opt-1', name: 'DARKBG', color: '#1e325c'},
                        {id: '', name: 'LIGHTBG', color: '#ffffff'},
                    ],
                    ldap: null,
                    saml: null,
                    value_type: null,
                },
            });
        });

        it('preserves option color on a rank PATCH and still sends rank', async () => {
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue({} as PropertyField);

            await updateAttributeField('channel', 'field-id', {
                type: 'rank',
                displayName: 'Clearance',
                options: [
                    {id: 'opt-1', name: 'Low', rank: 1, color: '#007A33'},
                    {id: 'opt-2', name: 'High', rank: 2, color: '#C8102E'},
                ],
                ldapAttr: '',
                samlAttr: '',
            });

            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'channel', 'field-id', expect.objectContaining({
                type: 'rank',
                attrs: expect.objectContaining({
                    options: [
                        {id: 'opt-1', name: 'Low', rank: 1, color: '#007A33'},
                        {id: 'opt-2', name: 'High', rank: 2, color: '#C8102E'},
                    ],
                }),
            }));
        });

        it('sends attrs.value_type for phone and url, and null when switching back to plain text', async () => {
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue({} as PropertyField);

            await updateAttributeField('template', 'field-id', {
                type: 'phone',
                displayName: 'Work phone',
                options: [],
                ldapAttr: '',
                samlAttr: '',
            });

            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'template', 'field-id', {
                type: 'text',
                attrs: {
                    display_name: 'Work phone',
                    options: null,
                    ldap: null,
                    saml: null,
                    value_type: 'phone',
                },
            });

            await updateAttributeField('template', 'field-id', {
                type: 'url',
                displayName: 'Homepage',
                options: [],
                ldapAttr: '',
                samlAttr: '',
            });

            expect(patchPropertyField).toHaveBeenLastCalledWith('access_control', 'template', 'field-id', expect.objectContaining({
                type: 'text',
                attrs: expect.objectContaining({value_type: 'url'}),
            }));
        });
    });

    describe('fetchAttributeField', () => {
        beforeEach(() => {
            jest.restoreAllMocks();
        });

        it('returns the matching live template field and ignores deleted ones', async () => {
            const live = {id: 'field-1', object_type: 'template', delete_at: 0} as PropertyField;
            jest.spyOn(Client4, 'getPropertyFields').mockImplementation((_group, objectType) => {
                if (objectType === 'template') {
                    return Promise.resolve([
                        {id: 'field-1', object_type: 'template', delete_at: 1} as PropertyField,
                        live,
                    ]);
                }
                return Promise.resolve([]);
            });

            await expect(fetchAttributeField('field-1', ALL_RESOURCE_TYPES)).resolves.toBe(live);
        });

        it('returns a matching live user/channel/post field', async () => {
            const live = {id: 'field-1', object_type: 'channel', delete_at: 0} as PropertyField;
            jest.spyOn(Client4, 'getPropertyFields').mockImplementation((_group, objectType) => {
                if (objectType === 'channel') {
                    return Promise.resolve([live]);
                }
                return Promise.resolve([]);
            });

            await expect(fetchAttributeField('field-1', ALL_RESOURCE_TYPES)).resolves.toBe(live);
        });

        it('ignores a user/channel/post field that is a linked child of a template', async () => {
            jest.spyOn(Client4, 'getPropertyFields').mockImplementation((_group, objectType) => {
                if (objectType === 'channel') {
                    return Promise.resolve([{id: 'field-1', object_type: 'channel', linked_field_id: 'template-id', delete_at: 0} as PropertyField]);
                }
                return Promise.resolve([]);
            });

            await expect(fetchAttributeField('field-1', ALL_RESOURCE_TYPES)).resolves.toBeUndefined();
        });

        it('returns undefined when the id is not in any object type', async () => {
            jest.spyOn(Client4, 'getPropertyFields').mockResolvedValue([{id: 'other', delete_at: 0} as PropertyField]);

            await expect(fetchAttributeField('field-1', ALL_RESOURCE_TYPES)).resolves.toBeUndefined();
        });

        it.each([
            [['user'], ['template', 'user']],

            // Deliberately out of canonical order: the scopes are queried in
            // ALL_RESOURCE_TYPES order, not in the order they were allowed.
            [['post', 'user'], ['template', 'user', 'post']],
        ])('queries the template scope plus the allowed resource scopes %p', async (allowedTypes, expected) => {
            const getPropertyFields = jest.spyOn(Client4, 'getPropertyFields').mockResolvedValue([]);

            await fetchAttributeField('field-1', allowedTypes as ResourceObjectType[]);

            expect(getPropertyFields.mock.calls.map((call) => call[1])).toEqual(expected);
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

            const fields = await fetchLinkedFieldsForTemplate('template-id', ALL_RESOURCE_TYPES);

            expect(getPropertyFields).toHaveBeenCalledWith('access_control', 'user', expect.objectContaining({targetType: 'system', perPage: 200}));
            expect(getPropertyFields).toHaveBeenCalledWith('access_control', 'channel', expect.objectContaining({targetType: 'system', perPage: 200}));
            expect(getPropertyFields).toHaveBeenCalledWith('access_control', 'post', expect.objectContaining({targetType: 'system', perPage: 200}));
            expect(fields.map((field) => field.id)).toEqual(['u1', 'c1']);
        });

        it.each([
            [['user'], ['user']],
            [['post', 'user'], ['user', 'post']],
        ])('only queries the allowed resource scopes %p', async (allowedTypes, expected) => {
            const getPropertyFields = jest.spyOn(Client4, 'getPropertyFields').mockResolvedValue([]);

            await fetchLinkedFieldsForTemplate('template-id', allowedTypes as ResourceObjectType[]);

            expect(getPropertyFields.mock.calls.map((call) => call[1])).toEqual(expected);
        });
    });

    describe('isAttributeFieldType', () => {
        it('accepts every ATTRIBUTE_FIELD_TYPES entry including graph', () => {
            expect(ATTRIBUTE_FIELD_TYPES).toEqual(['text', 'select', 'multiselect', 'rank', 'graph']);
            for (const type of ATTRIBUTE_FIELD_TYPES) {
                expect(isAttributeFieldType(type)).toBe(true);
            }
        });

        it('rejects FieldType values that are not attribute types', () => {
            expect(isAttributeFieldType('date')).toBe(false);
            expect(isAttributeFieldType('user')).toBe(false);
            expect(isAttributeFieldType('')).toBe(false);
        });
    });

    describe('appliedResourceTypesByTemplateId', () => {
        it('groups live linked fields by template and keeps Users, Channels, Posts order', () => {
            const byTemplate = appliedResourceTypesByTemplateId([
                {id: 'p1', object_type: 'post', linked_field_id: 't1', delete_at: 0} as PropertyField,
                {id: 'u1', object_type: 'user', linked_field_id: 't1', delete_at: 0} as PropertyField,
                {id: 'c1', object_type: 'channel', linked_field_id: 't2', delete_at: 0} as PropertyField,
                {id: 'u2', object_type: 'user', linked_field_id: 't1', delete_at: 0} as PropertyField,
                {id: 'dead', object_type: 'channel', linked_field_id: 't1', delete_at: 1} as PropertyField,
            ]);

            expect(byTemplate.t1).toEqual(['user', 'post']);
            expect(byTemplate.t2).toEqual(['channel']);
        });

        it('ignores fields without a linked template or a known resource type', () => {
            expect(appliedResourceTypesByTemplateId([
                {id: 'orphan', object_type: 'user', delete_at: 0} as PropertyField,
                {id: 'other', object_type: 'template', linked_field_id: 't1', delete_at: 0} as PropertyField,
            ])).toEqual({});
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
