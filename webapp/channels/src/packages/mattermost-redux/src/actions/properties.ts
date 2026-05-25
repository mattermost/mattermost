// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import type {
    PropertyField,
    PropertyFieldCreate,
    PropertyFieldPatch,
    PropertyValue,
    PropertyValuePatchItem,
} from '@mattermost/types/properties';

import {PropertyTypes} from 'mattermost-redux/action_types';
import {logError} from 'mattermost-redux/actions/errors';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';
import {ChannelPostPropertyGroupName} from 'mattermost-redux/constants/properties';
import {getPropertyGroupByName} from 'mattermost-redux/selectors/entities/properties';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

const POST_OBJECT_TYPE = 'post';
const CHANNEL_TARGET_TYPE = 'channel';

const loadedChannelPostFields = new Set<string>();
const loadedPostValues = new Set<string>();

export function resetLoadedChannelPostFields() {
    loadedChannelPostFields.clear();
}

export function resetLoadedPostValues() {
    loadedPostValues.clear();
}

function dispatchReceivedFields(dispatch: any, fields: PropertyField[], groupName?: string) {
    if (fields.length === 0) {
        return;
    }
    const actions: any[] = [{
        type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
        data: {fields},
    }];
    if (groupName) {
        actions.push({
            type: PropertyTypes.RECEIVED_PROPERTY_GROUP,
            data: {
                id: fields[0].group_id,
                name: groupName,
            },
        });
    }
    dispatch(batchActions(actions));
}

/**
 * Fetches property fields for a given group, object type, and target scope,
 * then stores them in the Redux property fields state. General-purpose
 * paginated fetch added from master; coexists with the channel-post-scoped
 * loadChannelPostPropertyFields below.
 */
export function fetchPropertyFields(
    groupName: string,
    objectType: string,
    targetType: string,
    targetId?: string,
): ActionFuncAsync<PropertyField[]> {
    return async (dispatch) => {
        let fields: PropertyField[] = [];
        const maxItems = 500;
        let fetched = 0;
        let cursorId: string | undefined;
        let cursorCreateAt: number | undefined;

        while (fetched < maxItems) {
            // eslint-disable-next-line no-await-in-loop
            const page = (await Client4.getPropertyFields(
                groupName,
                objectType,
                targetType,
                targetId,
                {cursorId, cursorCreateAt},
            )) ?? [];
            fields = fields.concat(page);

            if (page.length === 0) {
                break;
            }

            fetched += page.length;
            const last = page[page.length - 1];
            cursorId = last.id;
            cursorCreateAt = last.create_at;
        }

        dispatch({
            type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
            data: {fields},
        });

        return {data: fields};
    };
}

export function loadChannelPostPropertyFields(channelId: string): ActionFuncAsync<PropertyField[]> {
    return async (dispatch, getState) => {
        if (loadedChannelPostFields.has(channelId)) {
            return {data: []};
        }
        loadedChannelPostFields.add(channelId);

        let fields: PropertyField[];
        try {
            fields = (await Client4.getPropertyFields(
                ChannelPostPropertyGroupName,
                POST_OBJECT_TYPE,
                CHANNEL_TARGET_TYPE,
                channelId,
            )) ?? [];
        } catch (error) {
            loadedChannelPostFields.delete(channelId);
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        // Register the group on first successful load so callers can resolve
        // it from state without a separate lookup.
        const haveGroup = Boolean(getPropertyGroupByName(getState(), ChannelPostPropertyGroupName));
        dispatchReceivedFields(dispatch, fields, haveGroup ? undefined : ChannelPostPropertyGroupName);

        return {data: fields};
    };
}

export function loadPostPropertyValues(postId: string): ActionFuncAsync<Array<PropertyValue<unknown>>> {
    return async (dispatch, getState) => {
        if (loadedPostValues.has(postId)) {
            return {data: []};
        }
        loadedPostValues.add(postId);

        let values: Array<PropertyValue<unknown>>;
        try {
            values = (await Client4.getPropertyValues<unknown>(
                ChannelPostPropertyGroupName,
                POST_OBJECT_TYPE,
                postId,
            )) ?? [];
        } catch (error) {
            loadedPostValues.delete(postId);
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        if (values.length > 0) {
            dispatch({
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values},
            });
        }

        return {data: values};
    };
}

export function createChannelPostPropertyField(
    channelId: string,
    field: Pick<PropertyFieldCreate, 'name' | 'type' | 'attrs'>,
): ActionFuncAsync<PropertyField> {
    return async (dispatch, getState) => {
        let created: PropertyField;
        try {
            created = await Client4.createPropertyField(
                ChannelPostPropertyGroupName,
                POST_OBJECT_TYPE,
                {
                    ...field,
                    target_type: CHANNEL_TARGET_TYPE,
                    target_id: channelId,
                },
            );
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const haveGroup = Boolean(getPropertyGroupByName(getState(), ChannelPostPropertyGroupName));
        dispatchReceivedFields(dispatch, [created], haveGroup ? undefined : ChannelPostPropertyGroupName);

        return {data: created};
    };
}

export function patchChannelPostPropertyField(fieldId: string, patch: PropertyFieldPatch): ActionFuncAsync<PropertyField> {
    return async (dispatch, getState) => {
        let updated: PropertyField;
        try {
            updated = await Client4.patchPropertyField(
                ChannelPostPropertyGroupName,
                POST_OBJECT_TYPE,
                fieldId,
                patch,
            );
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
            data: {fields: [updated]},
        });

        return {data: updated};
    };
}

export function deleteChannelPostPropertyField(fieldId: string): ActionFuncAsync<true> {
    return async (dispatch, getState) => {
        try {
            await Client4.deletePropertyField(
                ChannelPostPropertyGroupName,
                POST_OBJECT_TYPE,
                fieldId,
            );
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: PropertyTypes.PROPERTY_FIELD_DELETED,
            data: {fieldId},
        });

        return {data: true};
    };
}

export function patchPostPropertyValues(
    postId: string,
    items: PropertyValuePatchItem[],
): ActionFuncAsync<Array<PropertyValue<unknown>>> {
    return async (dispatch, getState) => {
        let values: Array<PropertyValue<unknown>>;
        try {
            values = (await Client4.patchPropertyValues<unknown>(
                ChannelPostPropertyGroupName,
                POST_OBJECT_TYPE,
                postId,
                items,
            )) ?? [];
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        if (values.length > 0) {
            dispatch({
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values},
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
