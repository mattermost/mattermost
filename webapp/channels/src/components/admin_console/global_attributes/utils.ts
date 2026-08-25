// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import type {ResourceObjectType} from './attribute_details/attribute_applies_to_constants';
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

// Deletes a template field from the access_control group. The server returns
// 409 when the field still has active linked dependents (CountLinkedFields > 0);
// callers are expected to surface that case distinctly (or, for a save-time
// rollback, to only delete linked fields first -- see createLinkedAttributeField).
export function deleteAttributeField(fieldId: string): Promise<unknown> {
    return Client4.deletePropertyField(GLOBAL_ATTRIBUTES_GROUP_NAME, GLOBAL_ATTRIBUTES_OBJECT_TYPE, fieldId);
}

// Creates a linked field for one Applies-to resource. The server validates
// linked_field_id against the template and copies its Type and attrs.options
// onto the new field (server/channels/app/properties/property_field.go) --
// display_name is NOT copied, so it's sent explicitly here (see the plan's
// Decisions table). objectType is the resource type ('user'/'channel'/'post'),
// a URL path segment on the generic property-fields endpoint, not a separate
// route.
//
// `attrs` is what the resource's own settings contribute -- only Channels has
// any today (buildChannelFieldAttrs). Trailing and optional so the other two
// resource types keep calling this unchanged.
export function createLinkedAttributeField(
    objectType: ResourceObjectType,
    name: string,
    fieldType: AttributeFieldType,
    displayName: string,
    linkedFieldId: string,
    attrs?: Record<string, unknown>,
): Promise<PropertyField> {
    return Client4.createPropertyField(GLOBAL_ATTRIBUTES_GROUP_NAME, objectType, {
        name,
        type: fieldType as PropertyField['type'],
        target_type: GLOBAL_ATTRIBUTES_TARGET_TYPE,
        target_id: '',
        linked_field_id: linkedFieldId,
        attrs: {
            display_name: displayName.trim() || undefined,
            ...attrs,
        },
    });
}

// Deletes a linked field for one Applies-to resource. Must be called before
// deleteAttributeField on the template it points at -- the server blocks
// deleting a template with active linked dependents.
export function deleteLinkedAttributeField(objectType: ResourceObjectType, fieldId: string): Promise<unknown> {
    return Client4.deletePropertyField(GLOBAL_ATTRIBUTES_GROUP_NAME, objectType, fieldId);
}
