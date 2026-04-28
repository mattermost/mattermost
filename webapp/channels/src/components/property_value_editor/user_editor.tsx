// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';

import {UserSelector} from 'components/admin_console/content_flagging/user_multiselector/user_multiselector';

import type {PropertyValueEditorProps} from './types';

function toUserId(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }
    return '';
}

export default function UserEditor({field, value, onChange}: PropertyValueEditorProps) {
    const handleSelect = useCallback((userId: string) => {
        onChange(userId || '');
    }, [onChange]);

    return (
        <div
            className='property-value-editor property-value-editor--user'
            data-property-field-id={field.id}
        >
            <UserSelector
                id={`user-editor-${field.id}`}
                isMulti={false}
                isClearable={true}
                singleSelectOnChange={handleSelect}
                singleSelectInitialValue={toUserId(value)}
            />
        </div>
    );
}
