// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {components as rsComponents} from 'react-select';
import type {
    MultiValueGenericProps,
    OptionProps,
    SingleValueProps,
} from 'react-select';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import LabeledSelect from 'components/widgets/inputs/labeled_select';
import type {LabeledSelectOption} from 'components/widgets/inputs/labeled_select';
import Tag from 'components/widgets/tag/tag';

import type {PropertyValueEditorProps} from './types';

export type Props = PropertyValueEditorProps & {
    multi: boolean;
};

// Locally-extended option type — keep `LabeledSelectOption` itself free of
// property-feature concerns by carrying the optional `color` here.
type PropertySelectOption = LabeledSelectOption<string> & {color?: string};

// Component overrides are typed against `LabeledSelectOption<string>` (the
// option type LabeledSelect forwards to react-select) and read `color` off the
// option via the locally-extended `PropertySelectOption` shape. This avoids
// an `as any` cast at the `components` prop site.
function PropertyOption(props: OptionProps<LabeledSelectOption<string>, boolean>) {
    const data = props.data as PropertySelectOption;
    return (
        <rsComponents.Option {...props}>
            <Tag
                text={data.label}
                color={data.color}
                size='sm'
            />
        </rsComponents.Option>
    );
}

function PropertySingleValue(props: SingleValueProps<LabeledSelectOption<string>, boolean>) {
    const data = props.data as PropertySelectOption;
    return (
        <rsComponents.SingleValue {...props}>
            <Tag
                text={data.label}
                color={data.color}
                size='sm'
            />
        </rsComponents.SingleValue>
    );
}

// Render the chip label as a colored Tag; keep the default MultiValueContainer
// and MultiValueRemove so the per-chip × continues to work.
function PropertyMultiValueLabel(props: MultiValueGenericProps<LabeledSelectOption<string>, boolean>) {
    const data = props.data as PropertySelectOption;
    return (
        <rsComponents.MultiValueLabel {...props}>
            <Tag
                text={data.label}
                color={data.color}
                size='sm'
            />
        </rsComponents.MultiValueLabel>
    );
}

function getOptions(field: PropertyValueEditorProps['field']): PropertyFieldOption[] {
    return (field.attrs?.options as PropertyFieldOption[] | undefined) ?? [];
}

function toOption(opt: PropertyFieldOption): PropertySelectOption {
    return {value: opt.id, label: opt.name, color: opt.color};
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

    const handleChange = useCallback((next: PropertySelectOption | PropertySelectOption[] | null) => {
        if (multi) {
            const arr = (next as PropertySelectOption[] | null) ?? [];
            onChange(arr.map((o) => o.value));
            return;
        }
        const single = next as PropertySelectOption | null;
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
            <LabeledSelect<string>
                inputId={`property-value-editor-${field.id}`}
                aria-label={field.name}
                placeholder={formatMessage({
                    id: 'property_value_editor.select.placeholder',
                    defaultMessage: 'Select',
                })}
                value={selectedValue}
                options={opts}
                onChange={handleChange}
                isMulti={multi}
                isSearchable={false}
                components={{
                    Option: PropertyOption,
                    SingleValue: PropertySingleValue,
                    MultiValueLabel: PropertyMultiValueLabel,
                }}
                menuPortalTarget={typeof document === 'undefined' ? null : document.body}
                menuPlacement='auto'
            />
        </div>
    );
}
