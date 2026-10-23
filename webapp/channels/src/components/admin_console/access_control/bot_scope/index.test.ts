// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserPropertyField} from '@mattermost/types/properties_user';

import {fixture} from '../cel_expression_test_fixtures';

import {getHiddenNativeReferences, getSyncedAttributeReferences} from './index';

const makeField = (name: string, attrs: Partial<UserPropertyField['attrs']> = {}): UserPropertyField => ({
    id: `id-${name}`,
    name,
    type: 'text',
    group_id: 'custom_profile_attributes',
    target_id: '',
    target_type: '',
    object_type: 'user',
    attrs: {
        sort_order: 0,
        visibility: 'always',
        value_type: '',
        ...attrs,
    },
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    created_by: '',
    updated_by: '',
});

describe('getSyncedAttributeReferences', () => {
    const clearance = makeField('Clearance', {ldap: 'clearance'});
    const program = makeField('Program', {saml: 'program'});
    const tags = makeField('Tags');
    const level = makeField('Level', {managed: 'admin'});
    const prot = makeField('Prot', {protected: true});
    const emptyLdap = makeField('EmptyLdap', {ldap: ''});
    const fields = [clearance, program, tags, level, prot, emptyLdap];

    it('ignores names that appear only inside literals', () => {
        expect(getSyncedAttributeReferences('user.attributes.Clearance == "Secret" && user.attributes.Tags == "user.attributes.Program"', fields)).toEqual([clearance]);
    });

    it('returns LDAP and SAML fields in field order', () => {
        expect(getSyncedAttributeReferences('user.attributes.Program == "x" && user.attributes.Clearance == "y"', fields)).toEqual([clearance, program]);
    });

    it('excludes admin-managed, protected, empty-LDAP and plain fields', () => {
        expect(getSyncedAttributeReferences('user.attributes.Level == "Gold" && user.attributes.Prot == "x" && user.attributes.EmptyLdap == "z" && user.attributes.Tags == "a"', fields)).toEqual([]);
    });

    it('returns nothing for an empty expression', () => {
        expect(getSyncedAttributeReferences('', fields)).toEqual([]);
    });

    it('returns nothing when there are no fields', () => {
        expect(getSyncedAttributeReferences('user.attributes.Clearance == "Secret"', [])).toEqual([]);
    });

    it('returns each field once even when referenced repeatedly', () => {
        expect(getSyncedAttributeReferences('user.attributes.Clearance == "a" || user.attributes.Clearance == "b"', fields)).toEqual([clearance]);
    });

    it('ignores a synced name that is only commented out', () => {
        expect(getSyncedAttributeReferences('user.attributes.Tags == "a" // was user.attributes.Clearance', fields)).toEqual([]);
    });

    it('finds a synced name after a comment with an apostrophe', () => {
        expect(getSyncedAttributeReferences('// don\'t drop this\nuser.attributes.Tags == \'a\' && user.attributes.Clearance == "b"', fields)).toEqual([clearance]);
    });

    it('finds a synced name with whitespace or a newline around the dots', () => {
        expect(getSyncedAttributeReferences('user.attributes .Clearance == "a"', fields)).toEqual([clearance]);
        expect(getSyncedAttributeReferences('user\n  .attributes\n  .Program == "a"', fields)).toEqual([program]);
    });

    it('finds a synced name used with bracket access', () => {
        expect(getSyncedAttributeReferences('user.attributes["Program"] == "x"', fields)).toEqual([program]);
    });

    it('works on a fixture with newlines', () => {
        expect(getSyncedAttributeReferences(fixture('d3 masking on GET').expression, fields)).toEqual([clearance]);
    });
});

describe('getHiddenNativeReferences', () => {
    it('finds email in a simple-mode comparison', () => {
        expect(getHiddenNativeReferences('user.email == "a@b.com"')).toEqual(['email']);
    });

    it('finds every hidden native in a hand-written expression, in hidden-list order', () => {
        expect(getHiddenNativeReferences('user.isbot == false || (user.email.endsWith("@x.com") && user.verified == true)')).toEqual(['email', 'verified', 'isbot']);
    });

    it('finds bracket access on the user object', () => {
        expect(getHiddenNativeReferences('user["email"] == "a@b.com"')).toEqual(['email']);
    });

    it('finds single-quoted bracket access', () => {
        expect(getHiddenNativeReferences('user[\'verified\'] == true')).toEqual(['verified']);
    });

    it('finds a negated selector', () => {
        expect(getHiddenNativeReferences('!user.isbot')).toEqual(['isbot']);
    });

    it('finds a has() presence test', () => {
        expect(getHiddenNativeReferences('has(user.email)')).toEqual(['email']);
    });

    it('finds selectors with whitespace or a newline around the dot', () => {
        expect(getHiddenNativeReferences('user .email == "a"')).toEqual(['email']);
        expect(getHiddenNativeReferences('user. verified == true')).toEqual(['verified']);
        expect(getHiddenNativeReferences('user.attributes.Team == "a" &&\nuser\n  .isbot')).toEqual(['isbot']);
    });

    it('does not flag a spaced custom attribute selector', () => {
        expect(getHiddenNativeReferences('user.attributes .email == "a" && user .attributes. verified == "b"')).toEqual([]);
    });

    it('ignores allowed natives, custom and session attributes with the same names', () => {
        expect(getHiddenNativeReferences('user.createat.youngerThanDays(7) && user.attributes.email == "a" && user.session.isbot == "b" && user.attributes["verified"] == "c"')).toEqual([]);
    });

    it('ignores names inside literals and comments', () => {
        expect(getHiddenNativeReferences('user.attributes.Tags == "user.email" // user.isbot\n&& user.attributes.Team == \'user.verified\'')).toEqual([]);
    });

    it('ignores a selector whose receiver is not the user object', () => {
        expect(getHiddenNativeReferences('resource.user.email == "a" && someuser.email == "b"')).toEqual([]);
    });

    it('returns nothing for an empty expression', () => {
        expect(getHiddenNativeReferences('')).toEqual([]);
    });
});
