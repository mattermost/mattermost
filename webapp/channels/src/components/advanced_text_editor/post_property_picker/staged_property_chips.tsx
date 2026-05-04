// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {forwardRef, useCallback} from 'react';
import {useIntl} from 'react-intl';

import {CloseIcon} from '@mattermost/compass-icons/components';
import type {PropertyField} from '@mattermost/types/properties';

import PropertyValueEditor from 'components/property_value_editor';
import PropertyChipPopover from 'components/property_value_editor/property_chip_popover';
import {renderPropertyValue} from 'components/property_value_editor/render_property_value';
import PropertyTypeIcon from 'components/property_value_editor/type_icon';

import type {StagedPropertyItem} from './types';

import './staged_property_chips.scss';

export type Props = {
    fields: PropertyField[];
    stagedItems: StagedPropertyItem[];
    onRemove: (fieldId: string) => void;
    onChangeValue?: (fieldId: string, value: unknown) => void;
};

type TriggerProps = {
    field: PropertyField;
    value: unknown;
    editLabel: string;
};

const ChipTrigger = forwardRef<HTMLButtonElement, TriggerProps>(({field, value, editLabel, ...rest}, ref) => {
    const {formatMessage} = useIntl();

    const summary = renderPropertyValue(field, value);
    const placeholder = formatMessage(
        {id: 'staged_property_chip.placeholder', defaultMessage: 'Set {name}'},
        {name: field.name},
    );

    return (
        <button
            ref={ref}
            type='button'
            className='staged-property-chip__trigger'
            aria-label={editLabel}
            {...rest}
        >
            <span className='staged-property-chip__icon'>
                <PropertyTypeIcon type={field.type}/>
            </span>
            <span className='staged-property-chip__name'>{field.name}</span>
            {summary ? (
                <span className='staged-property-chip__value'>{summary}</span>
            ) : (
                <span className='staged-property-chip__placeholder'>{placeholder}</span>
            )}
        </button>
    );
});

ChipTrigger.displayName = 'ChipTrigger';

function StagedChip({field, value, onRemove, onChangeValue}: {
    field: PropertyField;
    value: unknown;
    onRemove: (id: string) => void;
    onChangeValue?: (fieldId: string, value: unknown) => void;
}) {
    const {formatMessage} = useIntl();
    const handleRemove = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onRemove(field.id);
    }, [field.id, onRemove]);
    const handleChange = useCallback((next: unknown) => {
        onChangeValue?.(field.id, next);
    }, [field.id, onChangeValue]);

    const removeLabel = formatMessage(
        {id: 'post_property_picker.remove', defaultMessage: 'Remove {name}'},
        {name: field.name},
    );
    const editLabel = formatMessage(
        {id: 'staged_property_chip.edit', defaultMessage: 'Edit {name}'},
        {name: field.name},
    );

    const triggerEl = (
        <ChipTrigger
            field={field}
            value={value}
            editLabel={editLabel}
        />
    );

    return (
        <span
            className='staged-property-chip'
            data-property-field-id={field.id}
        >
            {onChangeValue ? (
                <PropertyChipPopover trigger={triggerEl}>
                    {() => (
                        <div className='staged-property-chip__editor'>
                            <PropertyValueEditor
                                field={field}
                                value={value}
                                onChange={handleChange}
                            />
                        </div>
                    )}
                </PropertyChipPopover>
            ) : triggerEl}
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

export default function StagedPropertyChips({fields, stagedItems, onRemove, onChangeValue}: Props) {
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
                    onChangeValue={onChangeValue}
                />
            ))}
        </div>
    );
}
