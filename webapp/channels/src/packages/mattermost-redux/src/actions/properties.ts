// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';
import {getPropertyGroupByName} from 'mattermost-redux/selectors/entities/properties';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import PropertyTypes from '../action_types/properties';

// Guards fetchPropertyFields against out-of-order resolution: if two fetches for the
// same scope are in flight and the older one resolves after the newer one, its stale
// result would otherwise get reconciled into the store as if it were current — merging
// stale fields back via RECEIVED_PROPERTY_FIELDS, or wiping out fields the newer fetch
// (or a websocket event) already reconciled via RECEIVED_PROPERTY_FIELDS_FOR_SCOPE. Both
// dispatches are skipped entirely once a newer fetch for the same scope has started.
// Keyed on the exact fetch params, not just (objectType, groupId), since different
// targetIds are independent in-flight requests.
const latestFetchSeqByScope = new Map<string, number>();

function scopeKey(groupName: string, objectType: string, targetType: string, targetId?: string): string {
    return `${groupName}|${objectType}|${targetType}|${targetId ?? ''}`;
}

/**
 * Fetches property fields for a given group, object type, and target scope,
 * then stores them in the Redux property fields state.
 */
export function fetchPropertyFields(
    groupName: string,
    objectType: string,
    targetType: string,
    targetId?: string,
): ActionFuncAsync<PropertyField[]> {
    return async (dispatch, getState) => {
        const key = scopeKey(groupName, objectType, targetType, targetId);
        const seq = (latestFetchSeqByScope.get(key) ?? 0) + 1;
        latestFetchSeqByScope.set(key, seq);

        let fields: PropertyField[] = [];
        const maxItems = 500;
        let fetched = 0;
        let cursorId: string | undefined;
        let cursorCreateAt: number | undefined;

        while (fetched < maxItems) {
            // eslint-disable-next-line no-await-in-loop
            const page = await Client4.getPropertyFields(
                groupName,
                objectType,
                targetType,
                targetId,
                {cursorId, cursorCreateAt},
            );
            fields = fields.concat(page);

            if (page.length === 0) {
                break;
            }

            fetched += page.length;
            const last = page[page.length - 1];
            cursorId = last.id;
            cursorCreateAt = last.create_at;
        }

        // A newer fetch for the same scope started after this one; let it win instead of
        // reconciling this stale result into the store.
        if (latestFetchSeqByScope.get(key) !== seq) {
            return {data: fields};
        }

        dispatch({
            type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
            data: {fields},
        });

        // Fields are stored keyed by their real group UUID, so expose the
        // name -> group mapping that consumers use to resolve that id.
        if (fields.length > 0) {
            dispatch({
                type: PropertyTypes.RECEIVED_PROPERTY_GROUP,
                data: {id: fields[0].group_id, name: groupName},
            });
        }

        // Resolve the scope's groupId even when nothing came back, so an empty result
        // can still clear a previously-cached, now-fully-deleted scope. Falls back to
        // the cached name -> id mapping from an earlier fetch; if that's not known
        // either, there's nothing cached yet for this scope to clear.
        const groupId = fields[0]?.group_id ?? getPropertyGroupByName(getState(), groupName)?.id;

        if (groupId) {
            dispatch({
                type: PropertyTypes.RECEIVED_PROPERTY_FIELDS_FOR_SCOPE,
                data: {objectType, groupId, fields},
            });
        }

        return {data: fields};
    };
}

/**
 * Patches a single property field's attrs and, on success, reconciles the
 * returned field into the Redux property fields state via an upsert.
 */
export function patchPropertyField(
    groupName: string,
    objectType: string,
    fieldId: string,
    patch: Partial<PropertyField> & Record<string, unknown>,
): ActionFuncAsync<PropertyField> {
    return async (dispatch) => {
        let field: PropertyField;
        try {
            field = await Client4.patchPropertyField(groupName, objectType, fieldId, patch);
        } catch (error) {
            return {error};
        }

        dispatch({
            type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
            data: {fields: [field]},
        });

        return {data: field};
    };
}

/**
 * Patches one or more property values for a target, then reconciles the result
 * into Redux. A null-valued patch is a clear: the server upserts a null-valued
 * row rather than emitting a delete, so this dispatches PROPERTY_VALUE_DELETED
 * itself for each cleared field rather than storing the null value verbatim.
 */
export function patchPropertyValues(
    groupName: string,
    objectType: string,
    targetId: string,
    patches: Array<{field_id: string; value: unknown}>,
): ActionFuncAsync<Array<PropertyValue<unknown>>> {
    return async (dispatch) => {
        let values: Array<PropertyValue<unknown>>;
        try {
            values = await Client4.patchPropertyValues(groupName, objectType, targetId, patches);
        } catch (error) {
            return {error};
        }

        const clearedFieldIds = new Set(patches.filter((patch) => patch.value === null).map((patch) => patch.field_id));

        for (const fieldId of clearedFieldIds) {
            dispatch({
                type: PropertyTypes.PROPERTY_VALUE_DELETED,
                data: {targetId, fieldId},
            });
        }

        const kept = values.filter((value) => !clearedFieldIds.has(value.field_id));
        if (kept.length > 0) {
            dispatch({
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: kept},
            });
        }

        return {data: values};
    };
}

/**
 * Fetches all system-scoped property values for a given group via the
 * dedicated `/system/values` endpoint, then stores them in Redux.
 */
export function fetchSystemPropertyValues<T = unknown>(
    groupName: string,
): ActionFuncAsync<Array<PropertyValue<T>>> {
    return async (dispatch) => {
        const values =
            (await Client4.getSystemPropertyValues<T>(groupName)) ?? [];

        dispatch({
            type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
            data: {values},
        });

        return {data: values};
    };
}

/**
 * Fetches a target's property values for a given group and object type, then
 * stores them in Redux. Used to repair a target after a websocket broadcast
 * withheld a non-public value: the client can't be handed the value over the
 * wire, so it refetches through the read path, which masks it the same way.
 */
export function fetchPropertyValues<T = unknown>(
    groupName: string,
    objectType: string,
    targetId: string,
): ActionFuncAsync<Array<PropertyValue<T>>> {
    return async (dispatch) => {
        const values = await Client4.getPropertyValues<T>(groupName, objectType, targetId);

        dispatch({
            type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
            data: {values},
        });

        return {data: values};
    };
}
