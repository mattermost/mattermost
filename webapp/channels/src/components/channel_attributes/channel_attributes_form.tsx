// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useMemo, useState} from 'react';
import type {KeyboardEvent} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';
import {isTextField, supportsHierarchy, supportsOptions} from '@mattermost/types/properties';

import {PROPERTY_TEXT_VALUE_MAX_LENGTH} from 'mattermost-redux/constants/properties';
import {getPropertyFieldLabel, isPropertyFieldRequired, isPropertyValueSet} from 'mattermost-redux/utils/property_utils';

import {AttributeCombobox, getAttributeComboboxType} from 'components/property_fields/attribute_combobox';
import {asGraphFieldRef, asGraphValueIds} from 'components/property_fields/graph';
import AssignmentGraphPicker from 'components/property_fields/hierarchical_value_menu/assignment_picker';
import Input from 'components/widgets/inputs/input/input';

import {ZIndex} from 'utils/constants';

import './channel_attributes_form.scss';

export type ChannelAttributeSelection = Record<string, string | string[]>;

type Props = {
    fields: PropertyField[];
    values: ChannelAttributeSelection;
    onChange: (fieldId: string, value: string | string[] | undefined) => void;
    disabled?: boolean;
};

// Stable, so AttributeCombobox's memo doesn't recompute on every keystroke elsewhere in the modal.
const NO_OPTIONS: PropertyFieldOption[] = [];

function getOptions(field: PropertyField): PropertyFieldOption[] {
    return (field.attrs?.options as PropertyFieldOption[] | undefined) ?? NO_OPTIONS;
}

// Compass's chip toolbar turns Enter into a remove click without stopping it, so
// the key would otherwise reach GenericModal's confirm handler.
function stopChipEnter(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && e.target instanceof Element && e.target.closest('[data-chip]')) {
        e.stopPropagation();
    }
}

const ChannelAttributesForm = ({fields, values, onChange, disabled}: Props) => {
    const {formatMessage} = useIntl();
    const [touched, setTouched] = useState<Record<string, true>>({});

    // Date and user-valued attributes are storable through the API but have no
    // assignment UI, so they are skipped rather than rendered as something the
    // user cannot fill in.
    const supported = useMemo(() => fields.filter((field) => supportsOptions(field) || supportsHierarchy(field) || isTextField(field)), [fields]);

    const markTouched = useCallback((fieldId: string) => {
        setTouched((prev) => (prev[fieldId] ? prev : {...prev, [fieldId]: true}));
    }, []);

    const handleOptionsChange = useCallback((fieldId: string, next: string | string[]) => {
        if (isPropertyValueSet(next)) {
            onChange(fieldId, next);
            return;
        }

        // Emptying a field counts as touching it, even if its input never had focus.
        markTouched(fieldId);
        onChange(fieldId, undefined);
    }, [onChange, markTouched]);

    const handleText = useCallback((fieldId: string, next: string) => {
        onChange(fieldId, next || undefined);
    }, [onChange]);

    if (supported.length === 0) {
        return null;
    }

    const selectPlaceholder = formatMessage({id: 'channel_attributes.select_value', defaultMessage: 'Select a value'});
    const textPlaceholder = formatMessage({id: 'channel_attributes.enter_value', defaultMessage: 'Enter a value'});
    const requiredMessage = formatMessage({id: 'widget.input.required', defaultMessage: 'This field is required'});

    return (
        <div
            className='channel-attributes-form'
            data-testid='channelAttributesForm'
        >
            <h4 className='channel-attributes-form__title'>
                <FormattedMessage
                    id='channel_attributes.title'
                    defaultMessage='Channel attributes'
                />
            </h4>
            <p className='channel-attributes-form__description'>
                <FormattedMessage
                    id='channel_attributes.description'
                    defaultMessage='Configure attributes and values for this channel.'
                />
            </p>
            {supported.map((field) => {
                const label = getPropertyFieldLabel(field);
                const selected = values[field.id];
                const required = isPropertyFieldRequired(field);
                const hasOptions = supportsOptions(field);
                const comboboxId = `channelAttribute-${field.id}`;
                const errorId = `${comboboxId}-error`;
                const showError = hasOptions && required && Boolean(touched[field.id]) && !isPropertyValueSet(selected);

                let control;
                if (supportsHierarchy(field)) {
                    control = (
                        <GraphAttributeControl
                            field={field}
                            value={selected}
                            onChange={onChange}
                            placeholder={selectPlaceholder}
                            ariaLabel={label}
                            disabled={disabled}
                        />
                    );
                } else if (isTextField(field)) {
                    control = (
                        <Input
                            id={`channelAttribute-${field.id}`}
                            name={`channelAttribute-${field.name}`}
                            type='text'
                            value={typeof selected === 'string' ? selected : ''}
                            maxLength={PROPERTY_TEXT_VALUE_MAX_LENGTH}
                            onChange={(e) => handleText(field.id, e.target.value)}
                            placeholder={textPlaceholder}
                            disabled={disabled}
                            aria-label={label}
                            required={required}
                        />
                    );
                } else {
                    const type = getAttributeComboboxType(field);
                    const combobox = (
                        <AttributeCombobox
                            id={comboboxId}
                            testId={`channelAttribute-${field.name}`}
                            type={type}
                            label={label}
                            options={getOptions(field)}
                            value={selected ?? ''}
                            onChange={(next) => handleOptionsChange(field.id, next)}
                            placeholder={selectPlaceholder}
                            zIndex={ZIndex.MENU}
                            required={required}
                            disabled={disabled}
                            invalid={showError}
                            aria-describedby={showError ? errorId : undefined}
                            onBlur={() => markTouched(field.id)}
                        />
                    );

                    control = type === 'multiselect' ? (
                        <div
                            role='presentation'
                            onKeyDown={stopChipEnter}
                        >
                            {combobox}
                        </div>
                    ) : combobox;
                }

                // Decorative: the control carries required for assistive technology
                // (aria-required), so the marker is hidden rather than translated.
                const requiredMarker = required && (
                    <span
                        className='channel-attributes-form__required'
                        aria-hidden={true}
                    >
                        {'*'}
                    </span>
                );

                return (
                    <div
                        key={field.id}
                        className={classNames('channel-attributes-form__row', {'channel-attributes-form__row--error': showError})}
                        data-testid={`channelAttributeRow-${field.name}`}
                    >
                        {hasOptions ? (
                            <label
                                className='channel-attributes-form__label'
                                htmlFor={comboboxId}
                                title={label}
                            >
                                {label}
                                {requiredMarker}
                            </label>
                        ) : (
                            <span
                                className='channel-attributes-form__label'
                                title={label}
                            >
                                {label}
                                {requiredMarker}
                            </span>
                        )}
                        <div className='channel-attributes-form__control'>
                            {control}
                            {showError && (
                                <div
                                    id={errorId}
                                    className='channel-attributes-form__error'
                                    role='alert'
                                >
                                    <i
                                        className='icon icon-alert-circle-outline'
                                        aria-hidden={true}
                                    />
                                    <span>{requiredMessage}</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

type GraphControlProps = {
    field: PropertyField;
    value: string | string[] | undefined;
    onChange: (fieldId: string, value: string | string[] | undefined) => void;
    placeholder: string;
    ariaLabel: string;
    disabled?: boolean;
};

// The ref is memoized on field identity because the picker keys its own memos
// on it, and this form re-renders on every keystroke elsewhere in the modal.
const GraphAttributeControl = ({field, value, onChange, placeholder, ariaLabel, disabled}: GraphControlProps) => {
    const graphField = useMemo(() => asGraphFieldRef(field), [field]);

    const handleIdsChange = useCallback((next: string[]) => {
        onChange(field.id, next.length ? next : undefined);
    }, [field.id, onChange]);

    return (
        <AssignmentGraphPicker
            field={graphField}
            ids={asGraphValueIds(value)}
            onIdsChange={handleIdsChange}
            menuId={`channelAttributeMenu-${field.name}`}
            buttonId={`channelAttribute-${field.name}`}
            buttonDataTestId={`channelAttribute-${field.name}`}
            placeholder={placeholder}
            ariaLabel={ariaLabel}
            disabled={disabled}
        />
    );
};

export default ChannelAttributesForm;
