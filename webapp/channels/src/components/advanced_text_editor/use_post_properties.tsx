// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';
import type {FieldType, PropertyField} from '@mattermost/types/properties';

import {createChannelPostPropertyField, patchPostPropertyValues} from 'mattermost-redux/actions/properties';
import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';
import {getPostPropertyFieldsForChannel} from 'mattermost-redux/selectors/entities/properties';

import type {SubmitPostReturnType} from 'actions/views/create_comment';

import type {DispatchFunc, GlobalState} from 'types/store';

import NewPropertyForm from './post_property_picker/new_property_form';
import type {NewPropertyData} from './post_property_picker/new_property_form';
import PostPropertyPicker from './post_property_picker/post_property_picker';
import StagedPropertyChips from './post_property_picker/staged_property_chips';
import type {StagedPropertyItem} from './post_property_picker/types';

const EMPTY_FIELDS: PropertyField[] = [];

const usePostProperties = (channelId: string, rootId: string, disabled: boolean) => {
    const dispatch = useDispatch<DispatchFunc>();

    const integratedBoardsEnabled = useSelector(
        (state: GlobalState) => getFeatureFlagValue(state, 'IntegratedBoards') === 'true',
    );

    const fields = useSelector((state: GlobalState) => (
        integratedBoardsEnabled ? getPostPropertyFieldsForChannel(state, channelId) : EMPTY_FIELDS
    ));

    const [stagedItems, setStagedItems] = useState<StagedPropertyItem[]>([]);
    const [showNewFieldForm, setShowNewFieldForm] = useState(false);

    const stagedFieldIds = useMemo(() => stagedItems.map((i) => i.field_id), [stagedItems]);

    const handleToggleStaged = useCallback((fieldId: string) => {
        setStagedItems((current) => {
            if (current.some((i) => i.field_id === fieldId)) {
                return current.filter((i) => i.field_id !== fieldId);
            }
            return [...current, {field_id: fieldId, value: undefined}];
        });
    }, []);

    const handleRemoveStaged = useCallback((fieldId: string) => {
        setStagedItems((current) => current.filter((i) => i.field_id !== fieldId));
    }, []);

    const handleChangeStagedValue = useCallback((fieldId: string, value: unknown) => {
        setStagedItems((current) => current.map(
            (i) => (i.field_id === fieldId ? {...i, value} : i),
        ));
    }, []);

    const clearStaged = useCallback(() => {
        setStagedItems([]);
    }, []);

    const handleAddNewClick = useCallback(() => {
        setShowNewFieldForm(true);
    }, []);

    const handleCancelNewField = useCallback(() => {
        setShowNewFieldForm(false);
    }, []);

    const handleCreateField = useCallback(async (data: NewPropertyData) => {
        const result = await dispatch(createChannelPostPropertyField(channelId, {
            name: data.name,
            type: data.type as FieldType,
            attrs: data.options ? {options: data.options} : undefined,
        }));

        if (!result.error && result.data) {
            setStagedItems((current) => [
                ...current,
                {field_id: result.data!.id, value: undefined},
            ]);
        }

        setShowNewFieldForm(false);
    }, [dispatch, channelId]);

    const onAfterSubmit = useCallback((response: SubmitPostReturnType) => {
        // The type says created?: boolean but at runtime it's the created Post object.
        const createdPost = (response as unknown as {created?: Post}).created;
        const realPostId = createdPost && typeof createdPost === 'object' ? createdPost.id : undefined;

        const itemsToPatch = stagedItems.filter((i) => i.value !== undefined);
        if (realPostId && itemsToPatch.length > 0) {
            dispatch(patchPostPropertyValues(realPostId, itemsToPatch));
        }

        clearStaged();
    }, [dispatch, stagedItems, clearStaged]);

    const additionalControl = useMemo(() => {
        if (!integratedBoardsEnabled || rootId) {
            return undefined;
        }
        return (
            <PostPropertyPicker
                key='post-property-picker'
                fields={fields}
                stagedFieldIds={stagedFieldIds}
                onToggleStaged={handleToggleStaged}
                onAddNewClick={handleAddNewClick}
                disabled={disabled}
            />
        );
    }, [integratedBoardsEnabled, rootId, fields, stagedFieldIds, handleToggleStaged, handleAddNewClick, disabled]);

    const stagedChips = useMemo(() => {
        if (!integratedBoardsEnabled || rootId || stagedItems.length === 0) {
            return undefined;
        }
        return (
            <StagedPropertyChips
                fields={fields}
                stagedItems={stagedItems}
                onRemove={handleRemoveStaged}
                onChangeValue={handleChangeStagedValue}
            />
        );
    }, [integratedBoardsEnabled, rootId, fields, stagedItems, handleRemoveStaged, handleChangeStagedValue]);

    const newFieldForm = useMemo(() => {
        if (!integratedBoardsEnabled || rootId || !showNewFieldForm) {
            return undefined;
        }
        return (
            <NewPropertyForm
                onSave={handleCreateField}
                onCancel={handleCancelNewField}
            />
        );
    }, [integratedBoardsEnabled, rootId, showNewFieldForm, handleCreateField, handleCancelNewField]);

    return {
        stagedItems,
        clearStaged,
        onAfterSubmit,
        additionalControl,
        stagedChips,
        newFieldForm,

        // Exposed for testing staged state setup
        handleToggleStagedForTest: handleToggleStaged,
        handleChangeStagedValueForTest: handleChangeStagedValue,
    };
};

export default usePostProperties;
