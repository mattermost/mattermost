// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import type {OnChangeValue} from 'react-select';

import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';
import {isTextField, supportsHierarchy, supportsOptions} from '@mattermost/types/properties';

import {PROPERTY_TEXT_VALUE_MAX_LENGTH} from 'mattermost-redux/constants/properties';
import {getPropertyFieldLabel, isPropertyFieldRequired} from 'mattermost-redux/utils/property_utils';

import {ColorSwatch, LevelOptionLabel} from 'components/admin_console/classification_markings/classification_markings_styled';
import DropdownInput from 'components/dropdown_input';
import type {ValueType} from 'components/dropdown_input';
import {asGraphFieldRef, asGraphValueIds} from 'components/property_fields/graph';
import AssignmentGraphPicker from 'components/property_fields/hierarchical_value_menu/assignment_picker';
import Input from 'components/widgets/inputs/input/input';

import './channel_attributes_form.scss';

export type ChannelAttributeSelection = Record<string, string | string[]>;

type Props = {
    fields: PropertyField[];
    values: ChannelAttributeSelection;
    onChange: (fieldId: string, value: string | string[] | undefined) => void;
    disabled?: boolean;
};

// Colour rides along so the option renders its swatch; DropdownInput passes
// unknown keys straight through to the option renderer.
type Option = ValueType & {color?: string};

// The menu is portalled to the body to escape the modal's overflow, which drops
// it out of the modal's stacking context — without these it paints behind the
// modal and swallows clicks.
const dropdownStyles = {
    menu: (provided: Record<string, unknown>) => ({...provided, zIndex: 100}),
    menuPortal: (provided: Record<string, unknown>) => ({...provided, zIndex: 1100}),
};

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

    // Date and user-valued attributes are storable through the API but have no
    // assignment UI, so they are skipped rather than rendered as something the
    // user cannot fill in.
    const supported = useMemo(() => fields.filter((field) => supportsOptions(field) || supportsHierarchy(field) || isTextField(field)), [fields]);

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
                            required={isPropertyFieldRequired(field)}
                        />
                    );
                } else {
                    control = (

                        // No legend: the row already carries the label, and a
                        // legend would float a second copy inside the control.
                        <DropdownInput
                            name={`channelAttribute-${field.id}`}
                            testId={`channelAttribute-${field.name}`}
                            options={toOptions(field)}
                            value={resolveSelected(field, selected)}
                            onChange={(option) => handleSelect(field.id, option)}
                            isMulti={field.type === 'multiselect'}
                            isClearable={true}
                            isDisabled={disabled}
                            required={isPropertyFieldRequired(field)}
                            placeholder={selectPlaceholder}
                            styles={dropdownStyles}
                            formatOptionLabel={formatOptionLabel}
                            menuPortalTarget={document.body}
                            aria-label={label}
                        />
                    );
                }

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
                            {control}
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
