// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import type {StylesConfig} from 'react-select';
import ReactSelect from 'react-select';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import type {PropertyValueEditorProps} from './types';

export type Props = PropertyValueEditorProps & {
    multi: boolean;
};

type SelectOption = {label: string; value: string};

const selectStyles: StylesConfig<SelectOption, true> = {
    valueContainer: (baseStyles) => ({
        ...baseStyles,
        height: 'auto',
        minHeight: '38px',
        flexWrap: 'wrap',
        whiteSpace: 'normal',
    }),
    multiValue: (baseStyles) => ({
        ...baseStyles,
        margin: '2px',
    }),
    control: (baseStyles) => ({
        ...baseStyles,
        height: 'auto',
        minHeight: '38px',
    }),
    multiValueLabel: (baseStyles) => ({
        ...baseStyles,
        padding: '2px 6px',
    }),
};

function getOptions(field: PropertyValueEditorProps['field']): PropertyFieldOption[] {
    return (field.attrs?.options as PropertyFieldOption[] | undefined) ?? [];
}

function toOption(opt: PropertyFieldOption): SelectOption {
    return {label: opt.name, value: opt.id};
}

export default function SelectEditor({field, value, onChange, multi}: Props) {
    const {formatMessage} = useIntl();
    const options = getOptions(field);

    const opts = useMemo(() => options.map(toOption), [options]);

    const selectedValue = useMemo(() => {
        if (multi) {
            const ids = Array.isArray(value) ? value.map(String) : [];
            return opts.filter((o) => ids.includes(o.value));
        }
        const id = typeof value === 'string' ? value : '';
        return opts.find((o) => o.value === id) ?? null;
    }, [multi, opts, value]);

    const handleChange = useCallback((next: unknown) => {
        if (multi) {
            const arr = (next as SelectOption[] | null) ?? [];
            onChange(arr.map((o) => o.value));
            return;
        }
        const single = next as SelectOption | null;
        onChange(single?.value ?? '');
    }, [multi, onChange]);

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
        <div
            className={`property-value-editor property-value-editor--${multi ? 'multiselect' : 'select'}`}
            data-property-field-id={field.id}
        >
            <ReactSelect
                isMulti={multi || undefined}
                inputId={`property-value-editor-${field.id}`}
                aria-label={field.name}
                className='react-select'
                classNamePrefix='react-select'
                options={opts}
                isClearable={true}
                isSearchable={false}
                placeholder={formatMessage({
                    id: 'property_value_editor.select.placeholder',
                    defaultMessage: 'Select',
                })}
                components={{IndicatorSeparator: null}}
                styles={selectStyles}
                value={selectedValue as SelectOption[]}
                onChange={handleChange}
            />
        </div>
    );
}
