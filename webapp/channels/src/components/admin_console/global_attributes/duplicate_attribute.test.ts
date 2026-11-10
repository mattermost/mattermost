// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import {
    buildDuplicateAttributeName,
    buildDuplicateDisplayName,
    duplicateAttribute,
    loadOptionsForDuplicate,
} from './duplicate_attribute';

jest.mock('components/property_fields/graph/page_all_access_control_field_options', () => ({
    pageAllAccessControlFieldOptions: jest.fn(),
}));

const {pageAllAccessControlFieldOptions} = jest.requireMock('components/property_fields/graph/page_all_access_control_field_options') as {
    pageAllAccessControlFieldOptions: jest.Mock;
};

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'field-1',
        name: 'department',
        type: 'text',
        group_id: 'group-1',
        object_type: 'template',
        target_id: '',
        target_type: 'system',
        create_at: 1,
        update_at: 0,
        delete_at: 0,
        created_by: '',
        updated_by: '',
        attrs: {display_name: 'Department'},
        ...overrides,
    } as PropertyField;
}

describe('duplicate_attribute helpers', () => {
    describe('buildDuplicateDisplayName', () => {
        it('prefixes Copy of', () => {
            expect(buildDuplicateDisplayName('Department')).toBe('Copy of Department');
        });

        it('truncates to the display-name max length', () => {
            const long = 'A'.repeat(40);
            expect(buildDuplicateDisplayName(long)).toHaveLength(40);
            expect(buildDuplicateDisplayName(long)).toBe(`Copy of ${'A'.repeat(32)}`);
        });
    });

    describe('buildDuplicateAttributeName', () => {
        it('appends _copy when free', () => {
            expect(buildDuplicateAttributeName('department', new Set())).toBe('department_copy');
        });

        it('increments when _copy is taken', () => {
            expect(buildDuplicateAttributeName('department', new Set(['department_copy']))).toBe('department_copy2');
            expect(buildDuplicateAttributeName('department', new Set(['department_copy', 'department_copy2']))).toBe('department_copy3');
        });

        it('compares existing names case-insensitively', () => {
            expect(buildDuplicateAttributeName('department', new Set(['DEPARTMENT_COPY']))).toBe('department_copy2');
        });
    });

    describe('loadOptionsForDuplicate', () => {
        beforeEach(() => {
            pageAllAccessControlFieldOptions.mockReset();
        });

        it('returns inline options for select fields', async () => {
            const options = await loadOptionsForDuplicate(makeField({
                type: 'select',
                attrs: {options: [{id: '1', name: 'A'}]},
            }));
            expect(options).toEqual([{id: '1', name: 'A'}]);
            expect(pageAllAccessControlFieldOptions).not.toHaveBeenCalled();
        });

        it('pages options when omitted or for graph fields', async () => {
            pageAllAccessControlFieldOptions.mockResolvedValue([{id: '1', name: 'Root', parents: []}]);

            await loadOptionsForDuplicate(makeField({type: 'graph', attrs: {options_omitted: true}}));
            expect(pageAllAccessControlFieldOptions).toHaveBeenCalledWith({id: 'field-1', object_type: 'template'});

            pageAllAccessControlFieldOptions.mockClear();
            await loadOptionsForDuplicate(makeField({
                type: 'select',
                attrs: {options_omitted: true, options_count: 3},
            }));
            expect(pageAllAccessControlFieldOptions).toHaveBeenCalled();
        });
    });

    describe('duplicateAttribute', () => {
        const dispatch = jest.fn();

        beforeEach(() => {
            jest.restoreAllMocks();
            jest.spyOn(Client4, 'getPropertyFields').mockResolvedValue([]);
            jest.spyOn(Client4, 'createPropertyField').mockResolvedValue(makeField({
                id: 'copy-1',
                name: 'department_copy',
                attrs: {display_name: 'Copy of Department'},
            }));
            jest.spyOn(Client4, 'deletePropertyField').mockResolvedValue({status: 'OK'});
        });

        it('creates a template without sync links or linked fields when none are requested', async () => {
            const result = await duplicateAttribute(dispatch, makeField({
                attrs: {display_name: 'Department', ldap: 'dept', saml: 'dept'},
            }), [], ['user', 'channel', 'post']);

            expect(result.ok).toBe(true);
            expect(Client4.createPropertyField).toHaveBeenCalledTimes(1);
            expect(Client4.createPropertyField).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({
                name: 'department_copy',
                attrs: {display_name: 'Copy of Department'},
            }));
        });

        describe('failures', () => {
            const templateCopy = () => makeField({id: 'copy-1', name: 'department_copy'});
            const linkedField = (objectType: string, id: string, overrides: Partial<PropertyField> = {}) => makeField({
                id,
                object_type: objectType,
                linked_field_id: 'field-1',
                ...overrides,
            });

            function mockLinkedSources(...types: string[]) {
                (Client4.getPropertyFields as jest.Mock).mockImplementation((_group, objectType) => {
                    if (types.includes(objectType)) {
                        return Promise.resolve([linkedField(objectType, `source-${objectType}`)]);
                    }
                    return Promise.resolve([]);
                });
            }

            it('returns the error without cleanup when the template cannot be created', async () => {
                const error = new Error('create failed');
                (Client4.createPropertyField as jest.Mock).mockRejectedValue(error);

                const result = await duplicateAttribute(dispatch, makeField(), ['user'], ['user']);

                expect(result).toEqual({ok: false, error});
                expect(Client4.deletePropertyField).not.toHaveBeenCalled();
            });

            it('returns the error when options cannot be loaded, without creating anything', async () => {
                const error = new Error('options failed');
                pageAllAccessControlFieldOptions.mockRejectedValue(error);

                const result = await duplicateAttribute(dispatch, makeField({type: 'graph'}), [], []);

                expect(result).toEqual({ok: false, error});
                expect(Client4.createPropertyField).not.toHaveBeenCalled();
            });

            it('returns the error when existing names cannot be loaded, without creating anything', async () => {
                const error = new Error('names failed');
                (Client4.getPropertyFields as jest.Mock).mockRejectedValue(error);

                const result = await duplicateAttribute(dispatch, makeField(), [], []);

                expect(result).toEqual({ok: false, error});
                expect(Client4.createPropertyField).not.toHaveBeenCalled();
            });

            it('deletes the new template when the linked source fields cannot be fetched', async () => {
                const error = new Error('fetch failed');
                (Client4.createPropertyField as jest.Mock).mockResolvedValue(templateCopy());
                (Client4.getPropertyFields as jest.Mock).mockImplementation((_group, objectType) => {
                    if (objectType === 'template') {
                        return Promise.resolve([]);
                    }
                    return Promise.reject(error);
                });

                const result = await duplicateAttribute(dispatch, makeField(), ['user'], ['user']);

                expect(result).toEqual({ok: false, error});
                expect(Client4.deletePropertyField).toHaveBeenCalledTimes(1);
                expect(Client4.deletePropertyField).toHaveBeenCalledWith('access_control', 'template', 'copy-1');
            });

            it('still reports the original error when cleanup of the template also fails', async () => {
                const error = new Error('fetch failed');
                (Client4.createPropertyField as jest.Mock).mockResolvedValue(templateCopy());
                (Client4.getPropertyFields as jest.Mock).mockImplementation((_group, objectType) => {
                    if (objectType === 'template') {
                        return Promise.resolve([]);
                    }
                    return Promise.reject(error);
                });
                (Client4.deletePropertyField as jest.Mock).mockRejectedValue(new Error('delete failed'));

                const result = await duplicateAttribute(dispatch, makeField(), ['user'], ['user']);

                expect(result).toEqual({ok: false, error});
            });

            it('rolls back earlier linked fields and the template when a later linked field fails', async () => {
                const error = new Error('linked create failed');
                mockLinkedSources('user', 'channel');
                (Client4.createPropertyField as jest.Mock).mockImplementation((_group, objectType) => {
                    if (objectType === 'template') {
                        return Promise.resolve(templateCopy());
                    }
                    if (objectType === 'user') {
                        return Promise.resolve(linkedField('user', 'copy-user', {linked_field_id: 'copy-1'}));
                    }
                    return Promise.reject(error);
                });

                const result = await duplicateAttribute(dispatch, makeField(), ['user', 'channel'], ['user', 'channel']);

                expect(result).toEqual({ok: false, error});
                expect(Client4.deletePropertyField).toHaveBeenCalledWith('access_control', 'user', 'copy-user');
                expect(Client4.deletePropertyField).toHaveBeenCalledWith('access_control', 'template', 'copy-1');
                expect(Client4.deletePropertyField).toHaveBeenCalledTimes(2);
            });

            it('keeps rolling back when one cleanup delete fails', async () => {
                const error = new Error('linked create failed');
                mockLinkedSources('user', 'channel', 'post');
                (Client4.createPropertyField as jest.Mock).mockImplementation((_group, objectType) => {
                    if (objectType === 'template') {
                        return Promise.resolve(templateCopy());
                    }
                    if (objectType === 'post') {
                        return Promise.reject(error);
                    }
                    return Promise.resolve(linkedField(objectType, `copy-${objectType}`, {linked_field_id: 'copy-1'}));
                });
                (Client4.deletePropertyField as jest.Mock).mockImplementation((_group, objectType) => {
                    if (objectType === 'user') {
                        return Promise.reject(new Error('delete failed'));
                    }
                    return Promise.resolve({status: 'OK'});
                });

                const result = await duplicateAttribute(dispatch, makeField(), ['user', 'channel', 'post'], ['user', 'channel', 'post']);

                expect(result).toEqual({ok: false, error});
                expect(Client4.deletePropertyField).toHaveBeenCalledWith('access_control', 'user', 'copy-user');
                expect(Client4.deletePropertyField).toHaveBeenCalledWith('access_control', 'channel', 'copy-channel');
                expect(Client4.deletePropertyField).toHaveBeenCalledWith('access_control', 'template', 'copy-1');
            });
        });

        it('copies the channel configuration onto the new linked channel field', async () => {
            (Client4.getPropertyFields as jest.Mock).mockImplementation((_group, objectType) => {
                if (objectType === 'channel') {
                    return Promise.resolve([makeField({
                        id: 'source-channel',
                        object_type: 'channel',
                        linked_field_id: 'field-1',
                        attrs: {display_name: 'Department', required: true, change_policy: 'never', editable: false},
                    })]);
                }
                return Promise.resolve([]);
            });
            (Client4.createPropertyField as jest.Mock).mockImplementation((_group, objectType) => Promise.resolve(makeField({
                id: `copy-${objectType}`,
                object_type: objectType,
            })));

            const result = await duplicateAttribute(dispatch, makeField(), ['channel'], ['channel']);

            expect(result.ok).toBe(true);
            expect(Client4.createPropertyField).toHaveBeenCalledWith('access_control', 'channel', expect.objectContaining({
                linked_field_id: 'copy-template',
                permission_values: 'admin',
                attrs: expect.objectContaining({required: true, change_policy: 'never', editable: false}),
            }));
        });
    });
});
