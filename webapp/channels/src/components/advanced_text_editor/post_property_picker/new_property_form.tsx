// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FocusEventHandler, KeyboardEventHandler} from 'react';
import React, {useCallback, useLayoutEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import type {GroupBase} from 'react-select';
import {components} from 'react-select';
import type {CreatableProps} from 'react-select/creatable';
import CreatableSelect from 'react-select/creatable';

import type {FieldType, PropertyFieldOption} from '@mattermost/types/properties';

import PropertyTypeIcon from 'components/property_value_editor/type_icon';
import Input from 'components/widgets/inputs/input/input';
import LabeledSelect from 'components/widgets/inputs/labeled_select';
import type {LabeledSelectOption} from 'components/widgets/inputs/labeled_select';

import Constants from 'utils/constants';

import './new_property_form.scss';

export type NewPropertyData = {
    name: string;
    type: FieldType;
    options?: Array<{id: string; name: string}>;
};

export type Props = {
    onSave: (data: NewPropertyData) => Promise<void>;
    onCancel: () => void;
    onLayoutChange?: () => void;
};

type OptionPill = {label: string; id: string; value: string};
type SelectProps = CreatableProps<OptionPill, true, GroupBase<OptionPill>>;

const TYPES_WITH_OPTIONS: FieldType[] = ['select', 'multiselect'];
const DEFAULT_TYPE: FieldType = 'text';

const checkForDuplicates = (options: PropertyFieldOption[] | undefined, newOptionName: string) => {
    return options?.some((option) => option.name === newOptionName);
};

const customComponents: SelectProps['components'] = {
    DropdownIndicator: undefined,
    ClearIndicator: undefined,
    IndicatorsContainer: () => null,
    Input: (props) => {
        return (
            <components.Input
                {...props}
                maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_LENGTH}
            />
        );
    },
};

const pillStyles: SelectProps['styles'] = {
    multiValue: (base) => ({
        ...base,
        borderRadius: '12px',
        paddingLeft: '6px',
        paddingTop: '1px',
        paddingBottom: '1px',
        backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.08)',
    }),
    multiValueLabel: (base) => ({
        ...base,
        color: 'var(--center-channel-color)',
        fontFamily: 'Open Sans',
        fontSize: '12px',
        fontStyle: 'normal',
        fontWeight: 600,
        lineHeight: '16px',
    }),
    multiValueRemove: (base) => ({
        ...base,
        cursor: 'pointer',
        color: 'var(--center-channel-color)',
        borderRadius: '0 12px 12px 0',
        '&:hover': {
            backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.08)',
            color: 'var(--center-channel-color)',
        },
    }),
    control: (base, props) => ({
        ...base,
        minHeight: '40px',
        overflowY: 'auto',
        border: '1px solid rgba(var(--center-channel-color-rgb), 0.16)',
        borderRadius: '4px',
        ...props.isFocused && {
            border: '1px solid var(--button-bg)',
            boxShadow: 'none',
        },
        '&:hover': {
            cursor: 'text',
        },
    }),
};

export default function NewPropertyForm({onSave, onCancel, onLayoutChange}: Props) {
    const {formatMessage} = useIntl();

    const [name, setName] = useState('');
    const [type, setType] = useState<FieldType>(DEFAULT_TYPE);
    const [options, setOptions] = useState<PropertyFieldOption[]>([]);
    const [query, setQuery] = useState('');
    const [saving, setSaving] = useState(false);
    const [nameError, setNameError] = useState('');
    const [optionsError, setOptionsError] = useState('');

    const needsOptions = TYPES_WITH_OPTIONS.includes(type);
    const isQueryValid = useMemo(() => !checkForDuplicates(options, query.trim()), [options, query]);

    const hasNameError = Boolean(nameError);
    const hasOptionsError = Boolean(optionsError);
    const optionsCount = options.length;

    useLayoutEffect(() => {
        onLayoutChange?.();
    }, [needsOptions, optionsCount, hasNameError, hasOptionsError, isQueryValid, onLayoutChange]);

    const handleTypeChange = useCallback((next: LabeledSelectOption<FieldType> | Array<LabeledSelectOption<FieldType>> | null) => {
        if (!next || Array.isArray(next)) {
            return;
        }
        setType(next.value);
        setOptionsError('');
    }, []);

    const addOption = useCallback((rawName: string) => {
        const trimmed = rawName.trim();
        if (!trimmed) {
            return;
        }
        setOptions((prev) => {
            if (checkForDuplicates(prev, trimmed)) {
                return prev;
            }
            return [...prev, {id: '', name: trimmed}];
        });
        setOptionsError('');
    }, []);

    const processQuery = useCallback((value: string) => {
        addOption(value);
        setQuery('');
    }, [addOption]);

    const handleKeyDown: KeyboardEventHandler = useCallback((event) => {
        if (!query || !isQueryValid) {
            return;
        }
        switch (event.key) {
        case 'Enter':
        case 'Tab':
            processQuery(query);
            event.preventDefault();
        }
    }, [query, isQueryValid, processQuery]);

    const handleOnBlur: FocusEventHandler = useCallback((event) => {
        if (!query || !isQueryValid) {
            return;
        }
        processQuery(query);
        event.preventDefault();
    }, [query, isQueryValid, processQuery]);

    const handleSave = useCallback(async () => {
        let valid = true;

        if (name.trim()) {
            setNameError('');
        } else {
            setNameError(formatMessage({
                id: 'new_property_form.name_required',
                defaultMessage: 'Name is required',
            }));
            valid = false;
        }

        // If the user typed an option but didn't press Enter, accept it on save.
        let finalOptions = options;
        if (needsOptions && query.trim() && isQueryValid) {
            const trimmed = query.trim();
            finalOptions = [...options, {id: '', name: trimmed}];
            setOptions(finalOptions);
            setQuery('');
        }

        if (needsOptions && finalOptions.length === 0) {
            setOptionsError(formatMessage({
                id: 'new_property_form.options_required',
                defaultMessage: 'At least one option is required for {type} fields',
            }, {type}));
            valid = false;
        } else {
            setOptionsError('');
        }

        if (!valid) {
            return;
        }

        setSaving(true);
        try {
            await onSave({
                name: name.trim(),
                type,
                options: needsOptions ? finalOptions : undefined,
            });
        } finally {
            setSaving(false);
        }
    }, [name, type, options, query, isQueryValid, needsOptions, onSave, formatMessage]);

    const saveLabel = formatMessage({id: 'new_property_form.save', defaultMessage: 'Save'});
    const cancelLabel = formatMessage({id: 'new_property_form.cancel', defaultMessage: 'Cancel'});
    const nameLabel = formatMessage({id: 'new_property_form.name', defaultMessage: 'Name'});
    const typeLabel = formatMessage({id: 'new_property_form.type', defaultMessage: 'Type'});
    const optionsPlaceholder = formatMessage({
        id: 'new_property_form.options_placeholder',
        defaultMessage: 'Type and press Enter to add options',
    });
    const optionsAriaLabel = formatMessage({
        id: 'new_property_form.options_aria',
        defaultMessage: 'Options',
    });

    const typeOptions = useMemo<Array<LabeledSelectOption<FieldType>>>(() => [
        {value: 'text', label: formatMessage({id: 'new_property_form.type.text', defaultMessage: 'Text'}), icon: <PropertyTypeIcon type='text'/>},
        {value: 'date', label: formatMessage({id: 'new_property_form.type.date', defaultMessage: 'Date'}), icon: <PropertyTypeIcon type='date'/>},
        {value: 'select', label: formatMessage({id: 'new_property_form.type.select', defaultMessage: 'Select'}), icon: <PropertyTypeIcon type='select'/>},
        {value: 'multiselect', label: formatMessage({id: 'new_property_form.type.multiselect', defaultMessage: 'Multi-select'}), icon: <PropertyTypeIcon type='multiselect'/>},
        {value: 'user', label: formatMessage({id: 'new_property_form.type.user', defaultMessage: 'User'}), icon: <PropertyTypeIcon type='user'/>},
        {value: 'multiuser', label: formatMessage({id: 'new_property_form.type.multiuser', defaultMessage: 'Multi-user'}), icon: <PropertyTypeIcon type='multiuser'/>},
    ], [formatMessage]);

    const selectedTypeOption = typeOptions.find((o) => o.value === type) ?? typeOptions[0];

    // For new options, send id: "" so backend EnsureOptionIDs assigns the id.
    // For pills we still need a stable React key, so use the option's name (which we already deduplicate).
    const pillValues = useMemo<OptionPill[]>(
        () => options.map((option) => ({label: option.name, value: option.name, id: option.id})),
        [options],
    );

    const submitDisabled = saving || (needsOptions && options.length === 0 && !(query.trim() && isQueryValid));

    return (
        <div className='new-property-form'>
            <div className='new-property-form__field'>
                <Input
                    id='new-property-name'
                    type='text'
                    name='new-property-name'
                    label={nameLabel}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    hasError={Boolean(nameError)}
                    customMessage={nameError ? {type: 'error', value: nameError} : null}
                />
            </div>

            <div className='new-property-form__field'>
                <LabeledSelect<FieldType>
                    inputId='new-property-type'
                    label={typeLabel}
                    aria-label={typeLabel}
                    value={selectedTypeOption}
                    options={typeOptions}
                    onChange={handleTypeChange}
                    isSearchable={false}
                    menuPlacement='top'
                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                />
            </div>

            {needsOptions && (
                <div className='new-property-form__options'>
                    <CreatableSelect<OptionPill, true, GroupBase<OptionPill>>
                        aria-label={optionsAriaLabel}
                        inputId='new-property-options'
                        className='new-property-form__options-select'
                        classNamePrefix='new-property-form__options'
                        components={customComponents}
                        inputValue={query}
                        isClearable={true}
                        isMulti={true}
                        menuIsOpen={false}
                        onChange={(newValues) => {
                            // CreatableSelect emits the full new value array on remove. Preserve original ids.
                            setOptions(newValues.map(({id, value}) => ({id, name: value})));
                        }}
                        onInputChange={(newValue) => setQuery(newValue)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleOnBlur}
                        placeholder={optionsPlaceholder}
                        value={pillValues}
                        styles={pillStyles}
                    />
                    {!isQueryValid && (
                        <span className='new-property-form__error'>
                            {formatMessage({
                                id: 'new_property_form.options_unique',
                                defaultMessage: 'Values must be unique.',
                            })}
                        </span>
                    )}
                    {optionsError && (
                        <span className='new-property-form__error'>{optionsError}</span>
                    )}
                </div>
            )}

            <div className='new-property-form__actions'>
                <button
                    type='button'
                    className='new-property-form__save'
                    disabled={submitDisabled}
                    onClick={handleSave}
                >
                    {saveLabel}
                </button>
                <button
                    type='button'
                    className='new-property-form__cancel'
                    onClick={onCancel}
                >
                    {cancelLabel}
                </button>
            </div>
        </div>
    );
}
