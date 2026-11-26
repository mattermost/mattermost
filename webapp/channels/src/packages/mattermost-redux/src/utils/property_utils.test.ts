// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';

import {
    canMoveToOption,
    formatPropertyFieldLabel,
    getOptionRank,
    getRestrictionsWithChannelAdminValueWrite,
    getPropertyFieldChangePolicy,
    getPropertyFieldLabel,
    getPropertyFieldOptions,
    getPropertyFieldSyncSources,
    isChannelFieldFillableByCreators,
    isChannelFieldLevelOnlyUnfillable,
    isPropertyFieldEditable,
    isPropertyFieldRequired,
    isPropertyFieldSourceManaged,
    isPropertyFieldSynced,
    isPropertyFieldSyncedForAuthService,
    isPropertyValueSet,
    isPSAv1PropertyField,
    sortOptionsByRank,
} from './property_utils';

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'field-1',
        group_id: 'group-1',
        name: 'test',
        type: 'text',
        target_id: '',
        target_type: '',
        object_type: '',
        create_at: 1000,
        update_at: 1000,
        delete_at: 0,
        created_by: 'user-1',
        updated_by: 'user-1',
        ...overrides,
    };
}

describe('isPSAv1PropertyField', () => {
    test('returns true when object_type is undefined', () => {
        const field = makeField({object_type: undefined});
        expect(isPSAv1PropertyField(field)).toBe(true);
    });

    test('returns true when object_type is empty string', () => {
        const field = makeField({object_type: ''});
        expect(isPSAv1PropertyField(field)).toBe(true);
    });

    test('returns true when object_type is null (from JSON deserialization)', () => {
        const field = makeField({object_type: null as unknown as string});
        expect(isPSAv1PropertyField(field)).toBe(true);
    });

    test('returns false when object_type is a non-empty string', () => {
        const field = makeField({object_type: 'post'});
        expect(isPSAv1PropertyField(field)).toBe(false);
    });
});

describe('isPropertyFieldRequired', () => {
    test('returns true only for an explicit true', () => {
        expect(isPropertyFieldRequired(makeField({attrs: {required: true}}))).toBe(true);
    });

    test('returns false when absent, false, or a non-boolean', () => {
        expect(isPropertyFieldRequired(makeField())).toBe(false);
        expect(isPropertyFieldRequired(makeField({attrs: {}}))).toBe(false);
        expect(isPropertyFieldRequired(makeField({attrs: {required: false}}))).toBe(false);
        expect(isPropertyFieldRequired(makeField({attrs: {required: 'true'}}))).toBe(false);
    });
});

describe('isPropertyFieldEditable', () => {
    test('returns true when absent, so fields predating the key are not read as locked', () => {
        expect(isPropertyFieldEditable(makeField())).toBe(true);
        expect(isPropertyFieldEditable(makeField({attrs: {}}))).toBe(true);
    });

    test('returns false only for an explicit false', () => {
        expect(isPropertyFieldEditable(makeField({attrs: {editable: false}}))).toBe(false);
        expect(isPropertyFieldEditable(makeField({attrs: {editable: true}}))).toBe(true);
    });

    test('ignores a non-boolean rather than locking the field', () => {
        expect(isPropertyFieldEditable(makeField({attrs: {editable: 'false'}}))).toBe(true);
    });
});

describe('isPropertyFieldSourceManaged', () => {
    test('reads a protected plugin field as source-managed', () => {
        expect(isPropertyFieldSourceManaged(makeField({
            attrs: {protected: true, source_plugin_id: 'com.example.markings'},
        }))).toBe(true);
    });

    // The server refuses the write either way: a protected field with no source
    // plugin has no caller that could satisfy it at all.
    test('reads a protected field with no source plugin as source-managed', () => {
        expect(isPropertyFieldSourceManaged(makeField({attrs: {protected: true}}))).toBe(true);
    });

    test('reads an owner-managed field as source-managed', () => {
        expect(isPropertyFieldSourceManaged(makeField({
            attrs: {owners: [{id: 'com.example.scim', type: 'plugin', scopes: []}]},
        }))).toBe(true);
    });

    // checkOwnerValueWriteAccess rejects a human caller before it reads the owner
    // type, so a service or role owner locks the values just as a plugin does.
    test('reads an owner of any type as source-managed', () => {
        for (const type of ['service', 'role', 'user']) {
            expect(isPropertyFieldSourceManaged(makeField({
                attrs: {owners: [{id: 'ldap', type, scopes: []}]},
            }))).toBe(true);
        }
    });

    test('reads a synced field as source-managed', () => {
        expect(isPropertyFieldSourceManaged(makeField({attrs: {ldap: 'department'}}))).toBe(true);
        expect(isPropertyFieldSourceManaged(makeField({attrs: {saml: 'Department'}}))).toBe(true);
        expect(isPropertyFieldSourceManaged(makeField({attrs: {openid: 'address.country'}}))).toBe(true);
    });

    test('leaves an ordinary admin-authored field alone', () => {
        expect(isPropertyFieldSourceManaged(makeField())).toBe(false);
        expect(isPropertyFieldSourceManaged(makeField({attrs: {}}))).toBe(false);
        expect(isPropertyFieldSourceManaged(makeField({attrs: {required: true}}))).toBe(false);
    });

    // A plugin may create a field it does not reserve; only protected locks the
    // values, so source_plugin_id on its own must stay editable.
    test('leaves a plugin-created field that is not protected alone', () => {
        expect(isPropertyFieldSourceManaged(makeField({
            attrs: {source_plugin_id: 'com.example.markings'},
        }))).toBe(false);
    });

    test('does not read an off or empty flag as source-managed', () => {
        expect(isPropertyFieldSourceManaged(makeField({attrs: {protected: false}}))).toBe(false);
        expect(isPropertyFieldSourceManaged(makeField({attrs: {owners: []}}))).toBe(false);
        expect(isPropertyFieldSourceManaged(makeField({attrs: {ldap: '', saml: ''}}))).toBe(false);
    });

    // Anything non-boolean predates the server's validation of the key, and an
    // owners blob that is not a list is not a list of owners.
    test('ignores values of the wrong shape rather than guessing', () => {
        expect(isPropertyFieldSourceManaged(makeField({attrs: {protected: 'true'}}))).toBe(false);
        expect(isPropertyFieldSourceManaged(makeField({attrs: {owners: 'com.example.scim'}}))).toBe(false);
        expect(isPropertyFieldSourceManaged(makeField({attrs: {ldap: true}}))).toBe(false);
        expect(isPropertyFieldSourceManaged(makeField({attrs: {saml: 42}}))).toBe(false);
    });

    // Ownership is a property of the field, not of how its value is edited.
    test('answers the same for every field type', () => {
        for (const type of ['text', 'select', 'multiselect', 'rank', 'graph'] as const) {
            expect(isPropertyFieldSourceManaged(makeField({
                type,
                attrs: {protected: true, source_plugin_id: 'com.example.markings'},
            }))).toBe(true);
        }
    });
});

describe('sync sources', () => {
    test('lists the linked sources in the order the server resolves them', () => {
        expect(getPropertyFieldSyncSources(makeField({attrs: {openid: 'groups', saml: 'Groups', ldap: 'memberOf'}}))).toEqual(['ldap', 'saml', 'openid']);
        expect(getPropertyFieldSyncSources(makeField({attrs: {openid: 'groups'}}))).toEqual(['openid']);
        expect(getPropertyFieldSyncSources(makeField({attrs: {ldap: '', openid: 7}}))).toEqual([]);
        expect(getPropertyFieldSyncSources(makeField())).toEqual([]);
    });

    test('reads a field as synced when any source names an attribute', () => {
        expect(isPropertyFieldSynced(makeField({attrs: {openid: 'department'}}))).toBe(true);
        expect(isPropertyFieldSynced(makeField({attrs: {}}))).toBe(false);
    });

    test('matches the source to the auth service the user signs in with', () => {
        const field = makeField({attrs: {openid: 'department'}});
        expect(isPropertyFieldSyncedForAuthService(field, 'openid')).toBe(true);
        expect(isPropertyFieldSyncedForAuthService(field, 'saml')).toBe(false);
        expect(isPropertyFieldSyncedForAuthService(field, '')).toBe(false);
        expect(isPropertyFieldSyncedForAuthService(field, undefined)).toBe(false);
        expect(isPropertyFieldSyncedForAuthService(makeField({attrs: {ldap: 'department', saml: 'Department'}}), 'saml')).toBe(true);
    });
});

describe('getPropertyFieldLabel', () => {
    test('prefers display_name', () => {
        expect(getPropertyFieldLabel(makeField({name: 'caveat', attrs: {display_name: 'Caveat / Releasability'}}))).toBe('Caveat / Releasability');
    });

    test('falls back to name when display_name is missing or empty', () => {
        expect(getPropertyFieldLabel(makeField({name: 'caveat'}))).toBe('caveat');
        expect(getPropertyFieldLabel(makeField({name: 'caveat', attrs: {display_name: ''}}))).toBe('caveat');
        expect(getPropertyFieldLabel(makeField({name: 'caveat', attrs: {display_name: 42}}))).toBe('caveat');
    });

    test('title-cases the classification slug so Channel Info matches the attribute name', () => {
        expect(getPropertyFieldLabel(makeField({name: 'classification'}))).toBe('Classification');
        expect(getPropertyFieldLabel(makeField({name: 'classification', attrs: {display_name: ''}}))).toBe('Classification');
        expect(getPropertyFieldLabel(makeField({name: 'classification', attrs: {display_name: 'Classification'}}))).toBe('Classification');
    });
});

// Also the Manage Attributes page heading, which renders a field's slug directly.
describe('formatPropertyFieldLabel', () => {
    test('title-cases the first letter so internal names read as headings', () => {
        expect(formatPropertyFieldLabel('classification')).toBe('Classification');
        expect(formatPropertyFieldLabel('  department')).toBe('Department');
    });

    test('leaves an already-capitalized display name unchanged', () => {
        expect(formatPropertyFieldLabel('Test Attribute')).toBe('Test Attribute');
    });

    test('returns an empty string when the name is blank', () => {
        expect(formatPropertyFieldLabel('   ')).toBe('');
        expect(formatPropertyFieldLabel('')).toBe('');
    });
});

describe('getPropertyFieldOptions', () => {
    test('returns the field\'s options', () => {
        const options = [{id: 'a', name: 'A'}];
        expect(getPropertyFieldOptions(makeField({attrs: {options}}))).toBe(options);
    });

    // An absent list and an empty one are not distinguishable on the wire, so
    // both read as empty rather than as undefined.
    test('returns an empty array when the field declares no options', () => {
        expect(getPropertyFieldOptions(makeField())).toEqual([]);
        expect(getPropertyFieldOptions(makeField({attrs: {}}))).toEqual([]);
        expect(getPropertyFieldOptions(makeField({attrs: {options: []}}))).toEqual([]);
    });
});

function makeRankField(policy?: string): PropertyField {
    return makeField({
        type: 'rank',
        attrs: {
            change_policy: policy,
            options: [
                {id: 'low', name: 'LOW', rank: 1},
                {id: 'mid', name: 'MID', rank: 2},
                {id: 'high', name: 'HIGH', rank: 3},
            ],
        },
    });
}

describe('getPropertyFieldChangePolicy', () => {
    test('defaults to any when absent or unrecognised', () => {
        expect(getPropertyFieldChangePolicy(makeField())).toBe('any');
        expect(getPropertyFieldChangePolicy(makeField({attrs: {}}))).toBe('any');
        expect(getPropertyFieldChangePolicy(makeField({attrs: {change_policy: 'frozen'}}))).toBe('any');
    });

    test('reads each known policy', () => {
        expect(getPropertyFieldChangePolicy(makeField({attrs: {change_policy: 'never'}}))).toBe('never');
        expect(getPropertyFieldChangePolicy(makeField({attrs: {change_policy: 'raise_only'}}))).toBe('raise_only');
        expect(getPropertyFieldChangePolicy(makeField({attrs: {change_policy: 'lower_only'}}))).toBe('lower_only');
    });

    test('folds a legacy editable=false into never, and change_policy wins over it', () => {
        expect(getPropertyFieldChangePolicy(makeField({attrs: {editable: false}}))).toBe('never');
        expect(getPropertyFieldChangePolicy(makeField({attrs: {editable: false, change_policy: 'raise_only'}}))).toBe('raise_only');
    });
});

describe('isPropertyValueSet', () => {
    test('treats null, undefined, empty string and empty list as unset', () => {
        expect(isPropertyValueSet(null)).toBe(false);
        expect(isPropertyValueSet(undefined)).toBe(false);
        expect(isPropertyValueSet('')).toBe(false);
        expect(isPropertyValueSet([])).toBe(false);
    });

    test('treats anything else as set', () => {
        expect(isPropertyValueSet('SECRET')).toBe(true);
        expect(isPropertyValueSet(['a'])).toBe(true);
        expect(isPropertyValueSet(0)).toBe(true);
        expect(isPropertyValueSet(false)).toBe(true);
    });
});

describe('getOptionRank', () => {
    test('reads the explicit rank', () => {
        expect(getOptionRank(makeRankField(), 'mid')).toBe(2);
    });

    test('returns undefined for an option without a stored rank', () => {
        const field = makeField({type: 'rank', attrs: {options: [{id: 'a', name: 'A'}, {id: 'b', name: 'B', rank: 2}]}});
        expect(getOptionRank(field, 'a')).toBeUndefined();
        expect(getOptionRank(field, 'b')).toBe(2);
    });

    test('returns undefined for an option that is no longer on the field', () => {
        expect(getOptionRank(makeRankField(), 'gone')).toBeUndefined();
    });
});

describe('sortOptionsByRank', () => {
    const ids = (options: PropertyFieldOption[]) => options.map((o) => o.id);

    test('puts the highest rank first', () => {
        const options: PropertyFieldOption[] = [
            {id: 'low', name: 'Low', rank: 1},
            {id: 'top', name: 'Top', rank: 3},
            {id: 'mid', name: 'Mid', rank: 2},
        ];

        expect(ids(sortOptionsByRank(options))).toEqual(['top', 'mid', 'low']);
    });

    test('puts unranked options last, keeping their stored order', () => {
        const options: PropertyFieldOption[] = [
            {id: 'u1', name: 'U1'},
            {id: 'low', name: 'Low', rank: 1},
            {id: 'u2', name: 'U2'},
            {id: 'top', name: 'Top', rank: 3},
        ];

        expect(ids(sortOptionsByRank(options))).toEqual(['top', 'low', 'u1', 'u2']);
    });

    test('treats rank 0 as ranked: below positive ranks, above unranked', () => {
        const options: PropertyFieldOption[] = [
            {id: 'u', name: 'U'},
            {id: 'zero', name: 'Zero', rank: 0},
            {id: 'one', name: 'One', rank: 1},
        ];

        expect(ids(sortOptionsByRank(options))).toEqual(['one', 'zero', 'u']);
    });

    test('keeps the stored order of equal ranks', () => {
        const options: PropertyFieldOption[] = [
            {id: 'a', name: 'A', rank: 2},
            {id: 'b', name: 'B', rank: 2},
            {id: 'c', name: 'C', rank: 5},
        ];

        expect(ids(sortOptionsByRank(options))).toEqual(['c', 'a', 'b']);
    });

    test('returns a new array and leaves the input untouched', () => {
        const options: PropertyFieldOption[] = [
            {id: 'low', name: 'Low', rank: 1},
            {id: 'top', name: 'Top', rank: 3},
        ];

        const sorted = sortOptionsByRank(options);

        expect(sorted).not.toBe(options);
        expect(ids(options)).toEqual(['low', 'top']);
    });

    test('returns an empty array for no options', () => {
        expect(sortOptionsByRank([])).toEqual([]);
    });
});

describe('canMoveToOption', () => {
    test('allows the first write under every policy', () => {
        for (const policy of ['any', 'never', 'raise_only', 'lower_only']) {
            expect(canMoveToOption(makeRankField(policy), null, 'low')).toBe(true);
        }
    });

    test('any permits every move, never permits none', () => {
        expect(canMoveToOption(makeRankField('any'), 'mid', 'low')).toBe(true);
        expect(canMoveToOption(makeRankField('never'), 'mid', 'high')).toBe(false);
    });

    test('raise_only permits only a higher rank, equal included as a refusal', () => {
        const field = makeRankField('raise_only');
        expect(canMoveToOption(field, 'mid', 'high')).toBe(true);
        expect(canMoveToOption(field, 'mid', 'mid')).toBe(false);
        expect(canMoveToOption(field, 'mid', 'low')).toBe(false);
    });

    test('lower_only is the mirror', () => {
        const field = makeRankField('lower_only');
        expect(canMoveToOption(field, 'mid', 'low')).toBe(true);
        expect(canMoveToOption(field, 'mid', 'mid')).toBe(false);
        expect(canMoveToOption(field, 'mid', 'high')).toBe(false);
    });

    test('fails closed when the stored option is gone', () => {
        expect(canMoveToOption(makeRankField('raise_only'), 'deleted-option', 'high')).toBe(false);
    });

    test('fails closed when either option has no stored rank', () => {
        const field = makeField({
            type: 'rank',
            attrs: {
                change_policy: 'raise_only',
                options: [
                    {id: 'low', name: 'LOW', rank: 1},
                    {id: 'odd', name: 'ODD'},
                    {id: 'high', name: 'HIGH', rank: 3},
                ],
            },
        });

        expect(canMoveToOption(field, 'low', 'odd')).toBe(false);
        expect(canMoveToOption(field, 'odd', 'high')).toBe(false);
        expect(canMoveToOption(field, 'low', 'high')).toBe(true);
    });
});

describe('channel field fillability', () => {
    const channelField = (overrides: Partial<PropertyField> = {}) => makeField({object_type: 'channel', ...overrides});

    describe('legacy permission_values', () => {
        it.each([
            ['admin', true],
            ['member', true],
            ['sysadmin', false],
            ['creator', false],
            ['none', false],
            ['', false],
        ] as const)('permission_values %s is fillable=%s', (level, expected) => {
            expect(isChannelFieldFillableByCreators(channelField({permission_values: level}))).toBe(expected);
        });

        it('treats a missing permission_values as the admin default', () => {
            expect(isChannelFieldFillableByCreators(channelField())).toBe(true);
        });
    });

    it('is never fillable for a field that is not a channel field', () => {
        expect(isChannelFieldFillableByCreators(makeField({object_type: 'user', permission_values: 'admin'}))).toBe(false);
        expect(isChannelFieldLevelOnlyUnfillable(makeField({object_type: 'user', permission_values: 'sysadmin'}))).toBe(false);
    });

    it.each([
        ['managed by admin', {managed: 'admin'}],
        ['owned', {owners: [{type: 'plugin', id: 'p'}]}],
        ['protected', {protected: true}],
        ['synced', {ldap: 'attr'}],
        ['source_only access', {access_mode: 'source_only'}],
        ['shared_only access (masked)', {access_mode: 'shared_only'}],
    ])('a %s field is not fillable and not level-only', (_label, attrs) => {
        const field = channelField({permission_values: 'admin', attrs});
        expect(isChannelFieldFillableByCreators(field)).toBe(false);
        expect(isChannelFieldLevelOnlyUnfillable(field)).toBe(false);
    });

    it('flags any value tier channel creators cannot fill as the only problem', () => {
        expect(isChannelFieldLevelOnlyUnfillable(channelField({permission_values: 'sysadmin'}))).toBe(true);
        expect(isChannelFieldLevelOnlyUnfillable(channelField({permission_values: 'none'}))).toBe(true);
        expect(isChannelFieldLevelOnlyUnfillable(channelField({permission_values: 'creator'}))).toBe(true);
        expect(isChannelFieldLevelOnlyUnfillable(channelField({permission_values: 'admin'}))).toBe(false);
        expect(isChannelFieldLevelOnlyUnfillable(channelField({permission_values: 'member'}))).toBe(false);
    });

    describe('permissions', () => {
        const withRestrictions = (value: {read?: 'member' | 'everyone' | 'creator' | 'admin' | 'none'; write?: 'admin' | 'member' | 'everyone' | 'creator' | 'sysadmin' | 'none'}, optionRead: 'member' | 'everyone' | 'creator' | 'none' = 'everyone', masking?: Record<string, unknown>) => channelField({
            permission_values: 'sysadmin',
            permissions: {restrictions: {value, option: {read: optionRead}, field: {}}, grants: [], masking},
        });

        it.each([
            ['admin', true],
            ['member', true],
            ['everyone', false],
            ['creator', false],
            ['sysadmin', false],
            ['none', false],
        ] as const)('value.write %s is fillable=%s and wins over the legacy keys', (write, expected) => {
            expect(isChannelFieldFillableByCreators(withRestrictions({read: 'everyone', write}))).toBe(expected);
        });

        it('needs members to read the values and options', () => {
            expect(isChannelFieldFillableByCreators(withRestrictions({read: 'member', write: 'admin'}, 'member'))).toBe(true);
            expect(isChannelFieldFillableByCreators(withRestrictions({read: 'creator', write: 'admin'}))).toBe(false);
            expect(isChannelFieldFillableByCreators(withRestrictions({read: 'everyone', write: 'admin'}, 'creator'))).toBe(false);
            expect(isChannelFieldFillableByCreators(withRestrictions({write: 'admin'}))).toBe(false);
        });

        it('is not fillable when masked, and the level is not the only problem', () => {
            const masked = withRestrictions({read: 'everyone', write: 'sysadmin'}, 'everyone', {mask_by_field_id: 'x'});
            expect(isChannelFieldFillableByCreators(masked)).toBe(false);
            expect(isChannelFieldLevelOnlyUnfillable(masked)).toBe(false);
        });

        it('reports a level-only problem for sysadmin and none, and not once reads are narrowed', () => {
            expect(isChannelFieldLevelOnlyUnfillable(withRestrictions({read: 'everyone', write: 'sysadmin'}))).toBe(true);
            expect(isChannelFieldLevelOnlyUnfillable(withRestrictions({read: 'everyone', write: 'none'}))).toBe(true);
            expect(isChannelFieldLevelOnlyUnfillable(withRestrictions({read: 'admin', write: 'sysadmin'}))).toBe(false);
        });
    });

    describe('getRestrictionsWithChannelAdminValueWrite', () => {
        it('keeps the stored restrictions and only changes value.write', () => {
            const field = channelField({
                permissions: {restrictions: {value: {read: 'everyone', write: 'sysadmin'}, option: {read: 'everyone', write: 'admin'}, field: {write: 'admin'}}, grants: []},
            });
            expect(getRestrictionsWithChannelAdminValueWrite(field)).toEqual({
                value: {read: 'everyone', write: 'admin'},
                option: {read: 'everyone', write: 'admin'},
                field: {write: 'admin'},
            });
        });

        it('derives the restrictions from the legacy keys when there are no permissions', () => {
            const field = channelField({permission_values: 'sysadmin', permission_field: 'sysadmin', permission_options: 'admin'});
            expect(getRestrictionsWithChannelAdminValueWrite(field)).toEqual({
                value: {read: 'everyone', write: 'admin'},
                option: {read: 'everyone', write: 'admin'},
                field: {write: 'sysadmin'},
            });
        });
    });
});
