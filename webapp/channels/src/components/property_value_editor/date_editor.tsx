// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';

import type {PropertyValueEditorProps} from './types';

function toDisplayString(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }
    return '';
}

export default function DateEditor({field, value, onChange}: PropertyValueEditorProps) {
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const next = e.target.value;
        onChange(next === '' ? undefined : next);
    }, [onChange]);

    return (
        <input
            type='date'
            className='property-value-editor property-value-editor--date'
            data-property-field-id={field.id}
            value={toDisplayString(value)}
            aria-label={field.name}
            onChange={handleChange}
        />
    );
}
