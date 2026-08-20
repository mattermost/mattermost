// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import {ALL_RESOURCE_TYPES} from './attribute_details/attribute_applies_to_constants';
import type {ResourceObjectType} from './attribute_details/attribute_applies_to_constants';
import {GLOBAL_ATTRIBUTES_GROUP_NAME, GLOBAL_ATTRIBUTES_OBJECT_TYPE, GLOBAL_ATTRIBUTES_TARGET_TYPE} from './constants';

export type AttributeFieldType = 'text' | 'select' | 'multiselect' | 'rank';

// Server clamps per_page to this max (web.PerPageMaximum). Directory-mode
// listing with no cursor sorts CreateAt ASC, so a default 60-item page can
// miss a freshly created field.
const MAX_PROPERTY_FIELDS_PER_PAGE = 200;

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

// Patch keeps existing option IDs so stored values stay attached. New options
// still send an empty id for the server to mint. Text sends null so mergeAttrs
// drops a leftover options key when switching away from Select/Multiselect/Rank.
function buildPatchOptionsAttr(fieldType: AttributeFieldType, options: PropertyFieldOption[]): PropertyFieldOption[] | null {
    switch (fieldType) {
    case 'select':
    case 'multiselect':
        return options.map(({id, name}) => ({id: id || '', name}));
    case 'rank':
        return options.map(({id, name, rank}) => ({id: id || '', name, rank}));
    default:
        return null;
    }
}

async function listPropertyFields(objectType: string): Promise<PropertyField[]> {
    const fields: PropertyField[] = [];
    let cursorId: string | undefined;
    let cursorCreateAt: number | undefined;

    while (true) {
        // eslint-disable-next-line no-await-in-loop
        const page = await Client4.getPropertyFields(
            GLOBAL_ATTRIBUTES_GROUP_NAME,
            objectType,
            GLOBAL_ATTRIBUTES_TARGET_TYPE,
            undefined,
            {perPage: MAX_PROPERTY_FIELDS_PER_PAGE, cursorId, cursorCreateAt},
        );
        fields.push(...page);
        if (page.length === 0) {
            break;
        }
        const last = page[page.length - 1];
        cursorId = last.id;
        cursorCreateAt = last.create_at;
        if (page.length < MAX_PROPERTY_FIELDS_PER_PAGE) {
            break;
        }
    }

    return fields;
}

// There is no GET-by-id property-fields HTTP handler. List template fields and
// find the one whose id matches. Returns undefined when it isn't in the group.
export async function fetchAttributeField(fieldId: string): Promise<PropertyField | undefined> {
    const fields = await listPropertyFields(GLOBAL_ATTRIBUTES_OBJECT_TYPE);
    return fields.find((field) => field.id === fieldId && field.delete_at === 0);
}

function isResourceObjectType(value: string): value is ResourceObjectType {
    return (ALL_RESOURCE_TYPES as string[]).includes(value);
}

// Lists user/channel/post fields and keeps those pointing at the template.
// There is no cross-object-type listing endpoint.
export async function fetchLinkedFieldsForTemplate(templateFieldId: string): Promise<PropertyField[]> {
    const pages = await Promise.all(
        ALL_RESOURCE_TYPES.map((objectType) => listPropertyFields(objectType)),
    );
    return pages.flat().filter((field) => (
        field.linked_field_id === templateFieldId &&
        field.delete_at === 0 &&
        isResourceObjectType(field.object_type)
    ));
}

export function linkedFieldsByResourceType(fields: PropertyField[]): Partial<Record<ResourceObjectType, PropertyField>> {
    const byType: Partial<Record<ResourceObjectType, PropertyField>> = {};
    for (const field of fields) {
        if (isResourceObjectType(field.object_type) && !byType[field.object_type]) {
            byType[field.object_type] = field;
        }
    }
    return byType;
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

export type UpdateAttributeFieldPatch = {
    name?: string;
    type: AttributeFieldType;
    displayName: string;
    options: PropertyFieldOption[];
    ldapAttr: string;
    samlAttr: string;
};

// PATCHes a template field. Attrs are merge-patched (mergeAttrs=true on the
// server): ldap/saml send null to unlink, and Text sends options: null so a
// leftover options array is dropped. name is omitted when unchanged so the
// server skips uniqueness re-validation.
export function updateAttributeField(
    fieldId: string,
    patch: UpdateAttributeFieldPatch,
): Promise<PropertyField> {
    return Client4.patchPropertyField(GLOBAL_ATTRIBUTES_GROUP_NAME, GLOBAL_ATTRIBUTES_OBJECT_TYPE, fieldId, {
        ...(patch.name !== undefined ? {name: patch.name} : {}),
        type: patch.type as PropertyField['type'],
        attrs: {
            display_name: patch.displayName.trim() || undefined,
            options: buildPatchOptionsAttr(patch.type, patch.options),
            ldap: patch.ldapAttr || null,
            saml: patch.samlAttr || null,
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
export function createLinkedAttributeField(
    objectType: ResourceObjectType,
    name: string,
    fieldType: AttributeFieldType,
    displayName: string,
    linkedFieldId: string,
): Promise<PropertyField> {
    return Client4.createPropertyField(GLOBAL_ATTRIBUTES_GROUP_NAME, objectType, {
        name,
        type: fieldType as PropertyField['type'],
        target_type: GLOBAL_ATTRIBUTES_TARGET_TYPE,
        target_id: '',
        linked_field_id: linkedFieldId,
        attrs: {
            display_name: displayName.trim() || undefined,
        },
    });
}

// Deletes a linked field for one Applies-to resource. Must be called before
// deleteAttributeField on the template it points at -- the server blocks
// deleting a template with active linked dependents.
export function deleteLinkedAttributeField(objectType: ResourceObjectType, fieldId: string): Promise<unknown> {
    return Client4.deletePropertyField(GLOBAL_ATTRIBUTES_GROUP_NAME, objectType, fieldId);
}
