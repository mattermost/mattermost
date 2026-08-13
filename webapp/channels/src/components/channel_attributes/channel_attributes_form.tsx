// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import type {OnChangeValue} from 'react-select';

import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';
import {supportsOptions} from '@mattermost/types/properties';

import {isPropertyFieldRequired} from 'mattermost-redux/utils/property_utils';

import {ColorSwatch, LevelOptionLabel} from 'components/admin_console/classification_markings/classification_markings_styled';
import DropdownInput from 'components/dropdown_input';
import Input from 'components/widgets/inputs/input/input';

import './channel_attributes_form.scss';

export type ChannelAttributeSelection = Record<string, string | string[]>;

type Props = {
    fields: PropertyField[];
    values: ChannelAttributeSelection;
    onChange: (fieldId: string, value: string | string[] | undefined) => void;
    disabled?: boolean;
};

type Option = {label: string; value: string; color?: string};

// The menu is portalled to the body to escape the modal's overflow, which drops
// it out of the modal's stacking context — without these it paints behind the
// modal and swallows clicks. Same values as the classification dropdown above.
const dropdownStyles = {
    menu: (provided: Record<string, unknown>) => ({...provided, zIndex: 100}),
    menuPortal: (provided: Record<string, unknown>) => ({...provided, zIndex: 1100}),
};

// Date and user-valued attributes are storable through the API but have no
// assignment UI in this release, so they are skipped rather than rendered as
// something the user cannot fill in.
function isText(field: PropertyField): boolean {
    return field.type === 'text';
}

function isMultiselect(field: PropertyField): boolean {
    return field.type === 'multiselect';
}

function isSupported(field: PropertyField): boolean {
    return supportsOptions(field) || isText(field);
}

function fieldLabel(field: PropertyField): string {
    const displayName = field.attrs?.display_name;
    return typeof displayName === 'string' && displayName ? displayName : field.name;
}

function toOptions(field: PropertyField): Option[] {
    const options = (field.attrs?.options as PropertyFieldOption[] | undefined) ?? [];
    return options.map((option) => ({label: option.name, value: option.id, color: option.color}));
}

// Renders option colours where they exist, which is how Classification keeps its
// swatches once it becomes one attribute among many.
function formatOptionLabel(option: Option) {
    if (!option.color) {
        return <span>{option.label}</span>;
    }

    return (
        <LevelOptionLabel>
            <ColorSwatch style={{backgroundColor: option.color}}/>
            <span>{option.label}</span>
        </LevelOptionLabel>
    );
}

const ChannelAttributesForm = ({fields, values, onChange, disabled}: Props) => {
    const {formatMessage} = useIntl();

    const supported = useMemo(() => fields.filter(isSupported), [fields]);

    // react-select hands back an array for isMulti and a single option otherwise,
    // so the shape is narrowed here rather than trusted from the field type.
    const handleSelect = useCallback((fieldId: string, selected: OnChangeValue<Option, boolean>) => {
        if (Array.isArray(selected)) {
            const ids = selected.map((option) => option.value);
            onChange(fieldId, ids.length ? ids : undefined);
            return;
        }
        onChange(fieldId, (selected as Option | null)?.value || undefined);
    }, [onChange]);

    const handleText = useCallback((fieldId: string, next: string) => {
        onChange(fieldId, next || undefined);
    }, [onChange]);

    if (supported.length === 0) {
        return null;
    }

    const selectPlaceholder = formatMessage({id: 'channel_attributes.select_value', defaultMessage: 'Select a value'});
    const textPlaceholder = formatMessage({id: 'channel_attributes.enter_value', defaultMessage: 'Enter a value'});

    return (
        <div className='channel-attributes-form'>
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
                const label = fieldLabel(field);
                const selected = values[field.id];

                return (
                    <div
                        key={field.id}
                        className='channel-attributes-form__row'
                        data-testid={`channelAttributeRow-${field.name}`}
                    >
                        <span
                            className='channel-attributes-form__label'
                            title={label}
                        >
                            {label}
                            {isPropertyFieldRequired(field) && (

                            // Decorative: the control carries required for assistive
                            // technology, so the marker is hidden rather than translated.

                                <span
                                    className='channel-attributes-form__required'
                                    aria-hidden={true}
                                >
                                    {'*'}
                                </span>
                            )}
                        </span>
                        <div className='channel-attributes-form__control'>
                            {isText(field) ? (
                                <Input
                                    id={`channelAttribute-${field.id}`}
                                    name={`channelAttribute-${field.name}`}
                                    type='text'
                                    value={typeof selected === 'string' ? selected : ''}
                                    onChange={(e) => handleText(field.id, e.target.value)}
                                    placeholder={textPlaceholder}
                                    disabled={disabled}
                                    aria-label={label}
                                    required={isPropertyFieldRequired(field)}
                                />
                            ) : (

                                // No legend: the row already carries the label, and a
                                // legend would float a second copy inside the control.
                                <DropdownInput
                                    name={`channelAttribute-${field.id}`}
                                    testId={`channelAttribute-${field.name}`}
                                    options={toOptions(field)}
                                    value={resolveSelected(field, selected)}
                                    onChange={(option) => handleSelect(field.id, option)}
                                    isMulti={isMultiselect(field)}
                                    isClearable={true}
                                    isDisabled={disabled}
                                    required={isPropertyFieldRequired(field)}
                                    placeholder={selectPlaceholder}
                                    styles={dropdownStyles}
                                    formatOptionLabel={formatOptionLabel}
                                    menuPortalTarget={document.body}
                                />
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// DropdownInput types `value` as a single option even under isMulti, and casts
// internally for the same reason, so the array case is cast here rather than
// dropping multiselect support.
function resolveSelected(field: PropertyField, selected: string | string[] | undefined): Option | undefined {
    const options = toOptions(field);
    if (Array.isArray(selected)) {
        return options.filter((option) => selected.includes(option.value)) as unknown as Option;
    }
    return options.find((option) => option.value === selected);
}

export default ChannelAttributesForm;
