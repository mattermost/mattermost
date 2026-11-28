// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useId, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {CloseIcon} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {getPropertyFieldLabel} from 'mattermost-redux/utils/property_utils';

import {resolveFieldOptionChips} from 'utils/property_options';

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

    // The scope of the composer's test ids: the row is `<scope>`, each chip `<scope>.chip:<field id>` and the
    // `+ Add attribute` after them `<scope>.add--button`.
    testIdScope?: string;
};

/**
 * The attributes staged in the composer: a chip per attribute above the message
 * box, plus a trailing `+ Add attribute` once anything is shown. Reuses the edit
 * modal's controls so both agree on what a field may hold.
 *
 * Fully controlled by `useStagedPostAttributes`, which the editor owns so it can
 * clear the staged state after a send and on a channel or thread switch.
 */
export default function PostAttributesComposer({chips, addable, justAdded, onAdd, onChange, onRemove, testIdScope}: Props) {
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
            data-testid={testIdScope}
        >
            {chips.map(({field, value}) => (
                <PostAttributesComposerChip
                    key={field.id}
                    field={field}
                    value={value}
                    autoOpen={field.id === justAdded}
                    onChange={onChange}
                    onRemove={onRemove}
                    testIdScope={testIdScope}
                />
            ))}

            {/*
              * Omitted rather than disabled when there is nothing left to
              * offer, the same rule the modal's own picker follows.
              */}
            {addable.length > 0 && (
                <PostAttributesFieldPicker
                    id={`postAttributesAdd-${addId}`}
                    compact={true}
                    fields={addable}
                    onSelect={onAdd}
                    testIdScope={testIdScope}
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
    testIdScope?: string;
};

/**
 * One staged attribute. The value renders through `PostAttributeChip`, as on
 * a sent post, so a staged chip looks like the chip it will become; editing
 * goes through `PostAttributeValueControl`, shared with the modal. The chip
 * shows only the value: the field's name is its tooltip, and is in the
 * control's accessible name.
 *
 * A text or user chip is a chip at rest, like every other, and becomes its
 * input or user picker while the user edits it; leaving the control turns it
 * back into a chip.
 */
function PostAttributesComposerChip({field, value, autoOpen, onChange, onRemove, testIdScope}: ChipProps) {
    const {formatMessage, formatList} = useIntl();

    const label = getPropertyFieldLabel(field);
    const isOptionType = field.type === 'select' || field.type === 'rank' || field.type === 'multiselect';
    const pendingLabel = <span className='PostAttributesComposerChip__pending'>{label}</span>;

    // A field just picked opens straight into its control.
    const [editing, setEditing] = useState(!isOptionType && autoOpen);
    const startEditing = useCallback(() => setEditing(true), []);

    // Focus moving within the control (react-select's input, its menu) keeps
    // it open; focus leaving it ends the edit.
    const handleEditorBlur = useCallback((event: React.FocusEvent<HTMLSpanElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
            setEditing(false);
        }
    }, []);

    // Only an option field needs this: its control is a button whose content
    // is the rendered chip, while a text input or user picker reads out its own
    // value.
    const optionLabels = isOptionType && value ? resolveFieldOptionChips(field, value.value).map((chip) => chip.label) : [];
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

    const valueScope = testIdScope ? `${testIdScope}.chip.value` : undefined;
    const renderValue = useCallback((valueField: PropertyField, fieldValue: PropertyValue<unknown>) => renderChipValue(valueField, fieldValue, valueScope), [valueScope]);

    const handleRemove = useCallback(() => onRemove(field.id), [field.id, onRemove]);
    const removeLabel = formatMessage(
        {id: 'post_attributes.composer.remove', defaultMessage: 'Remove {attribute}', description: 'Accessible label of the × button on an attribute chip in the message composer; {attribute} is the attribute\'s name. Verb.'},
        {attribute: label},
    );

    return (
        <div
            className='PostAttributesComposerChip'
            data-testid={testIdScope ? `${testIdScope}.chip:${field.id}` : undefined}
        >
            {!isOptionType && !editing ? (
                <WithTooltip title={label}>
                    <button
                        type='button'
                        className='PostAttributesComposerChip__rest'
                        data-testid={testIdScope ? `${testIdScope}.chip.rest--button` : undefined}
                        onClick={startEditing}
                    >
                        {value ? (
                            <>
                                <span className='sr-only'>
                                    <FormattedMessage
                                        id='post_attributes.composer.chip.field'
                                        defaultMessage='{field}:'
                                        description="Read by screen readers only, before the value of a text or user attribute chip in the message composer. {field} is the attribute's name."
                                        values={{field: label}}
                                    />
                                </span>
                                <PostAttributeChip
                                    field={field}
                                    value={value}
                                    interactive={false}
                                    testIdScope={valueScope}
                                />
                            </>
                        ) : pendingLabel}
                    </button>
                </WithTooltip>
            ) : (
                <span
                    className='PostAttributesComposerChip__editor'
                    onBlur={isOptionType ? undefined : handleEditorBlur}
                >
                    <PostAttributeValueControl
                        testIdScope={testIdScope ? `${testIdScope}.chip` : undefined}
                        field={field}
                        value={value}
                        disabled={false}
                        onChange={onChange}
                        ariaLabel={ariaLabel}
                        renderValue={renderValue}
                        autoOpen={isOptionType ? autoOpen : true}

                        // An option chip with no value shows the field's name, so its
                        // trigger has a size, and is un-staged when its menu closes
                        // without a value: an empty chip would be a leftover with
                        // nothing to click. Text and user chips stay until their ×;
                        // an empty one rests as the field's name.
                        pendingLabel={isOptionType ? pendingLabel : undefined}
                        onCloseEmpty={isOptionType ? handleRemove : undefined}

                        // Only a filled option chip: an empty one already reads as
                        // the field's name, and text and user chips get theirs at rest.
                        tooltip={isOptionType && value ? label : undefined}
                        menuMinWidth='180px'
                    />
                </span>
            )}

            <WithTooltip title={removeLabel}>
                <IconButton
                    size='x-small'
                    padding='compact'
                    className='PostAttributesComposerChip__remove'
                    data-testid={testIdScope ? `${testIdScope}.chip.remove--button` : undefined}
                    icon={<Icon glyph={<CloseIcon/>}/>}

                    // Named after the attribute, so a row of chips does not
                    // hand a screen reader several buttons called "Remove".
                    aria-label={removeLabel}

                    // Pressing the × would otherwise blur a text chip's input,
                    // which shrinks the chip back to rest and moves the × out
                    // from under the pointer before the click lands.
                    onMouseDown={preventDefault}
                    onClick={handleRemove}
                />
            </WithTooltip>
        </div>
    );
}

function preventDefault(event: React.MouseEvent) {
    event.preventDefault();
}

// Inside the option menu's trigger button, so the user name is plain text.
function renderChipValue(field: PropertyField, value: PropertyValue<unknown>, testIdScope?: string) {
    return (
        <PostAttributeChip
            field={field}
            value={value}
            interactive={false}
            testIdScope={testIdScope}
        />
    );
}
