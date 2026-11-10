// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';
import type {IntlShape} from 'react-intl';
import type {Dispatch} from 'redux';

import type {PropertyField, PropertyFieldOption, PropertyPermissionLevel} from '@mattermost/types/properties';

import {getPropertyFieldLabel} from 'mattermost-redux/utils/property_utils';

import {pageAllAccessControlFieldOptions} from 'components/property_fields/graph/page_all_access_control_field_options';

import Constants from 'utils/constants';
import {CPA_FIELD_NAME_MAX_RUNES, slugifyForCEL, validateCPAFieldName} from 'utils/properties';

import {CHANNEL_VALUE_SETTER, buildChannelFieldAttrs, parseChannelFieldConfig} from './applies_to/channels/channel_field_payload';
import type {ResourceObjectType, UserManagedValue} from './attribute_details/attribute_applies_to_constants';
import {getAttributeTypeDescriptor} from './attribute_type';
import {GLOBAL_ATTRIBUTES_OBJECT_TYPE} from './constants';
import {
    createAttributeField,
    createLinkedAttributeField,
    deleteAttributeField,
    deleteLinkedAttributeField,
    linkedFieldsByResourceType,
    listPropertyFields,
    syncUserAttributeFieldDelete,
    syncUserAttributeFieldUpsert,
} from './utils';

const COPY_NAME_SUFFIX = '_copy';

const messages = defineMessages({
    displayName: {
        id: 'admin.global_attributes.duplicate.display_name',
        defaultMessage: 'Copy of {name}',
    },
    displayNameNumbered: {
        id: 'admin.global_attributes.duplicate.display_name_numbered',
        defaultMessage: 'Copy of {name} ({number})',
    },
});

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

// `copyNumber` matches the name's suffix (1 for `_copy`, n for `_copyN`) so
// repeated copies stay distinguishable in the listing. The source label is
// shortened, never the localized wrapper, to fit the display-name cap.
export function buildDuplicateDisplayName(
    sourceLabel: string,
    copyNumber: number,
    formatMessage: IntlShape['formatMessage'],
): string {
    const format = (name: string) => (copyNumber > 1 ? formatMessage(messages.displayNameNumbered, {name, number: copyNumber}) : formatMessage(messages.displayName, {name}));
    const available = Math.max(0, Constants.MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH - [...format('')].length);
    const label = [...sourceLabel.trim()].slice(0, available).join('');
    return format(label);
}

// Prefers `{name}_copy`; on collision uses `{name}_copy2`, `{name}_copy3`, …
// and truncates the base so the result stays within the CEL name length cap.
// A legacy name the server would now reject on create is slugified first.
export function buildDuplicateAttributeName(sourceName: string, existingNames: ReadonlySet<string>): {name: string; copyNumber: number} {
    const base = validateCPAFieldName(sourceName) ? slugifyForCEL(sourceName) : sourceName;
    const takenNames = new Set([...existingNames].map((name) => name.toLowerCase()));

    for (let copyNumber = 1; ; copyNumber++) {
        const name = truncateWithSuffix(base, copyNumber === 1 ? COPY_NAME_SUFFIX : `${COPY_NAME_SUFFIX}${copyNumber}`);
        if (!takenNames.has(name.toLowerCase())) {
            return {name, copyNumber};
        }
    }
}

function truncateWithSuffix(base: string, suffix: string): string {
    const maxBase = Math.max(0, CPA_FIELD_NAME_MAX_RUNES - [...suffix].length);
    return `${[...base].slice(0, maxBase).join('')}${suffix}`;
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

// `partial` means cleanup after a failure did not finish, so part of the copy
// is still on the server.
export type DuplicateAttributeResult = {ok: true; field: PropertyField} | {ok: false; error: unknown; partial: boolean};

export class MissingLinkedFieldError extends Error {
    constructor(public resourceType: ResourceObjectType) {
        super(`source attribute no longer applies to ${resourceType}`);
    }
}

// Creates a template copy of `source` without ldap/saml/openid links. Options
// are copied for select-like types. `resourceTypes` selects which linked
// resource fields to recreate (config copied; sync links are not).
//
// The new name must be free among templates and every resource type: a
// linked field shares its template's name, and the server checks uniqueness
// per object type, so a standalone user/channel/post field with that name
// would reject the linked create.
export async function duplicateAttribute(
    dispatch: Dispatch,
    source: PropertyField,
    resourceTypes: readonly ResourceObjectType[],
    allowedResourceTypes: readonly ResourceObjectType[],
    formatMessage: IntlShape['formatMessage'],
): Promise<DuplicateAttributeResult> {
    const typeId = getAttributeTypeDescriptor(source).id;
    let options: PropertyFieldOption[];
    let name: string;
    let displayName: string;
    let linkedByType: Partial<Record<ResourceObjectType, PropertyField>>;
    try {
        const [loadedOptions, templates, ...resourceFields] = await Promise.all([
            loadOptionsForDuplicate(source),
            listPropertyFields(GLOBAL_ATTRIBUTES_OBJECT_TYPE),
            ...allowedResourceTypes.map((type) => listPropertyFields(type)),
        ]);
        options = loadedOptions;

        const liveFields = [templates, ...resourceFields].flat().filter((field) => field.delete_at === 0);
        const generated = buildDuplicateAttributeName(source.name, new Set(liveFields.map((field) => field.name)));
        name = generated.name;
        displayName = buildDuplicateDisplayName(getPropertyFieldLabel(source), generated.copyNumber, formatMessage);
        linkedByType = linkedFieldsByResourceType(resourceFields.flat().filter((field) => (
            field.delete_at === 0 && field.linked_field_id === source.id
        )));
    } catch (error) {
        return {ok: false, error, partial: false};
    }

    const missing = resourceTypes.find((type) => !linkedByType[type]);
    if (missing) {
        return {ok: false, error: new MissingLinkedFieldError(missing), partial: false};
    }

    let templateField: PropertyField;
    try {
        // No external source links — duplicate starts as Managed here.
        templateField = await createAttributeField(displayName, name, typeId, options);
    } catch (error) {
        return {ok: false, error, partial: false};
    }

    const createdLinkedFields: Array<{type: ResourceObjectType; field: PropertyField}> = [];

    for (const type of resourceTypes) {
        const {attrs, permissionValues} = linkedCreatePayload(type, linkedByType[type]!);
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
            // eslint-disable-next-line no-await-in-loop
            const cleaned = await rollBack(dispatch, templateField.id, createdLinkedFields);
            return {ok: false, error, partial: !cleaned};
        }
    }

    return {ok: true, field: templateField};
}

// The server refuses to delete a template that still has linked fields, so
// the template is only attempted once all of them are gone.
async function rollBack(
    dispatch: Dispatch,
    templateFieldId: string,
    createdLinkedFields: Array<{type: ResourceObjectType; field: PropertyField}>,
): Promise<boolean> {
    let linkedRemain = false;
    for (const created of createdLinkedFields) {
        try {
            // eslint-disable-next-line no-await-in-loop
            await deleteLinkedAttributeField(created.type, created.field.id);
            syncUserAttributeFieldDelete(dispatch, created.type, created.field.id);
        } catch {
            linkedRemain = true;
        }
    }
    if (linkedRemain) {
        return false;
    }

    try {
        await deleteAttributeField(GLOBAL_ATTRIBUTES_OBJECT_TYPE, templateFieldId);
    } catch {
        return false;
    }
    return true;
}
