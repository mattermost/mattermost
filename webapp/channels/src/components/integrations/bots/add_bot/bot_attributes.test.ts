// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserPropertyField} from '@mattermost/types/properties_user';

import {
    canManageBotAttributes,
    computeAttributeChanges,
    computeBotRoles,
    getAddableFields,
    getBotCreateRedirectUrl,
    getRowFields,
    isRowRemovable,
    normalizeAttributeValues,
    rolesChanged,
    seedAttributeRows,
    validateAttributeRows,
} from './bot_attributes';
import type {BotRoleChoice} from './bot_attributes';

const buildField = (overrides: Partial<UserPropertyField> = {}, attrs: Partial<UserPropertyField['attrs']> = {}): UserPropertyField => ({
    id: 'field-1',
    name: 'department',
    type: 'text',
    group_id: 'custom_profile_attributes',
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    created_by: '',
    updated_by: '',
    target_id: '',
    target_type: '',
    object_type: 'user',
    ...overrides,
    attrs: {sort_order: 0, visibility: 'when_set', value_type: '', ...attrs},
});

const ADMIN = {canEditAdminManaged: true};
const NON_ADMIN = {canEditAdminManaged: false};

describe('bot_attributes', () => {
    describe('canManageBotAttributes', () => {
        test.each([true, false])('create uses manageBots (%s)', (manageBots) => {
            expect(canManageBotAttributes(undefined, 'me', {manageBots, manageOthersBots: !manageBots})).toBe(manageBots);
        });

        test('own bot uses manageBots and ignores manageOthersBots', () => {
            expect(canManageBotAttributes({owner_id: 'me'}, 'me', {manageBots: true, manageOthersBots: false})).toBe(true);
            expect(canManageBotAttributes({owner_id: 'me'}, 'me', {manageBots: false, manageOthersBots: true})).toBe(false);
        });

        test('another user\'s bot uses manageOthersBots', () => {
            expect(canManageBotAttributes({owner_id: 'other'}, 'me', {manageBots: true, manageOthersBots: false})).toBe(false);
            expect(canManageBotAttributes({owner_id: 'other'}, 'me', {manageBots: false, manageOthersBots: true})).toBe(true);
        });

        test('plugin-owned bot uses manageOthersBots', () => {
            expect(canManageBotAttributes({owner_id: 'com.plugin'}, 'me', {manageBots: true, manageOthersBots: false})).toBe(false);
            expect(canManageBotAttributes({owner_id: 'com.plugin'}, 'me', {manageBots: false, manageOthersBots: true})).toBe(true);
        });
    });

    describe('normalizeAttributeValues', () => {
        test('undefined input returns an empty object', () => {
            expect(normalizeAttributeValues(undefined)).toEqual({});
        });

        test('keeps set strings and string arrays, drops everything else', () => {
            expect(normalizeAttributeValues({
                text: 'Eng',
                multi: ['a'],
                empty: '',
                emptyArray: [],
                nullValue: null,
                number: 5,
                mixed: ['a', 1],
                object: {},
            })).toEqual({text: 'Eng', multi: ['a']});
        });
    });

    describe('seedAttributeRows', () => {
        test('returns the ids with values', () => {
            expect(seedAttributeRows({a: 'x', b: ['y'], c: '', d: []})).toEqual(['a', 'b']);
        });
    });

    describe('getRowFields', () => {
        const fields = [
            buildField({id: 'b'}, {sort_order: 2}),
            buildField({id: 'a'}, {sort_order: 1}),
            buildField({id: 'hidden'}, {sort_order: 0, access_mode: 'source_only'}),
        ];

        test('sorts by sort_order regardless of row order and drops hidden or unknown ids', () => {
            const copy = [...fields];
            expect(getRowFields(fields, ['b', 'hidden', 'gone', 'a']).map((f) => f.id)).toEqual(['a', 'b']);
            expect(fields).toEqual(copy);
        });
    });

    describe('getAddableFields', () => {
        const fields = [
            buildField({id: 'row'}, {sort_order: 1}),
            buildField({id: 'protected'}, {sort_order: 2, protected: true}),
            buildField({id: 'ldap'}, {sort_order: 3, ldap: 'title'}),
            buildField({id: 'saml'}, {sort_order: 4, saml: 'title'}),
            buildField({id: 'owned'}, {sort_order: 5, owners: [{id: 'p', type: 'plugin', scopes: []}]}),
            buildField({id: 'omittedSelect', type: 'select'}, {sort_order: 6, options_omitted: true}),
            buildField({id: 'omittedGraph', type: 'graph'}, {sort_order: 7, options_omitted: true}),
            buildField({id: 'adminOnly'}, {sort_order: 8, managed: 'admin'}),
            buildField({id: 'hidden'}, {sort_order: 9, access_mode: 'source_only'}),
            buildField({id: 'last'}, {sort_order: 11}),
            buildField({id: 'first'}, {sort_order: 0}),
        ];

        test('excludes rows, locked and hidden fields and sorts the rest', () => {
            expect(getAddableFields(fields, ['row'], NON_ADMIN).map((f) => f.id)).toEqual(['first', 'omittedGraph', 'last']);
        });

        test('includes admin-managed fields when canEditAdminManaged', () => {
            expect(getAddableFields(fields, ['row'], ADMIN).map((f) => f.id)).toEqual(['first', 'omittedGraph', 'adminOnly', 'last']);
        });
    });

    describe('isRowRemovable', () => {
        const required = buildField({id: 'req'}, {required: true});

        test('required with an initial value is not removable', () => {
            expect(isRowRemovable(required, {req: 'x'})).toBe(false);
        });

        test('required without an initial value is removable', () => {
            expect(isRowRemovable(required, {})).toBe(true);
        });

        test('optional with a value is removable', () => {
            expect(isRowRemovable(buildField({id: 'opt'}), {opt: 'x'})).toBe(true);
        });
    });

    describe('computeAttributeChanges', () => {
        const text = buildField({id: 'text'}, {sort_order: 1});
        const multi = buildField({id: 'multi', type: 'multiselect'}, {sort_order: 2});
        const graph = buildField({id: 'graph', type: 'graph'}, {sort_order: 3});
        const locked = buildField({id: 'locked'}, {sort_order: 4, protected: true});
        const adminOnly = buildField({id: 'adminOnly'}, {sort_order: 5, managed: 'admin'});
        const hidden = buildField({id: 'hidden'}, {sort_order: 6, access_mode: 'source_only'});
        const fields = [text, multi, graph, locked, adminOnly, hidden];

        test('a new text row with a value is sent', () => {
            expect(computeAttributeChanges(fields, ['text'], {text: 'Eng'}, {}, ADMIN)).toEqual({text: 'Eng'});
        });

        test('a new row left empty is not sent', () => {
            expect(computeAttributeChanges(fields, ['text'], {text: ''}, {}, ADMIN)).toEqual({});
            expect(computeAttributeChanges(fields, ['multi'], {}, {}, ADMIN)).toEqual({});
        });

        test('removed seeded rows send the cleared value for their type', () => {
            const initial = {text: 'Eng', multi: ['a'], graph: ['g']};
            expect(computeAttributeChanges(fields, [], initial, initial, ADMIN)).toEqual({text: '', multi: [], graph: []});
        });

        test('unchanged seeded rows are not sent', () => {
            const initial = {text: 'Eng', multi: ['a', 'b']};
            expect(computeAttributeChanges(fields, ['text', 'multi'], {text: 'Eng', multi: ['a', 'b']}, initial, ADMIN)).toEqual({});
        });

        test('an edited seeded row sends the new value', () => {
            expect(computeAttributeChanges(fields, ['text'], {text: 'Ops'}, {text: 'Eng'}, ADMIN)).toEqual({text: 'Ops'});
        });

        test('locked fields are never sent', () => {
            expect(computeAttributeChanges(fields, [], {}, {locked: 'x'}, ADMIN)).toEqual({});
            expect(computeAttributeChanges(fields, ['locked'], {locked: 'y'}, {locked: 'x'}, ADMIN)).toEqual({});
        });

        test('admin-managed fields are not sent without canEditAdminManaged', () => {
            expect(computeAttributeChanges(fields, ['adminOnly'], {adminOnly: 'y'}, {adminOnly: 'x'}, NON_ADMIN)).toEqual({});
            expect(computeAttributeChanges(fields, ['adminOnly'], {adminOnly: 'y'}, {adminOnly: 'x'}, ADMIN)).toEqual({adminOnly: 'y'});
        });

        test('hidden and unknown fields are never sent', () => {
            expect(computeAttributeChanges(fields, [], {}, {hidden: 'x'}, ADMIN)).toEqual({});
            expect(computeAttributeChanges(fields, ['gone'], {gone: 'x'}, {}, ADMIN)).toEqual({});
        });
    });

    describe('validateAttributeRows', () => {
        const email = buildField({id: 'email'}, {sort_order: 1, value_type: 'email'});
        const text = buildField({id: 'text'}, {sort_order: 2});
        const required = buildField({id: 'req', type: 'select'}, {sort_order: 3, required: true});
        const locked = buildField({id: 'locked'}, {sort_order: 4, protected: true, value_type: 'email'});
        const fields = [email, text, required, locked];

        test('a changed invalid email fails', () => {
            expect(validateAttributeRows(fields, ['email'], {email: 'nope'}, {}, ADMIN)).toEqual({
                email: expect.objectContaining({id: 'admin.user_item.invalidEmail'}),
            });
        });

        test('a text value over 64 bytes fails', () => {
            expect(validateAttributeRows(fields, ['text'], {text: 'a'.repeat(65)}, {}, ADMIN)).toEqual({
                text: expect.objectContaining({id: 'property_fields.user_attribute_fields.too_long'}),
            });
        });

        test('a new required row left empty fails', () => {
            expect(validateAttributeRows(fields, ['req'], {req: ''}, {}, ADMIN)).toEqual({
                req: expect.objectContaining({id: 'property_fields.user_attribute_fields.required'}),
            });
        });

        test('an unchanged seeded invalid email passes', () => {
            expect(validateAttributeRows(fields, ['email'], {email: 'nope'}, {email: 'nope'}, ADMIN)).toEqual({});
        });

        test('a locked row with an invalid value passes', () => {
            expect(validateAttributeRows(fields, ['locked'], {locked: 'nope'}, {}, ADMIN)).toEqual({});
        });

        test('a field not in rows is not validated', () => {
            expect(validateAttributeRows(fields, [], {email: 'nope'}, {}, ADMIN)).toEqual({});
        });

        test('a valid change passes', () => {
            expect(validateAttributeRows(fields, ['email', 'text'], {email: 'a@b.com', text: 'Eng'}, {}, ADMIN)).toEqual({});
        });
    });

    describe('computeBotRoles', () => {
        const member: BotRoleChoice = {isAdmin: false, postAll: false, postChannels: false};
        const admin: BotRoleChoice = {isAdmin: true, postAll: false, postChannels: false};

        test.each<[string, BotRoleChoice, string]>([
            ['system_user', member, 'system_user'],
            ['system_user', admin, 'system_user system_admin'],
            ['system_user', {isAdmin: false, postAll: true, postChannels: true}, 'system_user system_post_all'],
            ['system_user', {isAdmin: false, postAll: false, postChannels: true}, 'system_user system_post_all_public'],
            ['system_user system_user_access_token system_post_all', admin, 'system_user system_user_access_token system_admin'],
            ['system_admin system_user', member, 'system_user'],
            ['', member, 'system_user'],
            ['system_user  custom_role custom_role', member, 'system_user custom_role'],
        ])('(%p, %p) -> %p', (current, choice, expected) => {
            expect(computeBotRoles(current, choice)).toBe(expected);
        });
    });

    describe('rolesChanged', () => {
        test('same set in a different order is unchanged', () => {
            expect(rolesChanged('system_user system_admin', 'system_admin system_user')).toBe(false);
        });

        test('an added role is a change', () => {
            expect(rolesChanged('system_user', 'system_user system_admin')).toBe(true);
        });

        test('a removed role is a change', () => {
            expect(rolesChanged('system_user system_admin', 'system_user')).toBe(true);
        });

        test('extra spaces are ignored', () => {
            expect(rolesChanged(' system_user  system_admin ', 'system_user system_admin')).toBe(false);
        });
    });

    describe('getBotCreateRedirectUrl', () => {
        test('token and no warnings matches the original confirm URL', () => {
            expect(getBotCreateRedirectUrl('team', 'bot-id', 'tok', {})).toBe('/team/integrations/confirm?type=bots&id=bot-id&token=tok');
        });

        test('token with an attributes failure', () => {
            expect(getBotCreateRedirectUrl('team', 'bot-id', 'tok', {attributesFailed: true})).toBe('/team/integrations/confirm?type=bots&id=bot-id&token=tok&bot_warnings=attributes');
        });

        test('token with roles and attributes failures', () => {
            expect(getBotCreateRedirectUrl('team', 'bot-id', 'tok', {rolesFailed: true, attributesFailed: true})).toBe('/team/integrations/confirm?type=bots&id=bot-id&token=tok&bot_warnings=roles,attributes');
        });

        test('no token lands on the list', () => {
            expect(getBotCreateRedirectUrl('team', 'bot-id', undefined, {})).toBe('/team/integrations/bots?bot_warnings=token');
        });

        test('no token with an attributes failure', () => {
            expect(getBotCreateRedirectUrl('team', 'bot-id', undefined, {attributesFailed: true})).toBe('/team/integrations/bots?bot_warnings=token,attributes');
        });

        test('an empty token behaves like a missing one', () => {
            expect(getBotCreateRedirectUrl('team', 'bot-id', '', {})).toBe('/team/integrations/bots?bot_warnings=token');
        });
    });
});
