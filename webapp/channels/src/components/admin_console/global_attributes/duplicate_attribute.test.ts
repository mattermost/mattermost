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
    });
});
