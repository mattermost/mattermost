// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useId} from 'react';
import {useIntl} from 'react-intl';

import {CloseIcon} from '@mattermost/compass-icons/components';
import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {getPropertyFieldLabel} from 'mattermost-redux/utils/property_utils';

import {resolveOptionChips} from 'utils/property_options';

import PostAttributeChip from './post_attribute_chip';
import PostAttributeValueControl from './post_attribute_value_control';
import PostAttributesFieldPicker from './post_attributes_field_picker';
import type {PostAttribute} from './utils';

// The composer's chips are the sent post's chips, sized and coloured by the
// same rules; the composer's own sheet only adds its layout on top.
import './post_attributes_chips.scss';
import './post_attributes_composer.scss';

type Props = {

    // The chips to draw and what the `+ Add attribute` control offers. Both
    // come from the editor's one `useComposerAttributes` call, shared with the
    // `+` in the action row.
    chips: PostAttribute[];
    addable: PropertyField[];
    justAdded: string | null;
    onAdd: (fieldId: string) => void;
    onChange: (fieldId: string, next: unknown) => void;
    onRemove: (fieldId: string) => void;
};

/**
 * The attributes staged in the composer: a chip per attribute above the message
 * box, plus a trailing `+ Add attribute` once anything is shown. Reuses the edit
 * modal's controls so both agree on what a field may hold.
 *
 * Fully controlled by `useStagedPostAttributes`, which the editor owns so it can
 * clear the staged state after a send and on a channel or thread switch.
 */
export default function PostAttributesComposer({chips, addable, justAdded, onAdd, onChange, onRemove}: Props) {
    const {formatMessage} = useIntl();

    // Each composer mounted at once (centre channel, thread sidebar) needs its
    // own DOM id for the add control.
    const addId = useId();

    if (chips.length === 0) {
        return null;
    }

    return (
        <div
            className='PostAttributesChips PostAttributesComposer'
            role='group'
            aria-label={formatMessage({id: 'post_attributes.composer.group', defaultMessage: 'Attached post attributes', description: 'Accessible label of the row of attribute chips above the message box in the composer.'})}
            data-testid='post-attributes-composer'
        >
            {chips.map(({field, value}) => (
                <PostAttributesComposerChip
                    key={field.id}
                    field={field}
                    value={value}
                    autoOpen={field.id === justAdded}
                    onChange={onChange}
                    onRemove={onRemove}
                />
            ))}

            {/*
              * Omitted rather than disabled when there is nothing left to
              * offer, the same rule the modal's own picker follows.
              */}
            {addable.length > 0 && (
                <PostAttributesFieldPicker
                    id={`postAttributesAdd-${addId}`}
                    fields={addable}
                    onSelect={onAdd}
                />
            )}
        </div>
    );
}

type ChipProps = {
    field: PropertyField;
    value?: PropertyValue<unknown>;
    autoOpen: boolean;
    onChange: (fieldId: string, next: unknown) => void;
    onRemove: (fieldId: string) => void;
};

/**
 * One staged attribute. The value renders through `PostAttributeChip`, as on
 * a sent post, so a staged chip looks like the chip it will become; editing
 * goes through `PostAttributeValueControl`, shared with the modal. The field
 * name is an `aria-hidden` caption, announced through the control's own name.
 */
function PostAttributesComposerChip({field, value, autoOpen, onChange, onRemove}: ChipProps) {
    const {formatMessage, formatList} = useIntl();

    const label = getPropertyFieldLabel(field);
    const isOptionType = field.type === 'select' || field.type === 'rank' || field.type === 'multiselect';

    // Only an option field needs this: its control is a button whose content
    // is the rendered chip, while a text input or user picker reads out its own
    // value.
    const optionLabels = isOptionType && value ? resolveOptionChips(field, value.value).map((chip) => chip.label) : [];
    let ariaLabel: string | undefined;
    if (optionLabels.length > 0) {
        ariaLabel = formatMessage(
            {id: 'post_attributes.composer.chip', defaultMessage: '{field}: {value}', description: 'Accessible name of an attribute chip in the message composer, read by screen readers. {field} is the attribute\'s name; {value} is the selected option or options.'},
            {field: label, value: formatList(optionLabels)},
        );
    } else if (isOptionType) {
        ariaLabel = formatMessage(
            {id: 'post_attributes.composer.chip.pending', defaultMessage: 'Select value for {field}', description: 'Accessible name of an attribute chip in the message composer that has no value yet; activating it opens the list of values. {field} is the attribute\'s name.'},
            {field: label},
        );
    }

    const handleRemove = useCallback(() => onRemove(field.id), [field.id, onRemove]);

    return (
        <div
            className='PostAttributesComposerChip'
            data-testid={`post-attribute-chip-${field.name}`}
        >
            <span
                className='PostAttributesComposerChip__label'
                aria-hidden='true'
            >
                {label}
            </span>

            <PostAttributeValueControl
                field={field}
                value={value}
                disabled={false}
                onChange={onChange}
                ariaLabel={ariaLabel}
                renderValue={renderChipValue}
                autoOpen={autoOpen}

                // An option chip with no value shows the field's name, so its
                // trigger has a size, and is un-staged when its menu closes
                // without a value: an empty chip would be a leftover with
                // nothing to click. Text and user chips are inputs with a size
                // of their own, and stay until their ×.
                pendingLabel={isOptionType ? <span className='PostAttributesComposerChip__pending'>{label}</span> : undefined}
                onCloseEmpty={isOptionType ? handleRemove : undefined}
            />

            <button
                type='button'
                className='PostAttributesComposerChip__remove'
                data-testid={`post-attribute-remove-${field.name}`}

                // Named after the attribute, so a row of chips does not
                // hand a screen reader several buttons called "Remove".
                aria-label={formatMessage(
                    {id: 'post_attributes.composer.remove', defaultMessage: 'Remove {attribute}', description: 'Accessible label of the × button on an attribute chip in the message composer; {attribute} is the attribute\'s name. Verb.'},
                    {attribute: label},
                )}
                onClick={handleRemove}
            >
                <CloseIcon size={12}/>
            </button>
        </div>
    );
}

function renderChipValue(field: PropertyField, value: PropertyValue<unknown>) {
    return (
        <PostAttributeChip
            field={field}
            value={value}
        />
    );
}
