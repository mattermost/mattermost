// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useId, useMemo} from 'react';
import {useIntl} from 'react-intl';

import {CloseIcon} from '@mattermost/compass-icons/components';
import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {getPropertyFieldLabel, isPropertyValueSet} from 'mattermost-redux/utils/property_utils';

import PropertyValueRenderer from 'components/properties_card_view/propertyValueRenderer/propertyValueRenderer';

import {resolveOptionChips} from 'utils/property_options';

import PostAttributeValueControl, {hasValueControl} from './post_attribute_value_control';
import PostAttributesFieldPicker from './post_attributes_field_picker';
import {toPropertyValue} from './use_composer_attributes';
import type {ComposerPropertyValue} from './use_staged_post_attributes';
import {useModalAttributes} from './utils';

// The composer's chips are the sent post's chips, sized and coloured by the
// same rules; the composer's own sheet only adds its layout on top.
import './post_attributes_chips.scss';
import './post_attributes_composer.scss';

type Props = {
    values: ComposerPropertyValue[];
    added: ReadonlySet<string>;

    // The channel's fields, whether the user may write each one, and what the
    // `+ Add attribute` control offers. All three come from the editor's one
    // `useComposerAttributes` call, shared with the `+` in the action row.
    fields: PropertyField[];
    canEdit: (field: PropertyField) => boolean;
    addable: PropertyField[];
    justAdded: string | null;
    onAdd: (fieldId: string) => void;
    onChange: (fieldId: string, next: unknown) => void;
    onRemove: (fieldId: string) => void;
};

/**
 * The attributes staged in the composer: a chip per attribute above the message
 * box, plus a trailing `+ Add attribute` once anything is shown. Reuses the edit
 * modal's hooks and controls so both agree on what a field may hold.
 *
 * Fully controlled by `useStagedPostAttributes`, which the editor owns so it can
 * clear the staged state after a send and on a channel or thread switch.
 */
export default function PostAttributesComposer({values, added, fields, canEdit, addable, justAdded, onAdd, onChange, onRemove}: Props) {
    const {formatMessage} = useIntl();

    const propertyValues = useMemo(() => values.map(toPropertyValue), [values]);

    // Each composer mounted at once (centre channel, thread sidebar) needs its
    // own DOM id for the add control.
    const addId = useId();

    // The same two conditions `useAddableAttributes` applies to what the
    // picker offers, applied to the chips as well.
    const settable = useMemo(
        () => fields.filter((field) => canEdit(field) && hasValueControl(field)),
        [fields, canEdit],
    );

    const attributes = useModalAttributes(settable, propertyValues, added);

    if (attributes.length === 0) {
        return null;
    }

    return (
        <div
            className='PostAttributesChips PostAttributesComposer'
            role='group'
            aria-label={formatMessage({id: 'post_attributes.composer.group', defaultMessage: 'Attached post attributes', description: 'Accessible label of the row of attribute chips above the message box in the composer.'})}
            data-testid='post-attributes-composer'
        >
            {attributes.map(({field, value}) => (
                <PostAttributesComposerChip
                    key={field.id}
                    field={field}
                    value={value}
                    removable={isPropertyValueSet(value?.value) || added.has(field.id)}
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
    removable: boolean;
    autoOpen: boolean;
    onChange: (fieldId: string, next: unknown) => void;
    onRemove: (fieldId: string) => void;
};

/**
 * One staged attribute. The value renders through `PropertyValueRenderer`, as
 * on a sent post, so a staged chip looks like the chip it will become; editing
 * goes through `PostAttributeValueControl`, shared with the modal. The field
 * name is an `aria-hidden` caption, announced through the control's own name.
 */
function PostAttributesComposerChip({field, value, removable, autoOpen, onChange, onRemove}: ChipProps) {
    const {formatMessage, formatList} = useIntl();

    const label = getPropertyFieldLabel(field);
    const isOptionType = field.type === 'select' || field.type === 'rank' || field.type === 'multiselect';

    // Only an option field needs this: its control is a button whose content
    // is the rendered chip, while a text input or user picker reads out its own
    // value.
    const optionLabels = isOptionType && value ? resolveOptionChips(field, value.value).map((chip) => chip.label) : [];
    const ariaLabel = optionLabels.length > 0 ? formatMessage(
        {id: 'post_attributes.composer.chip', defaultMessage: '{field}: {value}', description: 'Accessible name of an attribute chip in the message composer, read by screen readers. {field} is the attribute\'s name; {value} is the selected option or options.'},
        {field: label, value: formatList(optionLabels)},
    ) : undefined;

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
            />

            {/*
              * Omitted rather than disabled when there is nothing to take
              * away — an empty `always` chip — the same rule the modal row
              * follows for its clear button.
              */}
            {removable && (
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
            )}
        </div>
    );
}

function renderChipValue(field: PropertyField, value: PropertyValue<unknown>) {
    return (
        <PropertyValueRenderer
            field={field}
            value={value}
        />
    );
}
