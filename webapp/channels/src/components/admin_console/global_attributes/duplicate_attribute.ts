// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Dispatch} from 'redux';

import type {PropertyField, PropertyFieldOption, PropertyPermissionLevel} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';
import {getPropertyFieldLabel} from 'mattermost-redux/utils/property_utils';

import {pageAllAccessControlFieldOptions} from 'components/property_fields/graph/page_all_access_control_field_options';

import Constants from 'utils/constants';
import {CPA_FIELD_NAME_MAX_RUNES} from 'utils/properties';

import {CHANNEL_VALUE_SETTER, buildChannelFieldAttrs, parseChannelFieldConfig} from './applies_to/channels/channel_field_payload';
import type {ResourceObjectType, UserManagedValue} from './attribute_details/attribute_applies_to_constants';
import {getAttributeTypeDescriptor} from './attribute_type';
import {GLOBAL_ATTRIBUTES_OBJECT_TYPE} from './constants';
import {
    createAttributeField,
    createLinkedAttributeField,
    deleteAttributeField,
    deleteLinkedAttributeField,
    fetchLinkedFieldsForTemplate,
    linkedFieldsByResourceType,
    syncUserAttributeFieldDelete,
    syncUserAttributeFieldUpsert,
} from './utils';

const COPY_DISPLAY_PREFIX = 'Copy of ';
const COPY_NAME_SUFFIX = '_copy';

function optionsFromField(field: PropertyField): PropertyFieldOption[] {
    const raw = field.attrs?.options;
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw.filter((option): option is PropertyFieldOption => (
        typeof option === 'object' &&
        option !== null &&
        typeof (option as PropertyFieldOption).id === 'string' &&
        typeof (option as PropertyFieldOption).name === 'string'
    ));
}

// Graph fields always withhold parents on the field GET; large select lists may
// arrive with options_omitted. Both need the options endpoint.
export async function loadOptionsForDuplicate(field: PropertyField): Promise<PropertyFieldOption[]> {
    if (field.type === 'graph' || field.attrs?.options_omitted === true) {
        return pageAllAccessControlFieldOptions({id: field.id, object_type: field.object_type});
    }
    return optionsFromField(field);
}

export function buildDuplicateDisplayName(sourceLabel: string): string {
    const available = Constants.MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH - COPY_DISPLAY_PREFIX.length;
    const label = sourceLabel.trim();
    if (label.length <= available) {
        return `${COPY_DISPLAY_PREFIX}${label}`;
    }
    return `${COPY_DISPLAY_PREFIX}${label.slice(0, Math.max(0, available))}`;
}

// Prefers `{name}_copy`; on collision uses `{name}_copy2`, `{name}_copy3`, …
// and truncates the base so the result stays within the CEL name length cap.
export function buildDuplicateAttributeName(sourceName: string, existingNames: ReadonlySet<string>): string {
    const takenNames = new Set([...existingNames].map((name) => name.toLowerCase()));
    const taken = (candidate: string) => takenNames.has(candidate.toLowerCase());

    const first = truncateWithSuffix(sourceName, COPY_NAME_SUFFIX);
    if (!taken(first)) {
        return first;
    }

    for (let n = 2; ; n++) {
        const candidate = truncateWithSuffix(sourceName, `${COPY_NAME_SUFFIX}${n}`);
        if (!taken(candidate)) {
            return candidate;
        }
    }
}

function truncateWithSuffix(base: string, suffix: string): string {
    const maxBase = Math.max(0, CPA_FIELD_NAME_MAX_RUNES - [...suffix].length);
    return `${[...base].slice(0, maxBase).join('')}${suffix}`;
}

async function existingTemplateNames(): Promise<Set<string>> {
    const names = new Set<string>();
    let cursorId: string | undefined;
    let cursorCreateAt: number | undefined;

    while (true) {
        // eslint-disable-next-line no-await-in-loop
        const page = await Client4.getPropertyFields(
            'access_control',
            GLOBAL_ATTRIBUTES_OBJECT_TYPE,
            {
                targetType: 'system',
                perPage: 200,
                cursorId,
                cursorCreateAt,
            },
        );
        for (const field of page) {
            if (field.delete_at === 0) {
                names.add(field.name.toLowerCase());
            }
        }
        if (page.length === 0 || page.length < 200) {
            break;
        }
        const last = page[page.length - 1];
        cursorId = last.id;
        cursorCreateAt = last.create_at;
    }

    return names;
}

function linkedCreatePayload(type: ResourceObjectType, linked: PropertyField): {
    attrs?: Record<string, unknown>;
    permissionValues?: PropertyPermissionLevel;
} {
    switch (type) {
    case 'user': {
        const rawVisibility = linked.attrs?.visibility;
        const visibility = rawVisibility === 'always' || rawVisibility === 'when_set' || rawVisibility === 'hidden' ? rawVisibility : 'when_set';
        const managed: UserManagedValue = linked.attrs?.managed === 'admin' ? 'admin' : '';
        return {
            attrs: {visibility, managed},
            permissionValues: managed === 'admin' ? 'sysadmin' : 'member',
        };
    }
    case 'channel':
        return {
            attrs: buildChannelFieldAttrs(parseChannelFieldConfig(linked)),
            permissionValues: CHANNEL_VALUE_SETTER,
        };
    default:
        return {};
    }
}

export type DuplicateAttributeResult =
    | {ok: true; field: PropertyField}
    | {ok: false; error: unknown};

// Creates a template copy of `source` without ldap/saml/openid links. Options
// are copied for select-like types. `resourceTypes` selects which linked
// resource fields to recreate (config copied; sync links are not).
export async function duplicateAttribute(
    dispatch: Dispatch,
    source: PropertyField,
    resourceTypes: readonly ResourceObjectType[],
    allowedResourceTypes: readonly ResourceObjectType[],
): Promise<DuplicateAttributeResult> {
    const typeId = getAttributeTypeDescriptor(source).id;
    const displayName = buildDuplicateDisplayName(getPropertyFieldLabel(source));
    const options = await loadOptionsForDuplicate(source);
    const name = buildDuplicateAttributeName(source.name, await existingTemplateNames());

    let templateField: PropertyField;
    try {
        // No external source links — duplicate starts as Managed here.
        templateField = await createAttributeField(displayName, name, typeId, options);
    } catch (error) {
        return {ok: false, error};
    }

    if (resourceTypes.length === 0) {
        return {ok: true, field: templateField};
    }

    let linkedByType: Partial<Record<ResourceObjectType, PropertyField>> = {};
    try {
        const linkedFields = await fetchLinkedFieldsForTemplate(source.id, allowedResourceTypes);
        linkedByType = linkedFieldsByResourceType(linkedFields);
    } catch (error) {
        try {
            await deleteAttributeField(GLOBAL_ATTRIBUTES_OBJECT_TYPE, templateField.id);
        } catch {
            // Best-effort cleanup of the orphaned template.
        }
        return {ok: false, error};
    }

    const createdLinkedFields: Array<{type: ResourceObjectType; field: PropertyField}> = [];

    for (const type of resourceTypes) {
        const sourceLinked = linkedByType[type];
        if (!sourceLinked) {
            continue;
        }

        const {attrs, permissionValues} = linkedCreatePayload(type, sourceLinked);
        try {
            // eslint-disable-next-line no-await-in-loop
            const linkedField = await createLinkedAttributeField(
                type,
                name,
                typeId,
                displayName,
                templateField.id,
                attrs,
                permissionValues,
            );
            createdLinkedFields.push({type, field: linkedField});
            syncUserAttributeFieldUpsert(dispatch, linkedField, true);
        } catch (error) {
            for (const created of createdLinkedFields) {
                try {
                    // eslint-disable-next-line no-await-in-loop
                    await deleteLinkedAttributeField(created.type, created.field.id);
                    syncUserAttributeFieldDelete(dispatch, created.type, created.field.id);
                } catch {
                    // Continue cleaning up the rest.
                }
            }
            try {
                await deleteAttributeField(GLOBAL_ATTRIBUTES_OBJECT_TYPE, templateField.id);
            } catch {
                // Template may still exist if a linked delete failed.
            }
            return {ok: false, error};
        }
    }

    return {ok: true, field: templateField};
}
