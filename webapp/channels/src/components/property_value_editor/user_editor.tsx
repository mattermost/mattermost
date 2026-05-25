// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect} from 'react';
import {useDispatch} from 'react-redux';

import {getProfilesInChannel} from 'mattermost-redux/actions/users';

import type {PropertyValueEditorProps} from './types';
import UserPicker from './user_picker';

function toUserIds(value: unknown, multi: boolean): string[] {
    if (multi) {
        if (Array.isArray(value)) {
            return value.filter((id): id is string => typeof id === 'string' && id.length > 0);
        }
        return [];
    }
    if (typeof value === 'string' && value.length > 0) {
        return [value];
    }
    return [];
}

export default function UserEditor({field, value, onChange, multi = false}: PropertyValueEditorProps & {multi?: boolean}) {
    const channelId = field.target_id;
    const dispatch = useDispatch();

    useEffect(() => {
        // Ensure the channel's members are in Redux so the picker has rows to show.
        dispatch(getProfilesInChannel(channelId, 0));
    }, [channelId, dispatch]);

    const handleChange = useCallback((ids: string[]) => {
        if (multi) {
            onChange(ids);
            return;
        }
        onChange(ids[0] ?? '');
    }, [multi, onChange]);

    return (
        <div
            className='property-value-editor property-value-editor--user'
            data-property-field-id={field.id}
        >
            <UserPicker
                channelId={channelId}
                multi={multi}
                selectedIds={toUserIds(value, multi)}
                onChange={handleChange}
            />
        </div>
    );
}
