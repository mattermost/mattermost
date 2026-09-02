// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {Post} from '@mattermost/types/posts';
import type {PropertyField, PropertyFieldsState, PropertyGroupsState, PropertyValue, PropertyValuesState} from '@mattermost/types/properties';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import {PostTypes, PropertyTypes, UserTypes} from 'mattermost-redux/action_types';
import {isPSAv1PropertyField} from 'mattermost-redux/utils/property_utils';

const initialFieldsState: PropertyFieldsState = {
    byObjectType: {},
    byId: {},
};

const initialValuesState: PropertyValuesState = {
    byTargetId: {},
    byFieldId: {},
};

const initialGroupsState: PropertyGroupsState = {
    byId: {},
    byName: {},
};

function fieldsReducer(
    state: PropertyFieldsState = initialFieldsState,
    action: MMReduxAction,
): PropertyFieldsState {
    switch (action.type) {
    case PropertyTypes.RECEIVED_PROPERTY_FIELDS: {
        const fields: PropertyField[] = action.data.fields;
        if (fields.length === 0) {
            return state;
        }

        const nextById = {...state.byId};
        const nextByObjectType = {...state.byObjectType};
        let changed = false;

        for (const field of fields) {
            if (isPSAv1PropertyField(field)) {
                continue;
            }

            changed = true;
            const objectType = field.object_type;
            const groupId = field.group_id;

            nextById[field.id] = field;

            if (!nextByObjectType[objectType]) {
                nextByObjectType[objectType] = {};
            } else if (
                nextByObjectType[objectType] ===
                    state.byObjectType[objectType]
            ) {
                nextByObjectType[objectType] = {
                    ...nextByObjectType[objectType],
                };
            }

            if (!nextByObjectType[objectType][groupId]) {
                nextByObjectType[objectType][groupId] = {};
            } else if (
                nextByObjectType[objectType][groupId] ===
                    state.byObjectType[objectType]?.[groupId]
            ) {
                nextByObjectType[objectType][groupId] = {
                    ...nextByObjectType[objectType][groupId],
                };
            }

            if (field.delete_at > 0) {
                Reflect.deleteProperty(nextByObjectType[objectType][groupId], field.id);
            } else {
                nextByObjectType[objectType][groupId][field.id] = field;
            }
        }

        if (!changed) {
            return state;
        }

        return {byObjectType: nextByObjectType, byId: nextById};
    }

    case PropertyTypes.RECEIVED_PROPERTY_FIELDS_FOR_SCOPE: {
        // Authoritative full refetch for one (objectType, groupId) scope, dispatched
        // only by fetchPropertyFields. Unlike RECEIVED_PROPERTY_FIELDS (an incremental
        // merge, also used for single-field websocket create/update events, where
        // replacing the whole scope would wipe out sibling fields), this replaces the
        // bucket outright so fields deleted server-side between fetches don't linger.
        //
        // Keyed by (objectType, groupId) only, coarser than the actual fetch scope
        // (groupName, objectType, targetType, targetId). Every current caller uses a
        // fixed targetId per (objectType, groupId) pair; if a future caller varies
        // targetId for the same pair, this key needs to widen too, or the two targets'
        // fields will clobber each other.
        const {objectType, groupId, fields}: {objectType: string; groupId: string; fields: PropertyField[]} = action.data;

        const existingBucket = state.byObjectType[objectType]?.[groupId] ?? {};
        const nextBucket: Record<string, PropertyField> = {};

        for (const field of fields) {
            if (isPSAv1PropertyField(field) || field.delete_at > 0) {
                continue;
            }
            nextBucket[field.id] = field;
        }

        const existingIds = Object.keys(existingBucket);
        const nextIds = Object.keys(nextBucket);

        if (existingIds.length === 0 && nextIds.length === 0) {
            return state;
        }

        const nextById = {...state.byId};
        for (const id of existingIds) {
            if (!nextBucket[id]) {
                Reflect.deleteProperty(nextById, id);
            }
        }
        for (const field of Object.values(nextBucket)) {
            nextById[field.id] = field;
        }

        const nextByObjectType = {...state.byObjectType};
        if (nextIds.length === 0) {
            if (nextByObjectType[objectType]) {
                nextByObjectType[objectType] = {...nextByObjectType[objectType]};
                Reflect.deleteProperty(nextByObjectType[objectType], groupId);
                if (Object.keys(nextByObjectType[objectType]).length === 0) {
                    Reflect.deleteProperty(nextByObjectType, objectType);
                }
            }
        } else {
            nextByObjectType[objectType] = {
                ...nextByObjectType[objectType],
                [groupId]: nextBucket,
            };
        }

        return {byObjectType: nextByObjectType, byId: nextById};
    }

    case PropertyTypes.PROPERTY_FIELD_DELETED: {
        const {fieldId} = action.data;
        const field = state.byId[fieldId];
        if (!field) {
            return state;
        }

        const objectType = field.object_type;
        const groupId = field.group_id;

        const nextById = {...state.byId};
        Reflect.deleteProperty(nextById, fieldId);

        const nextByObjectType = {...state.byObjectType};
        nextByObjectType[objectType] = {...nextByObjectType[objectType]};
        nextByObjectType[objectType][groupId] = {
            ...nextByObjectType[objectType][groupId],
        };
        Reflect.deleteProperty(
            nextByObjectType[objectType][groupId],
            fieldId,
        );

        // Clean up empty buckets
        if (
            Object.keys(nextByObjectType[objectType][groupId]).length === 0
        ) {
            Reflect.deleteProperty(nextByObjectType[objectType], groupId);
            if (Object.keys(nextByObjectType[objectType]).length === 0) {
                Reflect.deleteProperty(nextByObjectType, objectType);
            }
        }

        return {byObjectType: nextByObjectType, byId: nextById};
    }

    case UserTypes.LOGOUT_SUCCESS:
        return initialFieldsState;

    default:
        return state;
    }
}

/**
 * Merges values into the store.
 *
 * Two skips, both correctness rather than optimisation:
 *
 * - A value strictly older than the stored one is dropped.
 * - Tombstones are never stored. PROPERTY_VALUE_DELETED and its siblings are how a
 *   deletion reaches this slice.
 */
function mergeValues(state: PropertyValuesState, values: Array<PropertyValue<unknown>>): PropertyValuesState {
    let nextByTargetId: PropertyValuesState['byTargetId'] | undefined;
    let nextByFieldId: PropertyValuesState['byFieldId'] | undefined;

    for (const value of values) {
        const {target_id: targetId, field_id: fieldId} = value;

        if (!targetId || !fieldId || value.delete_at > 0) {
            continue;
        }

        const stored = state.byTargetId[targetId]?.[fieldId];
        if (stored && stored.id === value.id && stored.update_at > value.update_at) {
            continue;
        }

        if (!nextByTargetId) {
            nextByTargetId = {...state.byTargetId};
            nextByFieldId = {...state.byFieldId};
        }

        // byTargetId
        if (!nextByTargetId[targetId]) {
            nextByTargetId[targetId] = {};
        } else if (nextByTargetId[targetId] === state.byTargetId[targetId]) {
            nextByTargetId[targetId] = {...nextByTargetId[targetId]};
        }
        nextByTargetId[targetId][fieldId] = value;

        // byFieldId
        if (!nextByFieldId![fieldId]) {
            nextByFieldId![fieldId] = {};
        } else if (nextByFieldId![fieldId] === state.byFieldId[fieldId]) {
            nextByFieldId![fieldId] = {...nextByFieldId![fieldId]};
        }
        nextByFieldId![fieldId][targetId] = value;
    }

    if (!nextByTargetId) {
        return state;
    }

    return {byTargetId: nextByTargetId, byFieldId: nextByFieldId!};
}

/**
 * Lifts hydrated property values out of a batch of posts.
 *
 * `action.data.posts` is a record on most paths but an array on others
 * (getPostsByIds, the thread actions), which is why this normalises both — the same
 * reason the files reducer calls Object.values on it.
 */
function valuesFromPosts(posts: Post[] | Record<string, Post>): Array<PropertyValue<unknown>> {
    const list = Array.isArray(posts) ? posts : Object.values(posts ?? {});

    return list.flatMap((post) => post?.metadata?.property_values ?? []);
}

function valuesReducer(
    state: PropertyValuesState = initialValuesState,
    action: MMReduxAction,
): PropertyValuesState {
    switch (action.type) {
    case PropertyTypes.RECEIVED_PROPERTY_VALUES:
        return mergeValues(state, action.data.values ?? []);

    // Hydrated post fetches carry a post's property values on its metadata, the same
    // way they carry its files — and the files reducer lifts those into the files
    // slice from exactly these three action types.
    //
    // This MUST only ever merge. `property_values` is omitempty on the wire, so a post
    // arriving without the key is indistinguishable between "hydrated, has no values"
    // and "not hydrated at all" — and the second is the common case, since search,
    // pinned posts and websocket-delivered posts are never hydrated.
    case PostTypes.RECEIVED_NEW_POST:
    case PostTypes.RECEIVED_POST:
        return mergeValues(state, valuesFromPosts([action.data]));

    case PostTypes.RECEIVED_POSTS:
        return mergeValues(state, valuesFromPosts(action.data?.posts));

    case PropertyTypes.PROPERTY_VALUE_DELETED: {
        const {targetId, fieldId} = action.data;

        if (!state.byTargetId[targetId]?.[fieldId]) {
            return state;
        }

        const nextByTargetId = {...state.byTargetId};
        nextByTargetId[targetId] = {...nextByTargetId[targetId]};
        Reflect.deleteProperty(nextByTargetId[targetId], fieldId);
        if (Object.keys(nextByTargetId[targetId]).length === 0) {
            Reflect.deleteProperty(nextByTargetId, targetId);
        }

        const nextByFieldId = {...state.byFieldId};
        if (nextByFieldId[fieldId]) {
            nextByFieldId[fieldId] = {...nextByFieldId[fieldId]};
            Reflect.deleteProperty(nextByFieldId[fieldId], targetId);
            if (Object.keys(nextByFieldId[fieldId]).length === 0) {
                Reflect.deleteProperty(nextByFieldId, fieldId);
            }
        }

        return {byTargetId: nextByTargetId, byFieldId: nextByFieldId};
    }

    case PropertyTypes.PROPERTY_FIELD_DELETED:
    case PropertyTypes.PROPERTY_VALUES_DELETED_FOR_FIELD: {
        const {fieldId} = action.data;
        const affectedTargets = state.byFieldId[fieldId];
        if (!affectedTargets) {
            return state;
        }

        const nextByTargetId = {...state.byTargetId};
        for (const targetId of Object.keys(affectedTargets)) {
            nextByTargetId[targetId] = {...nextByTargetId[targetId]};
            Reflect.deleteProperty(nextByTargetId[targetId], fieldId);
            if (Object.keys(nextByTargetId[targetId]).length === 0) {
                Reflect.deleteProperty(nextByTargetId, targetId);
            }
        }

        const nextByFieldId = {...state.byFieldId};
        Reflect.deleteProperty(nextByFieldId, fieldId);

        return {byTargetId: nextByTargetId, byFieldId: nextByFieldId};
    }

    case PropertyTypes.PROPERTY_VALUES_DELETED_FOR_TARGET: {
        const {targetId} = action.data;
        const affectedFields = state.byTargetId[targetId];
        if (!affectedFields) {
            return state;
        }

        const nextByFieldId = {...state.byFieldId};
        for (const fieldId of Object.keys(affectedFields)) {
            if (nextByFieldId[fieldId]) {
                nextByFieldId[fieldId] = {...nextByFieldId[fieldId]};
                Reflect.deleteProperty(nextByFieldId[fieldId], targetId);
                if (Object.keys(nextByFieldId[fieldId]).length === 0) {
                    Reflect.deleteProperty(nextByFieldId, fieldId);
                }
            }
        }

        const nextByTargetId = {...state.byTargetId};
        Reflect.deleteProperty(nextByTargetId, targetId);

        return {byTargetId: nextByTargetId, byFieldId: nextByFieldId};
    }

    case UserTypes.LOGOUT_SUCCESS:
        return initialValuesState;

    default:
        return state;
    }
}

function groupsReducer(
    state: PropertyGroupsState = initialGroupsState,
    action: MMReduxAction,
): PropertyGroupsState {
    switch (action.type) {
    case PropertyTypes.RECEIVED_PROPERTY_GROUP: {
        const group = action.data;
        return {
            byId: {...state.byId, [group.id]: group},
            byName: {...state.byName, [group.name]: group},
        };
    }

    case UserTypes.LOGOUT_SUCCESS:
        return initialGroupsState;

    default:
        return state;
    }
}

export default combineReducers({
    fields: fieldsReducer,
    values: valuesReducer,
    groups: groupsReducer,
});
