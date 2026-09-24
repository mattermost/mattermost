// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Dispatch} from 'redux';

import type {PropertyField, PropertyFieldOption, PropertyPermissionLevel} from '@mattermost/types/properties';

import {GeneralTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';

import {ALL_RESOURCE_TYPES} from './attribute_details/attribute_applies_to_constants';
import type {ResourceObjectType} from './attribute_details/attribute_applies_to_constants';
import {GLOBAL_ATTRIBUTES_GROUP_NAME, GLOBAL_ATTRIBUTES_OBJECT_TYPE, GLOBAL_ATTRIBUTES_TARGET_TYPE} from './constants';

const USER_RESOURCE_OBJECT_TYPE: ResourceObjectType = 'user';

// Attribute Management writes user attributes through the generic property-fields
// API, which never touches the custom profile attribute slice that User
// Management, the profile popover and Account Settings → Profile all read. The
// server also omits the saving connection from property_field_* broadcasts, so
// the admin who made the change gets no websocket event of their own. Without
// mirroring the write here, every one of those surfaces in that admin's tab
// stays stale until a reload. A field returned from the create/patch call
// carries its authoritative option list (unlike the stripped broadcast), so it
// can be stored as-is.
export function syncUserAttributeFieldUpsert(dispatch: Dispatch, field: PropertyField, created: boolean): void {
    if (field.object_type !== USER_RESOURCE_OBJECT_TYPE) {
        return;
    }
    dispatch({
        type: created ? GeneralTypes.CUSTOM_PROFILE_ATTRIBUTE_FIELD_CREATED : GeneralTypes.CUSTOM_PROFILE_ATTRIBUTE_FIELD_PATCHED,
        data: field,
    });
}

export function syncUserAttributeFieldDelete(dispatch: Dispatch, objectType: string, fieldId: string): void {
    if (objectType !== USER_RESOURCE_OBJECT_TYPE) {
        return;
    }
    dispatch({type: GeneralTypes.CUSTOM_PROFILE_ATTRIBUTE_FIELD_DELETED, data: fieldId});
}

export type AttributeFieldType = 'text' | 'select' | 'multiselect' | 'rank' | 'graph';

export const ATTRIBUTE_FIELD_TYPES: readonly AttributeFieldType[] = ['text', 'select', 'multiselect', 'rank', 'graph'];

export function isAttributeFieldType(value: string): value is AttributeFieldType {
    return (ATTRIBUTE_FIELD_TYPES as readonly string[]).includes(value);
}

// Server clamps per_page to this max (web.PerPageMaximum). Directory-mode
// listing with no cursor sorts CreateAt ASC, so a default 60-item page can
// miss a freshly created field.
const MAX_PROPERTY_FIELDS_PER_PAGE = 200;

// Builds the attrs.options payload for the given type: {id: '', name} for
// Select/Multiselect (id is a required string on PropertyFieldOption, but the
// server always generates the real one -- EnsureOptionIDs /
// sanitizeAndValidateOptions); {id: '', name, rank} for Rank, with rank always
// explicitly present (never inferred from array position -- the server's
// validateRankOptions hard-errors on create if it's missing); {id: '', name,
// parents} for Graph, with parents always present (roots send [] — omitting
// the key is a server no-op). Text has no options key at all.
export function buildOptionsAttr(fieldType: AttributeFieldType, options: PropertyFieldOption[]): PropertyFieldOption[] | undefined {
    switch (fieldType) {
    case 'select':
    case 'multiselect':
        return options.map(({name}) => ({id: '', name}));
    case 'rank':
        return options.map(({name, rank}) => ({id: '', name, rank}));
    case 'graph':
        return options.map(({name, parents}) => ({id: '', name, parents: parents ?? []}));
    default:
        return undefined;
    }
}

// Patch keeps existing option IDs so stored values stay attached. New options
// still send an empty id for the server to mint. Other option properties
// (color, rank, …) are spread through: mergeAttrs replaces the whole options
// array, so omitting them would drop chip colors on a standalone channel
// select. Graph always sends parents (roots send [] — omitting the key is a
// server no-op). Text sends null so mergeAttrs drops a leftover options key
// when switching away from Select/Multiselect/Rank/Graph.
function buildPatchOptionsAttr(fieldType: AttributeFieldType, options: PropertyFieldOption[]): PropertyFieldOption[] | null {
    switch (fieldType) {
    case 'select':
    case 'multiselect':
    case 'rank':
        return options.map((option) => ({...option, id: option.id || ''}));
    case 'graph':
        return options.map((option) => ({...option, id: option.id || '', parents: option.parents ?? []}));
    case 'text':
        return null;
    default: {
        const exhaustive: never = fieldType;
        return exhaustive;
    }
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

// There is no GET-by-id property-fields HTTP handler. List every object type a
// field can live in and find the one whose id matches. A user/channel/post
// field only counts when it isn't a template's linked child (linked_field_id
// set) -- those aren't listed or edited on their own, so an id that only
// resolves to one returns undefined and the details page redirects to the list.
//
// includeChannel is false below Enterprise Advanced (or with the ChannelAttributes
// flag off): the server 501s a channel-scoped access_control GET there, and
// fetching it unconditionally would reject the whole Promise.all and bounce every
// details page to the list -- even one editing a user or template field.
export async function fetchAttributeField(fieldId: string, includeChannel: boolean): Promise<PropertyField | undefined> {
    const objectTypes = [GLOBAL_ATTRIBUTES_OBJECT_TYPE, ...ALL_RESOURCE_TYPES.filter((type) => includeChannel || type !== 'channel')];
    const pages = await Promise.all(
        objectTypes.map((objectType) => listPropertyFields(objectType)),
    );
    return pages.flat().find((field) => (
        field.id === fieldId &&
        field.delete_at === 0 &&
        (field.object_type === GLOBAL_ATTRIBUTES_OBJECT_TYPE || !field.linked_field_id)
    ));
}

function isResourceObjectType(value: string): value is ResourceObjectType {
    return (ALL_RESOURCE_TYPES as string[]).includes(value);
}

// Lists user/channel/post fields and keeps those pointing at the template.
// There is no cross-object-type listing endpoint.
//
// includeChannel matches fetchAttributeField: false below Enterprise Advanced
// (or with the ChannelAttributes flag off). That earlier fetch's own skip does
// not protect this later Promise.all; a 501 on the channel scope would reject
// the whole load and bounce the template details page to the list.
export async function fetchLinkedFieldsForTemplate(templateFieldId: string, includeChannel: boolean): Promise<PropertyField[]> {
    const objectTypes = ALL_RESOURCE_TYPES.filter((type) => includeChannel || type !== 'channel');
    const pages = await Promise.all(
        objectTypes.map((objectType) => listPropertyFields(objectType)),
    );
    return pages.flat().filter((field) => (
        field.linked_field_id === templateFieldId &&
        field.delete_at === 0 &&
        isResourceObjectType(field.object_type)
    ));
}

export function appliedResourceTypesByTemplateId(linkedFields: PropertyField[]): Record<string, ResourceObjectType[]> {
    const present = new Map<string, Set<ResourceObjectType>>();
    for (const field of linkedFields) {
        if (!field.linked_field_id || field.delete_at !== 0 || !isResourceObjectType(field.object_type)) {
            continue;
        }
        let types = present.get(field.linked_field_id);
        if (!types) {
            types = new Set();
            present.set(field.linked_field_id, types);
        }
        types.add(field.object_type);
    }

    const byTemplate: Record<string, ResourceObjectType[]> = {};
    for (const [templateId, types] of present) {
        byTemplate[templateId] = ALL_RESOURCE_TYPES.filter((type) => types.has(type));
    }
    return byTemplate;
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

// Attrs are merge-patched (mergeAttrs=true on the server): ldap/saml send
// null to unlink, and Text sends options: null so a leftover options array
// is dropped. name is omitted when unchanged so the server skips uniqueness
// re-validation.
export function updateAttributeField(
    objectType: string,
    fieldId: string,
    patch: UpdateAttributeFieldPatch,
): Promise<PropertyField> {
    return Client4.patchPropertyField(GLOBAL_ATTRIBUTES_GROUP_NAME, objectType, fieldId, {
        ...(patch.name === undefined ? {} : {name: patch.name}),
        type: patch.type as PropertyField['type'],
        attrs: {
            display_name: patch.displayName.trim() || undefined,
            options: buildPatchOptionsAttr(patch.type, patch.options),
            ldap: patch.ldapAttr || null,
            saml: patch.samlAttr || null,
        },
    });
}

// The server returns 409 when the field still has active linked dependents
// (CountLinkedFields > 0); callers are expected to surface that case distinctly
// (or, for a save-time rollback, to only delete linked fields first -- see
// createLinkedAttributeField).
export function deleteAttributeField(objectType: string, fieldId: string): Promise<unknown> {
    return Client4.deletePropertyField(GLOBAL_ATTRIBUTES_GROUP_NAME, objectType, fieldId);
}

// Creates a linked field for one Applies-to resource. The server validates
// linked_field_id against the template and copies its Type and attrs.options
// onto the new field (server/channels/app/properties/property_field.go) --
// display_name is NOT copied, so it's sent explicitly here. objectType is the
// resource type ('user'/'channel'/'post'), a URL path segment on the generic
// property-fields endpoint, not a separate route.
//
// `attrs` is what the resource's own settings contribute -- e.g. a Users row's
// Profile display config, or a Channels row's required/change-policy attrs
// (buildChannelFieldAttrs) -- bundled directly into the create request so the
// row is never created bare and then immediately patched. Trailing and
// optional so a resource type with no config panel yet keeps calling this
// unchanged.
//
// `permissionValues` sets the field's actual write-permission tier -- a
// top-level PropertyField field, not part of attrs. The server would
// otherwise inherit this from the template (always sysadmin), overriding
// whatever the caller picked; passing it explicitly here is honored for a
// linked field (see server/channels/app/properties/property_field.go).
// Omitting it takes the server's own per-object-type default.
export function createLinkedAttributeField(
    objectType: ResourceObjectType,
    name: string,
    fieldType: AttributeFieldType,
    displayName: string,
    linkedFieldId: string,
    attrs?: Record<string, unknown>,
    permissionValues?: PropertyPermissionLevel,
): Promise<PropertyField> {
    return Client4.createPropertyField(GLOBAL_ATTRIBUTES_GROUP_NAME, objectType, {
        name,
        type: fieldType as PropertyField['type'],
        target_type: GLOBAL_ATTRIBUTES_TARGET_TYPE,
        target_id: '',
        linked_field_id: linkedFieldId,
        ...(permissionValues ? {permission_values: permissionValues} : {}),
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

// PATCHes a linked field's config for an already-persisted Applies-to
// resource (e.g. a Users row's Profile display, or a Channels row's own
// settings, changed after the row itself was already saved). Attrs are
// merge-patched (mergeAttrs=true on the server, same as updateAttributeField
// above) -- only the keys present in `attrs` are updated, everything else on
// the field is left untouched.
//
// permissionValues patches the field's actual write-permission tier -- see
// createLinkedAttributeField above for why this is a top-level field, not
// part of attrs.
export function patchLinkedAttributeField(
    objectType: ResourceObjectType,
    fieldId: string,
    attrs?: Record<string, unknown>,
    permissionValues?: PropertyPermissionLevel,
): Promise<PropertyField> {
    return Client4.patchPropertyField(GLOBAL_ATTRIBUTES_GROUP_NAME, objectType, fieldId, {
        ...(attrs ? {attrs} : {}),
        ...(permissionValues ? {permission_values: permissionValues} : {}),
    });
}

export function formatAttributeHeadingName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
        return trimmed;
    }
    return trimmed.charAt(0).toLocaleUpperCase() + trimmed.slice(1);
}
