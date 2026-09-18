// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import {LockOutlineIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import PostAttributeText from './post_attribute_text';
import PostAttributeValueControl, {hasValueControl} from './post_attribute_value_control';
import {fieldLabel, hasValue} from './utils';

type Props = {
    field: PropertyField;
    value?: PropertyValue<unknown>;
    canEdit: boolean;
    writing: boolean;
    onChange: (fieldId: string, next: unknown) => void;
};

/**
 * One attribute in the edit modal: a plain-text label, a value, and a trailing
 * slot for the trash button.
 *
 * Four cases, and the trailing slot is reserved in all of them — a slot that
 * only exists when the button is drawn reflows the row on hover.
 *
 * | Case | Label | Value | Trash |
 * |---|---|---|---|
 * | Writable, set | plain text | control | yes, revealed on row hover or its own focus |
 * | Writable, unset (`always`) | plain text | empty control | no — nothing to clear |
 * | Locked | plain text + padlock | read-only text | no |
 * | Writing | plain text | control, disabled | disabled |
 *
 * Omitted rather than disabled in the locked and unset cases: a disabled button
 * on half the rows is a control the user has to learn to ignore.
 */
export default function PostAttributesModalRow({field, value, canEdit, writing, onChange}: Props) {
    const {formatMessage} = useIntl();

    const label = fieldLabel(field);
    const editable = canEdit && hasValueControl(field);
    const showClear = editable && hasValue(value);

    // Clearing writes an empty value rather than deleting the row.
    const handleClear = useCallback(() => onChange(field.id, ''), [field.id, onChange]);

    const lockedTitle = formatMessage({
        id: 'post_attributes.modal.locked',
        defaultMessage: 'This is a system-level property and cannot be modified.',
    });

    return (
        <div
            className='PostAttributesModalRow'
            data-testid={`post-attribute-row-${field.name}`}
        >
            <span className='PostAttributesModalRow__label'>
                <span className='PostAttributesModalRow__labelText'>{label}</span>
                {!canEdit && (
                    <span
                        className='PostAttributesModalRow__lock'
                        role='img'
                        aria-label={lockedTitle}
                        title={lockedTitle}
                    >
                        <LockOutlineIcon size={12}/>
                    </span>
                )}
            </span>
            <div
                className='PostAttributesModalRow__value'
                aria-busy={writing || undefined}
            >
                {editable ? (
                    <PostAttributeValueControl
                        field={field}
                        value={value}
                        disabled={writing}
                        onChange={onChange}
                    />
                ) : value && (
                    <PostAttributeText
                        field={field}
                        value={value}
                    />
                )}
            </div>

            <div className='PostAttributesModalRow__trailing'>
                {showClear && (
                    <button
                        type='button'
                        className='PostAttributesModalRow__clear'
                        data-testid={`post-attribute-clear-${field.name}`}
                        disabled={writing}

                        // Named after the attribute, so a modal with five rows does
                        // not hand a screen reader five buttons called "Clear".
                        aria-label={formatMessage(
                            {
                                id: 'post_attributes.modal.clear',
                                defaultMessage: 'Clear {attribute}',
                            },
                            {attribute: label},
                        )}
                        onClick={handleClear}
                    >
                        <TrashCanOutlineIcon size={14}/>
                    </button>
                )}
            </div>
        </div>
    );
}
