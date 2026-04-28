// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {useSelector} from 'react-redux';

import type {PropertyField} from '@mattermost/types/properties';

import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';
import {getPostPropertyFieldsForChannel} from 'mattermost-redux/selectors/entities/properties';

import type {GlobalState} from 'types/store';

import PostPropertyPicker from './post_property_picker/post_property_picker';
import StagedPropertyChips from './post_property_picker/staged_property_chips';
import type {StagedPropertyItem} from './post_property_picker/types';

const EMPTY_FIELDS: PropertyField[] = [];

const usePostProperties = (channelId: string, rootId: string, disabled: boolean) => {
    const integratedBoardsEnabled = useSelector(
        (state: GlobalState) => getFeatureFlagValue(state, 'IntegratedBoards') === 'true',
    );

    const fields = useSelector((state: GlobalState) => (
        integratedBoardsEnabled ? getPostPropertyFieldsForChannel(state, channelId) : EMPTY_FIELDS
    ));

    const [stagedItems, setStagedItems] = useState<StagedPropertyItem[]>([]);

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

    const clearStaged = useCallback(() => {
        setStagedItems([]);
    }, []);

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
                disabled={disabled}
            />
        );
    }, [integratedBoardsEnabled, rootId, fields, stagedFieldIds, handleToggleStaged, disabled]);

    const stagedChips = useMemo(() => {
        if (!integratedBoardsEnabled || rootId || stagedItems.length === 0) {
            return undefined;
        }
        return (
            <StagedPropertyChips
                fields={fields}
                stagedItems={stagedItems}
                onRemove={handleRemoveStaged}
            />
        );
    }, [integratedBoardsEnabled, rootId, fields, stagedItems, handleRemoveStaged]);

    return {
        stagedItems,
        clearStaged,
        additionalControl,
        stagedChips,
    };
};

export default usePostProperties;
