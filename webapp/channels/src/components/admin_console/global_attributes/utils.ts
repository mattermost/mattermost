// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import {GLOBAL_ATTRIBUTES_GROUP_NAME, GLOBAL_ATTRIBUTES_OBJECT_TYPE, GLOBAL_ATTRIBUTES_TARGET_TYPE} from './constants';

export type AttributeFieldType = 'text' | 'select' | 'multiselect' | 'rank';

// Builds the attrs.options payload for the given type: {id: '', name} for
// Select/Multiselect (id is a required string on PropertyFieldOption, but the
// server always generates the real one -- EnsureOptionIDs /
// sanitizeAndValidateOptions); {id: '', name, rank} for Rank, with rank always
// explicitly present (never inferred from array position -- the server's
// validateRankOptions hard-errors on create if it's missing). Text has no
// options key at all.
function buildOptionsAttr(fieldType: AttributeFieldType, options: PropertyFieldOption[]): PropertyFieldOption[] | undefined {
    switch (fieldType) {
    case 'select':
    case 'multiselect':
        return options.map(({name}) => ({id: '', name}));
    case 'rank':
        return options.map(({name, rank}) => ({id: '', name, rank}));
    default:
        return undefined;
    }
}

// Creates a template field in the access_control group. target_type/target_id
// are set explicitly because CanonicalizeSystemObjectField only auto-corrects
// ObjectType=system fields, not ObjectType=template ones.
//
// `links` is a trailing optional parameter (not folded into the existing 4
// positional args) so the two new same-typed strings can't be swapped with
// each other or with displayName/name, and every existing call site keeps
// compiling unchanged.
export function createAttributeField(
    displayName: string,
    name: string,
    fieldType: AttributeFieldType,
    options: PropertyFieldOption[],
    links?: {ldapAttr?: string; samlAttr?: string},
): Promise<PropertyField> {
    const optionsAttr = buildOptionsAttr(fieldType, options);
    return Client4.createPropertyField(GLOBAL_ATTRIBUTES_GROUP_NAME, GLOBAL_ATTRIBUTES_OBJECT_TYPE, {
        name,
        type: fieldType as PropertyField['type'],
        target_type: GLOBAL_ATTRIBUTES_TARGET_TYPE,
        target_id: '',
        attrs: {
            display_name: displayName.trim() || undefined,
            ...(optionsAttr ? {options: optionsAttr} : {}),
            ...(links?.ldapAttr ? {ldap: links.ldapAttr} : {}),
            ...(links?.samlAttr ? {saml: links.samlAttr} : {}),
        },
    });
}
