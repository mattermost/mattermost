// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyFieldOption, PropertyGroup, PropertyValue} from '@mattermost/types/properties';
import type {GlobalState} from '@mattermost/types/store';

import {
    ACCESS_CONTROL_PROPERTY_GROUP,
    CHANNEL_OBJECT_TYPE,
    DISPLAY_BANNER_BOTTOM,
    DISPLAY_BANNER_TOP,
    DISPLAY_LABEL_HEADER,
    DISPLAY_LABEL_INFO,
} from 'mattermost-redux/constants/properties';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {isPropertyValueSet} from 'mattermost-redux/utils/property_utils';

// Field selectors

function getPropertyFieldsById(state: GlobalState) {
    return state.entities.properties.fields.byId;
}

export const getPropertyFieldsForObjectTypeAndGroup = createSelector(
    'getPropertyFieldsForObjectTypeAndGroup',
    (state: GlobalState, objectType: string, groupId: string) => state.entities.properties.fields.byObjectType[objectType]?.[groupId],
    (fields) => {
        if (!fields) {
            return [];
        }
        return Object.values(fields);
    },
);

export function getPropertyFieldById(state: GlobalState, fieldId: string): PropertyField | undefined {
    return getPropertyFieldsById(state)[fieldId];
}

export const getPropertyFieldsByIds = createSelector(
    'getPropertyFieldsByIds',
    getPropertyFieldsById,
    (state: GlobalState, fieldIds: string[]) => fieldIds,
    (byId, fieldIds) => {
        return fieldIds.reduce<PropertyField[]>((acc, id) => {
            const field = byId[id];
            if (field) {
                acc.push(field);
            }
            return acc;
        }, []);
    },
);

// Group selectors

export function getPropertyGroupById(state: GlobalState, groupId: string): PropertyGroup | undefined {
    return state.entities.properties.groups.byId[groupId];
}

export function getPropertyGroupByName(state: GlobalState, name: string): PropertyGroup | undefined {
    return state.entities.properties.groups.byName[name];
}

// Value selectors

export const getPropertyValuesForTarget = createSelector(
    'getPropertyValuesForTarget',
    (state: GlobalState, targetId: string) => state.entities.properties.values.byTargetId[targetId],
    (targetValues) => {
        if (!targetValues) {
            return [];
        }
        return Object.values(targetValues);
    },
);

export function getPropertyValueForTargetField(
    state: GlobalState,
    targetId: string,
    fieldId: string,
): PropertyValue<unknown> | undefined {
    return state.entities.properties.values.byTargetId[targetId]?.[fieldId];
}

export const getPropertyValuesForTargetByFieldIds = createSelector(
    'getPropertyValuesForTargetByFieldIds',
    (state: GlobalState, targetId: string) => state.entities.properties.values.byTargetId[targetId],
    (state: GlobalState, targetId: string, fieldIds: string[]) => fieldIds,
    (targetValues, fieldIds) => {
        if (!targetValues) {
            return [];
        }
        return fieldIds.reduce<Array<PropertyValue<unknown>>>((acc, fieldId) => {
            const value = targetValues[fieldId];
            if (value) {
                acc.push(value);
            }
            return acc;
        }, []);
    },
);

export const getPropertyValuesForField = createSelector(
    'getPropertyValuesForField',
    (state: GlobalState, fieldId: string) => state.entities.properties.values.byFieldId[fieldId],
    (fieldValues) => {
        if (!fieldValues) {
            return [];
        }
        return Object.values(fieldValues);
    },
);

// Channel attribute selectors

const EMPTY_FIELDS: PropertyField[] = [];

// Ties break on name, not create_at: chip order is something people are told to
// read, so it must follow the configuration rather than insertion timing.
function sortByFieldOrder(fields: PropertyField[]): PropertyField[] {
    return [...fields].sort((a, b) => {
        const rankA = typeof a.attrs?.sort_order === 'number' ? a.attrs.sort_order : Number.MAX_SAFE_INTEGER;
        const rankB = typeof b.attrs?.sort_order === 'number' ? b.attrs.sort_order : Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) {
            return rankA - rankB;
        }

        // Fixed locale: the default is the viewer's, which would order equal-ranked
        // chips differently per user. Names are ASCII slugs, so this is total.
        return a.name.localeCompare(b.name, 'en');
    });
}

/**
 * Channel-object fields in the access_control group, ordered by attrs.sort_order.
 *
 * Fields are stored under the group's UUID, so the group has to be resolved by
 * name first. That mapping only exists once something has fetched fields for the
 * group, hence the empty result rather than a throw while it is still loading.
 */
export const getChannelAttributeFields: (state: GlobalState) => PropertyField[] = createSelector(
    'getChannelAttributeFields',
    (state: GlobalState) => getPropertyGroupByName(state, ACCESS_CONTROL_PROPERTY_GROUP)?.id,
    (state: GlobalState) => state.entities.properties.fields.byObjectType[CHANNEL_OBJECT_TYPE],
    (groupId, byGroup) => {
        if (!groupId) {
            return EMPTY_FIELDS;
        }
        const fields = byGroup?.[groupId];
        if (!fields) {
            return EMPTY_FIELDS;
        }
        const live = Object.values(fields).filter((field) => field.delete_at === 0);
        return live.length === 0 ? EMPTY_FIELDS : sortByFieldOrder(live);
    },
);

/**
 * The subset designated for display as a channel label. Designation lives on the
 * field and is system-wide, so this takes no channel.
 */
export const getChannelLabelFields: (state: GlobalState) => PropertyField[] = createSelector(
    'getChannelLabelFields',
    getChannelAttributeFields,
    (fields) => {
        const labels = fields.filter((field) => {
            const actions = field.attrs?.actions;
            return Array.isArray(actions) && actions.some((action) => action === DISPLAY_LABEL_HEADER || action === DISPLAY_LABEL_INFO);
        });
        return labels.length === 0 ? EMPTY_FIELDS : labels;
    },
);

/**
 * The subset designated for the channel banner, in display order. Every one of them
 * belongs in the same banner: designation is the admin saying this must be on screen,
 * so a second designated attribute adds to the banner rather than losing to the first.
 */
export const getChannelBannerFields: (state: GlobalState) => PropertyField[] = createSelector(
    'getChannelBannerFields',
    getChannelAttributeFields,
    (fields) => {
        const banners = fields.filter((field) => {
            const actions = field.attrs?.actions;
            return Array.isArray(actions) && actions.some((action) => action === DISPLAY_BANNER_TOP || action === DISPLAY_BANNER_BOTTOM);
        });
        return banners.length === 0 ? EMPTY_FIELDS : banners;
    },
);

export type ResolvedChannelAttribute = {
    field: PropertyField;
    value?: PropertyValue<unknown>;

    // Resolved option for select-shaped fields, absent for text fields or when
    // the stored option id no longer exists on the field.
    option?: PropertyFieldOption;

    // Display string, empty when the attribute is unset. A null or empty stored
    // value counts as unset: the server keeps a null-valued row after a
    // user-initiated clear rather than deleting it.
    displayValue: string;

    // Individual display strings — one entry per value. Multiselect fields
    // produce one entry per selected option; all other types produce a
    // single-element array matching displayValue. Empty when the attribute is unset.
    displayValues: string[];
};

const EMPTY_RESOLVED: ResolvedChannelAttribute[] = [];

function resolveDisplayValue(field: PropertyField, raw: unknown): {option?: PropertyFieldOption; displayValue: string; displayValues: string[]} {
    if (!isPropertyValueSet(raw)) {
        return {displayValue: '', displayValues: []};
    }

    const options = (field.attrs?.options as PropertyFieldOption[] | undefined) ?? [];

    if (Array.isArray(raw)) {
        const names = raw.
            map((id) => options.find((option) => option.id === id)?.name ?? String(id));
        return {displayValue: names.join(', '), displayValues: names};
    }

    if (typeof raw !== 'string') {
        const s = String(raw);
        return {displayValue: s, displayValues: [s]};
    }

    const option = options.find((candidate) => candidate.id === raw);
    if (option) {
        return {option, displayValue: option.name, displayValues: [option.name]};
    }

    // Text fields store the display string directly. A select field whose option
    // was deleted lands here too and renders the raw id, which is wrong but
    // visible — better than silently dropping a marking.
    return {displayValue: raw, displayValues: [raw]};
}

/**
 * Every channel attribute paired with this channel's value, in display order.
 * Fields with no value are included with an empty displayValue so callers can
 * choose whether to render them.
 *
 * A factory because the result depends on channelId and the memoizer only keeps
 * the last arguments: a shared instance would recompute — and return a new
 * array — every time two channels alternate. One instance per consumer.
 */
export function makeGetResolvedChannelAttributes(): (state: GlobalState, channelId: string) => ResolvedChannelAttribute[] {
    return createSelector(
        'makeGetResolvedChannelAttributes',
        getChannelAttributeFields,
        (state: GlobalState, channelId: string) => state.entities.properties.values.byTargetId[channelId],
        (fields, valuesByFieldId) => {
            if (fields.length === 0) {
                return EMPTY_RESOLVED;
            }
            return fields.map((field) => {
                const value = valuesByFieldId?.[field.id];
                return {field, value, ...resolveDisplayValue(field, value?.value)};
            });
        },
    );
}
