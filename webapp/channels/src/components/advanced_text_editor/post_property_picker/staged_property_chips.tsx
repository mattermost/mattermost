// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import {CloseIcon} from '@mattermost/compass-icons/components';
import type {PropertyField} from '@mattermost/types/properties';

import type {StagedPropertyItem} from './types';

export type Props = {
    fields: PropertyField[];
    stagedItems: StagedPropertyItem[];
    onRemove: (fieldId: string) => void;
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

function StagedChip({field, value, onRemove}: {field: PropertyField; value: unknown; onRemove: (id: string) => void}) {
    const {formatMessage} = useIntl();
    const handleRemove = useCallback(() => onRemove(field.id), [field.id, onRemove]);

    const removeLabel = formatMessage(
        {id: 'post_property_picker.remove', defaultMessage: 'Remove {name}'},
        {name: field.name},
    );

    return (
        <span
            className='staged-property-chip'
            data-property-field-id={field.id}
        >
            <span className='staged-property-chip__name'>{field.name}</span>
            {isFilled(value) && (
                <span className='staged-property-chip__value'>{formatValue(value)}</span>
            )}
            <button
                type='button'
                className='staged-property-chip__remove'
                aria-label={removeLabel}
                onClick={handleRemove}
            >
                <CloseIcon size={14}/>
            </button>
        </span>
    );
}

export default function StagedPropertyChips({fields, stagedItems, onRemove}: Props) {
    const fieldsById = new Map(fields.map((f) => [f.id, f]));

    const visibleItems = stagedItems.
        map((item) => ({field: fieldsById.get(item.field_id), value: item.value})).
        filter((entry): entry is {field: PropertyField; value: unknown} => Boolean(entry.field));

    if (visibleItems.length === 0) {
        return null;
    }

    return (
        <div className='staged-property-chips'>
            {visibleItems.map(({field, value}) => (
                <StagedChip
                    key={field.id}
                    field={field}
                    value={value}
                    onRemove={onRemove}
                />
            ))}
        </div>
    );
}
