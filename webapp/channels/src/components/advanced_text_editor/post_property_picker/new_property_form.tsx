// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {FieldType, PropertyFieldOption} from '@mattermost/types/properties';

import './new_property_form.scss';

export type NewPropertyData = {
    name: string;
    type: FieldType;
    options?: Array<{id: string; name: string}>;
};

export type Props = {
    onSave: (data: NewPropertyData) => Promise<void>;
    onCancel: () => void;
};

const TYPES_WITH_OPTIONS: FieldType[] = ['select', 'multiselect'];
const DEFAULT_TYPE: FieldType = 'text';

function generateOptionId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `opt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function NewPropertyForm({onSave, onCancel}: Props) {
    const {formatMessage} = useIntl();

    const [name, setName] = useState('');
    const [type, setType] = useState<FieldType>(DEFAULT_TYPE);
    const [options, setOptions] = useState<PropertyFieldOption[]>([]);
    const [saving, setSaving] = useState(false);
    const [nameError, setNameError] = useState('');
    const [optionsError, setOptionsError] = useState('');

    const needsOptions = TYPES_WITH_OPTIONS.includes(type);

    const handleTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setType(e.target.value as FieldType);
        setOptionsError('');
    }, []);

    const handleAddOption = useCallback(() => {
        setOptions((prev) => [...prev, {id: generateOptionId(), name: ''}]);
    }, []);

    const handleOptionNameChange = useCallback((id: string, value: string) => {
        setOptions((prev) => prev.map((o) => (o.id === id ? {...o, name: value} : o)));
    }, []);

    const handleRemoveOption = useCallback((id: string) => {
        setOptions((prev) => prev.filter((o) => o.id !== id));
    }, []);

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

        if (needsOptions && options.length === 0) {
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
                options: needsOptions ? options : undefined,
            });
        } finally {
            setSaving(false);
        }
    }, [name, type, options, needsOptions, onSave, formatMessage]);

    const saveLabel = formatMessage({id: 'new_property_form.save', defaultMessage: 'Save'});
    const cancelLabel = formatMessage({id: 'new_property_form.cancel', defaultMessage: 'Cancel'});
    const nameLabel = formatMessage({id: 'new_property_form.name', defaultMessage: 'Name'});
    const typeLabel = formatMessage({id: 'new_property_form.type', defaultMessage: 'Type'});
    const addOptionLabel = formatMessage({id: 'new_property_form.add_option', defaultMessage: 'Add option'});

    return (
        <div className='new-property-form'>
            <div className='new-property-form__field'>
                <label htmlFor='new-property-name'>{nameLabel}</label>
                <input
                    id='new-property-name'
                    type='text'
                    aria-label={nameLabel}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={Boolean(nameError)}
                />
                {nameError && (
                    <span className='new-property-form__error'>{nameError}</span>
                )}
            </div>

            <div className='new-property-form__field'>
                <label htmlFor='new-property-type'>{typeLabel}</label>
                <select
                    id='new-property-type'
                    aria-label={typeLabel}
                    value={type}
                    onChange={handleTypeChange}
                >
                    <option value='text'>
                        {formatMessage({id: 'new_property_form.type.text', defaultMessage: 'Text'})}
                    </option>
                    <option value='date'>
                        {formatMessage({id: 'new_property_form.type.date', defaultMessage: 'Date'})}
                    </option>
                    <option value='select'>
                        {formatMessage({id: 'new_property_form.type.select', defaultMessage: 'Select'})}
                    </option>
                    <option value='multiselect'>
                        {formatMessage({id: 'new_property_form.type.multiselect', defaultMessage: 'Multi-select'})}
                    </option>
                    <option value='user'>
                        {formatMessage({id: 'new_property_form.type.user', defaultMessage: 'User'})}
                    </option>
                </select>
            </div>

            {needsOptions && (
                <div className='new-property-form__options'>
                    {options.map((opt, idx) => (
                        <div
                            key={opt.id}
                            className='new-property-form__option-row'
                        >
                            <input
                                type='text'
                                aria-label={formatMessage(
                                    {id: 'new_property_form.option_name', defaultMessage: 'Option name {n}'},
                                    {n: idx + 1},
                                )}
                                value={opt.name}
                                onChange={(e) => handleOptionNameChange(opt.id, e.target.value)}
                            />
                            <button
                                type='button'
                                aria-label={formatMessage({
                                    id: 'new_property_form.remove_option',
                                    defaultMessage: 'Remove option',
                                })}
                                onClick={() => handleRemoveOption(opt.id)}
                            >
                                <FormattedMessage
                                    id='new_property_form.remove_option_label'
                                    defaultMessage='×'
                                />
                            </button>
                        </div>
                    ))}
                    <button
                        type='button'
                        className='new-property-form__add-option'
                        onClick={handleAddOption}
                    >
                        {addOptionLabel}
                    </button>
                    {optionsError && (
                        <span className='new-property-form__error'>{optionsError}</span>
                    )}
                </div>
            )}

            <div className='new-property-form__actions'>
                <button
                    type='button'
                    className='new-property-form__save'
                    disabled={saving}
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
