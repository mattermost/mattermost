// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import type {PropertyValueEditorProps} from './types';

type SingleSelectProps = PropertyValueEditorProps;
type MultiSelectProps = PropertyValueEditorProps;

export type Props = PropertyValueEditorProps & {
    multi: boolean;
};

function toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.map(String);
    }
    return [];
}

function toStringValue(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }
    return '';
}

function getOptions(field: PropertyValueEditorProps['field']): PropertyFieldOption[] {
    return (field.attrs?.options as PropertyFieldOption[] | undefined) ?? [];
}

function SingleSelect({field, value, onChange}: SingleSelectProps) {
    const options = getOptions(field);
    const current = toStringValue(value);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const next = e.target.value;
        onChange(next === '' ? undefined : next);
    }, [onChange]);

    if (options.length === 0) {
        return (
            <span
                className='property-value-editor property-value-editor--select-empty'
                data-property-field-id={field.id}
            >
                <FormattedMessage
                    id='property_value_editor.select.no_options'
                    defaultMessage='No options defined'
                />
            </span>
        );
    }

    return (
        <select
            className='property-value-editor property-value-editor--select'
            data-property-field-id={field.id}
            value={current}
            aria-label={field.name}
            onChange={handleChange}
        >
            <option value=''/>
            {options.map((opt) => (
                <option
                    key={opt.id}
                    value={opt.id}
                >
                    {opt.name}
                </option>
            ))}
        </select>
    );
}

function MultiSelect({field, value, onChange}: MultiSelectProps) {
    const options = getOptions(field);
    const selectedArray = useMemo(() => toStringArray(value), [value]);
    const selectedSet = useMemo(() => new Set(selectedArray), [selectedArray]);

    const handleChange = useCallback((optId: string, checked: boolean) => {
        let next: string[];
        if (checked) {
            next = [...selectedSet, optId];
        } else {
            next = [...selectedSet].filter((id) => id !== optId);
        }
        onChange(next.length > 0 ? next : undefined);
    }, [onChange, selectedSet]);

    return (
        <div
            className='property-value-editor property-value-editor--multiselect'
            data-property-field-id={field.id}
        >
            {options.map((opt) => (
                <label
                    key={opt.id}
                    className='property-value-editor__option'
                >
                    <input
                        type='checkbox'
                        aria-label={opt.name}
                        checked={selectedSet.has(opt.id)}
                        onChange={(e) => handleChange(opt.id, e.target.checked)}
                    />
                    {opt.name}
                </label>
            ))}
        </div>
    );
}

export default function SelectEditor({multi, ...rest}: Props) {
    if (multi) {
        return <MultiSelect {...rest}/>;
    }
    return <SingleSelect {...rest}/>;
}
