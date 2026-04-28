// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

export type Props = {
    postId: string;
    fields: PropertyField[];
    valuesByFieldId: {[fieldId: string]: PropertyValue<unknown>};
    loadPostPropertyValues: (postId: string) => unknown;
};

function isFilled(raw: unknown): boolean {
    if (raw === null || raw === undefined) {
        return false;
    }
    if (typeof raw === 'string') {
        return raw.length > 0;
    }
    if (Array.isArray(raw)) {
        return raw.length > 0;
    }
    return true;
}

function formatValue(raw: unknown): string {
    if (Array.isArray(raw)) {
        return raw.map((v) => String(v)).join(', ');
    }
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
        return String(raw);
    }
    return JSON.stringify(raw);
}

export default function PostPropertyChips({postId, fields, valuesByFieldId, loadPostPropertyValues}: Props) {
    useEffect(() => {
        loadPostPropertyValues(postId);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [postId]);

    const chips = fields.
        map((field) => ({field, value: valuesByFieldId[field.id]})).
        filter(({value}) => value && isFilled(value.value));

    if (chips.length === 0) {
        return null;
    }

    return (
        <div className='post__property-chips'>
            {chips.map(({field, value}) => (
                <span
                    key={field.id}
                    className='property-chip'
                    data-property-field-id={field.id}
                >
                    <span className='property-chip__name'>{field.name}</span>
                    <span className='property-chip__value'>{formatValue(value.value)}</span>
                </span>
            ))}
        </div>
    );
}
