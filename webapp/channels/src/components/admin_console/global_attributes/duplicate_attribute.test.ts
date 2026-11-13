// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createIntl} from 'react-intl';

import type {PropertyField} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import {
    MissingLinkedFieldError,
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

const {formatMessage} = createIntl({locale: 'en', defaultLocale: 'en', messages: {}});

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
            expect(buildDuplicateDisplayName('Department', 1, formatMessage)).toBe('Copy of Department');
        });

        it('numbers later copies', () => {
            expect(buildDuplicateDisplayName('Department', 3, formatMessage)).toBe('Copy of Department (3)');
        });

        it('truncates the source label to the display-name max length', () => {
            const long = 'A'.repeat(40);
            expect(buildDuplicateDisplayName(long, 1, formatMessage)).toBe(`Copy of ${'A'.repeat(32)}`);
            expect(buildDuplicateDisplayName(long, 2, formatMessage)).toBe(`Copy of ${'A'.repeat(28)} (2)`);
        });

        it('does not split a character outside the BMP when truncating', () => {
            const label = `${'A'.repeat(31)}😀😀`;
            expect(buildDuplicateDisplayName(label, 1, formatMessage)).toBe(`Copy of ${'A'.repeat(31)}😀`);
        });

        it('uses the translated wrapper', () => {
            const intl = createIntl({
                locale: 'fr',
                defaultLocale: 'en',
                messages: {'admin.global_attributes.duplicate.display_name': 'Copie de {name}'},
            });
            expect(buildDuplicateDisplayName('Service', 1, intl.formatMessage)).toBe('Copie de Service');
        });
    });

    describe('buildDuplicateAttributeName', () => {
        it('appends _copy when free', () => {
            expect(buildDuplicateAttributeName('department', new Set())).toEqual({name: 'department_copy', copyNumber: 1});
        });

        it('increments when _copy is taken', () => {
            expect(buildDuplicateAttributeName('department', new Set(['department_copy']))).toEqual({name: 'department_copy2', copyNumber: 2});
            expect(buildDuplicateAttributeName('department', new Set(['department_copy', 'department_copy2']))).toEqual({name: 'department_copy3', copyNumber: 3});
        });

        it('compares existing names case-insensitively', () => {
            expect(buildDuplicateAttributeName('department', new Set(['DEPARTMENT_COPY'])).name).toBe('department_copy2');
        });

        it('keeps a valid name as written', () => {
            expect(buildDuplicateAttributeName('costCenter', new Set()).name).toBe('costCenter_copy');
        });

        it('slugifies a legacy name the server would now reject', () => {
            expect(buildDuplicateAttributeName('Cost Center', new Set()).name).toBe('cost_center_copy');
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
        const linkedField = (objectType: string, id: string, overrides: Partial<PropertyField> = {}) => makeField({
            id,
            object_type: objectType,
            linked_field_id: 'field-1',
            ...overrides,
        });

        function mockListings(byType: Record<string, PropertyField[]>) {
            (Client4.getPropertyFields as jest.Mock).mockImplementation((_group, objectType) => Promise.resolve(byType[objectType] ?? []));
        }

        beforeEach(() => {
            jest.restoreAllMocks();
            pageAllAccessControlFieldOptions.mockReset();
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
            }), [], ['user', 'channel', 'post'], formatMessage);

            expect(result.ok).toBe(true);
            expect(Client4.createPropertyField).toHaveBeenCalledTimes(1);
            expect(Client4.createPropertyField).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({
                name: 'department_copy',
                attrs: {display_name: 'Copy of Department'},
            }));
        });

        it('skips a name already used by a standalone resource field and numbers the display name to match', async () => {
            mockListings({
                template: [makeField()],
                user: [makeField({id: 'standalone', object_type: 'user', name: 'Department_Copy'})],
            });

            await duplicateAttribute(dispatch, makeField(), [], ['user'], formatMessage);

            expect(Client4.createPropertyField).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({
                name: 'department_copy2',
                attrs: expect.objectContaining({display_name: 'Copy of Department (2)'}),
            }));
        });

        it('ignores deleted fields when picking a name', async () => {
            mockListings({template: [makeField({id: 'gone', name: 'department_copy', delete_at: 5})]});

            await duplicateAttribute(dispatch, makeField(), [], [], formatMessage);

            expect(Client4.createPropertyField).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({
                name: 'department_copy',
            }));
        });

        it('copies rank values', async () => {
            await duplicateAttribute(dispatch, makeField({
                type: 'rank',
                attrs: {display_name: 'Clearance', options: [{id: 'a', name: 'Low', rank: 1}, {id: 'b', name: 'High', rank: 2}]},
            }), [], [], formatMessage);

            expect(Client4.createPropertyField).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({
                type: 'rank',
                attrs: expect.objectContaining({
                    options: [{id: '', name: 'Low', rank: 1}, {id: '', name: 'High', rank: 2}],
                }),
            }));
        });

        it('copies a hierarchy with parents referenced by name', async () => {
            pageAllAccessControlFieldOptions.mockResolvedValue([
                {id: 'r', name: 'Org', parents: []},
                {id: 'c', name: 'Engineering', parents: ['Org']},
            ]);

            await duplicateAttribute(dispatch, makeField({type: 'graph', attrs: {display_name: 'Org chart'}}), [], [], formatMessage);

            expect(Client4.createPropertyField).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({
                type: 'graph',
                attrs: expect.objectContaining({
                    options: [
                        {id: '', name: 'Org', parents: []},
                        {id: '', name: 'Engineering', parents: ['Org']},
                    ],
                }),
            }));
        });

        it('copies the channel configuration onto the new linked channel field', async () => {
            mockListings({
                channel: [linkedField('channel', 'source-channel', {
                    attrs: {display_name: 'Department', required: true, change_policy: 'never', editable: false},
                })],
            });
            (Client4.createPropertyField as jest.Mock).mockImplementation((_group, objectType) => Promise.resolve(makeField({
                id: `copy-${objectType}`,
                object_type: objectType,
            })));

            const result = await duplicateAttribute(dispatch, makeField(), ['channel'], ['channel'], formatMessage);

            expect(result.ok).toBe(true);
            expect(Client4.createPropertyField).toHaveBeenCalledWith('access_control', 'channel', expect.objectContaining({
                linked_field_id: 'copy-template',
                permission_values: 'admin',
                attrs: expect.objectContaining({required: true, change_policy: 'never', editable: false}),
            }));
        });

        describe('failures', () => {
            const templateCopy = () => makeField({id: 'copy-1', name: 'department_copy'});

            it('returns the error without cleanup when the template cannot be created', async () => {
                const error = new Error('create failed');
                mockListings({user: [linkedField('user', 'source-user')]});
                (Client4.createPropertyField as jest.Mock).mockRejectedValue(error);

                const result = await duplicateAttribute(dispatch, makeField(), ['user'], ['user'], formatMessage);

                expect(result).toEqual({ok: false, error, partial: false});
                expect(Client4.deletePropertyField).not.toHaveBeenCalled();
            });

            it('returns the error when options cannot be loaded, without creating anything', async () => {
                const error = new Error('options failed');
                pageAllAccessControlFieldOptions.mockRejectedValue(error);

                const result = await duplicateAttribute(dispatch, makeField({type: 'graph'}), [], [], formatMessage);

                expect(result).toEqual({ok: false, error, partial: false});
                expect(Client4.createPropertyField).not.toHaveBeenCalled();
            });

            it('returns the error when existing fields cannot be listed, without creating anything', async () => {
                const error = new Error('list failed');
                (Client4.getPropertyFields as jest.Mock).mockImplementation((_group, objectType) => (
                    objectType === 'user' ? Promise.reject(error) : Promise.resolve([])
                ));

                const result = await duplicateAttribute(dispatch, makeField(), ['user'], ['user'], formatMessage);

                expect(result).toEqual({ok: false, error, partial: false});
                expect(Client4.createPropertyField).not.toHaveBeenCalled();
            });

            it('fails without creating anything when a selected resource no longer has a source linked field', async () => {
                const result = await duplicateAttribute(dispatch, makeField(), ['user'], ['user'], formatMessage);

                expect(result.ok).toBe(false);
                expect(!result.ok && result.error).toBeInstanceOf(MissingLinkedFieldError);
                expect(Client4.createPropertyField).not.toHaveBeenCalled();
            });

            it('rolls back earlier linked fields and the template when a later linked field fails', async () => {
                const error = new Error('linked create failed');
                mockListings({user: [linkedField('user', 'source-user')], channel: [linkedField('channel', 'source-channel')]});
                (Client4.createPropertyField as jest.Mock).mockImplementation((_group, objectType) => {
                    if (objectType === 'template') {
                        return Promise.resolve(templateCopy());
                    }
                    if (objectType === 'user') {
                        return Promise.resolve(linkedField('user', 'copy-user', {linked_field_id: 'copy-1'}));
                    }
                    return Promise.reject(error);
                });

                const result = await duplicateAttribute(dispatch, makeField(), ['user', 'channel'], ['user', 'channel'], formatMessage);

                expect(result).toEqual({ok: false, error, partial: false});
                expect(Client4.deletePropertyField).toHaveBeenCalledWith('access_control', 'user', 'copy-user');
                expect(Client4.deletePropertyField).toHaveBeenCalledWith('access_control', 'template', 'copy-1');
                expect(Client4.deletePropertyField).toHaveBeenCalledTimes(2);
            });

            it('reports a partial copy and leaves the template when a linked cleanup delete fails', async () => {
                const error = new Error('linked create failed');
                mockListings({
                    user: [linkedField('user', 'source-user')],
                    channel: [linkedField('channel', 'source-channel')],
                    post: [linkedField('post', 'source-post')],
                });
                (Client4.createPropertyField as jest.Mock).mockImplementation((_group, objectType) => {
                    if (objectType === 'template') {
                        return Promise.resolve(templateCopy());
                    }
                    if (objectType === 'post') {
                        return Promise.reject(error);
                    }
                    return Promise.resolve(linkedField(objectType, `copy-${objectType}`, {linked_field_id: 'copy-1'}));
                });
                (Client4.deletePropertyField as jest.Mock).mockImplementation((_group, objectType) => (
                    objectType === 'user' ? Promise.reject(new Error('delete failed')) : Promise.resolve({status: 'OK'})
                ));

                const result = await duplicateAttribute(dispatch, makeField(), ['user', 'channel', 'post'], ['user', 'channel', 'post'], formatMessage);

                expect(result).toEqual({ok: false, error, partial: true});
                expect(Client4.deletePropertyField).toHaveBeenCalledWith('access_control', 'user', 'copy-user');
                expect(Client4.deletePropertyField).toHaveBeenCalledWith('access_control', 'channel', 'copy-channel');
                expect(Client4.deletePropertyField).not.toHaveBeenCalledWith('access_control', 'template', 'copy-1');
            });

            it('reports a partial copy when only the template cleanup fails', async () => {
                const error = new Error('linked create failed');
                mockListings({user: [linkedField('user', 'source-user')]});
                (Client4.createPropertyField as jest.Mock).mockImplementation((_group, objectType) => (
                    objectType === 'template' ? Promise.resolve(templateCopy()) : Promise.reject(error)
                ));
                (Client4.deletePropertyField as jest.Mock).mockRejectedValue(new Error('delete failed'));

                const result = await duplicateAttribute(dispatch, makeField(), ['user'], ['user'], formatMessage);

                expect(result).toEqual({ok: false, error, partial: true});
            });
        });
    });
});
