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

type ChipButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    field: PropertyField;
    summary: React.ReactElement | null;
};

const StagedChipButton = forwardRef<HTMLButtonElement, ChipButtonProps>(
    function StagedChipButton({field, summary, ...rest}, ref) {
        const hasValue = Boolean(summary);
        return (
            <button
                ref={ref}
                type='button'
                className={`staged-property-chip${hasValue ? ' staged-property-chip--filled' : ''}`}
                data-property-field-id={field.id}
                {...rest}
            >
                <span className='staged-property-chip__icon'>
                    <PropertyTypeIcon
                        type={field.type}
                        size={14}
                    />
                </span>
                <span className='staged-property-chip__label'>
                    {summary ?? (
                        <span className='staged-property-chip__empty'>
                            {`${field.name}…`}
                        </span>
                    )}
                </span>
            </button>
        );
    },
);

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

    const summary = renderPropertyValue(field, value);

    const triggerEl = (
        <StagedChipButton
            field={field}
            summary={summary}
            aria-label={editLabel}
        />
    );

    return (
        <span className='staged-property-chip-wrapper'>
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
                <CloseIcon size={10}/>
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
