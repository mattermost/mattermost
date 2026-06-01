// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {FocusEventHandler, KeyboardEventHandler} from 'react';
import React, {forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import type {GroupBase} from 'react-select';
import {components} from 'react-select';
import type {CreatableProps} from 'react-select/creatable';
import CreatableSelect from 'react-select/creatable';

import {Button} from '@mattermost/shared/components/button';
import type {ButtonSize} from '@mattermost/shared/components/button/button_classes';
import type {FieldType, PropertyFieldOption} from '@mattermost/types/properties';

import Input from 'components/widgets/inputs/input/input';

import Constants from 'utils/constants';

import {formDataEqualsInitial} from './property_field_form_utils';
import PropertyFieldTypeMenu from './property_field_type_menu';

import './new_property_form.scss';

export type NewPropertyData = {
    name: string;
    type: FieldType;
    options?: Array<{id: string; name: string}>;
};

export type NewPropertyFormHandle = {
    submit: () => void;
};

export type Props = {
    onSave: (data: NewPropertyData) => Promise<void>;
    onCancel: () => void;
    onLayoutChange?: () => void;
    initialValues?: NewPropertyData;
    inputIdPrefix?: string;
    typeMenuOpensUpward?: boolean;
    disableSaveWhenUnchanged?: boolean;
    saveAriaLabel?: string;
    cancelAriaLabel?: string;
    className?: string;
    buttonSize?: ButtonSize;

    // Hide the built-in action buttons. The parent is then responsible for
    // triggering save via the imperative `submit` ref handle (e.g. a modal footer).
    hideActions?: boolean;
    onSubmitDisabledChange?: (disabled: boolean) => void;
};

function getInitialOptions(field?: NewPropertyData): PropertyFieldOption[] {
    return field?.options ?? [];
}

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
    control: (base, props) => ({
        ...base,
        minHeight: '40px',
        overflowY: 'auto',
        border: '1px solid rgba(var(--center-channel-color-rgb), 0.16)',
        borderRadius: '4px',
        backgroundColor: 'var(--center-channel-bg)',
        boxShadow: 'none',
        ...props.isFocused && {
            borderColor: 'var(--button-bg)',
            backgroundColor: 'var(--center-channel-bg)',
            boxShadow: 'none',
        },
        '&:hover': {
            cursor: 'text',
            borderColor: 'rgba(var(--center-channel-color-rgb), 0.48)',
        },
    }),
    valueContainer: (base) => ({
        ...base,
        padding: '2px 8px',
    }),
    input: (base) => ({
        ...base,
        color: 'var(--center-channel-color)',
    }),
    placeholder: (base) => ({
        ...base,
        color: 'rgba(var(--center-channel-color-rgb), 0.64)',
    }),
    multiValue: (base) => ({
        ...base,
        borderRadius: '12px',
        paddingLeft: '6px',
        paddingTop: '1px',
        paddingBottom: '1px',
        backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.16)',
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
        color: 'rgba(var(--center-channel-color-rgb), 0.72)',
        borderRadius: '0 12px 12px 0',
        '&:hover': {
            backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.12)',
            color: 'var(--center-channel-color)',
        },
    }),
};

const NewPropertyForm = forwardRef<NewPropertyFormHandle, Props>(({
    onSave,
    onCancel,
    onLayoutChange,
    initialValues,
    inputIdPrefix = 'new-property',
    typeMenuOpensUpward = true,
    disableSaveWhenUnchanged = false,
    saveAriaLabel,
    cancelAriaLabel,
    className,
    buttonSize = 'sm',
    hideActions = false,
    onSubmitDisabledChange,
}: Props, ref) => {
    const {formatMessage} = useIntl();

    const [name, setName] = useState(initialValues?.name ?? '');
    const [type, setType] = useState<FieldType>(initialValues?.type ?? DEFAULT_TYPE);
    const [options, setOptions] = useState<PropertyFieldOption[]>(() => getInitialOptions(initialValues));
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

    const handleTypeChange = useCallback((next: FieldType) => {
        setType(next);
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

    // For new options, send id: "" so backend EnsureOptionIDs assigns the id.
    // For pills we still need a stable React key, so use the option's name (which we already deduplicate).
    const pillValues = useMemo<OptionPill[]>(
        () => options.map((option) => ({label: option.name, value: option.name, id: option.id})),
        [options],
    );

    const hasChanges = useMemo(() => {
        if (!initialValues || !disableSaveWhenUnchanged) {
            return true;
        }
        return !formDataEqualsInitial({
            name: name.trim(),
            type,
            options: needsOptions ? options : undefined,
        }, initialValues);
    }, [disableSaveWhenUnchanged, initialValues, name, type, options, needsOptions]);

    const submitDisabled = saving ||
        !hasChanges ||
        (disableSaveWhenUnchanged && !name.trim()) ||
        (needsOptions && options.length === 0 && !(query.trim() && isQueryValid));

    useImperativeHandle(ref, () => ({submit: handleSave}), [handleSave]);

    useEffect(() => {
        onSubmitDisabledChange?.(submitDisabled);
    }, [submitDisabled, onSubmitDisabledChange]);

    const nameInputId = `${inputIdPrefix}-name`;
    const typeInputId = `${inputIdPrefix}-type`;
    const optionsInputId = `${inputIdPrefix}-options`;

    return (
        <div className={classNames('new-property-form', className)}>
            <div className='new-property-form__field'>
                <Input
                    id={nameInputId}
                    type='text'
                    name={nameInputId}
                    label={nameLabel}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    hasError={Boolean(nameError)}
                    customMessage={nameError ? {type: 'error', value: nameError} : null}
                />
            </div>

            <div className='new-property-form__field'>
                <PropertyFieldTypeMenu
                    inputId={typeInputId}
                    value={type}
                    onChange={handleTypeChange}
                    aria-label={typeLabel}
                    menuOpensUpward={typeMenuOpensUpward}
                />
            </div>

            {needsOptions && (
                <div className='new-property-form__options'>
                    <CreatableSelect<OptionPill, true, GroupBase<OptionPill>>
                        aria-label={optionsAriaLabel}
                        inputId={optionsInputId}
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

            {!hideActions && (
                <div className='new-property-form__actions'>
                    <Button
                        type='button'
                        emphasis='tertiary'
                        size={buttonSize}
                        aria-label={cancelAriaLabel}
                        onClick={onCancel}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        type='button'
                        emphasis='primary'
                        size={buttonSize}
                        aria-label={saveAriaLabel}
                        disabled={submitDisabled}
                        onClick={handleSave}
                    >
                        {saveLabel}
                    </Button>
                </div>
            )}
        </div>
    );
});

NewPropertyForm.displayName = 'NewPropertyForm';

export default NewPropertyForm;
