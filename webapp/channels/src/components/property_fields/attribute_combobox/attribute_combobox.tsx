// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';

import {Combobox} from '@mattermost/compass-ui/components/combobox';
import type {PropertyFieldOption} from '@mattermost/types/properties';

import {useComboboxLabels} from 'components/widgets/combobox';

import {
    getAttributeComboboxClearButtonProps,
    getAttributeComboboxWrapperProps,
    toComboboxOptions,
} from './attribute_combobox_utils';

type SingleProps = {
    multiple?: false;
    value: string;
    onChange: (value: string) => void;
};

type MultiProps = {
    multiple: true;
    value: string[];
    onChange: (value: string[]) => void;
};

export type AttributeComboboxProps = (SingleProps | MultiProps) & {

    /** Field name: the input's accessible name, also used in the clear and selections labels. */
    label: string;
    options: PropertyFieldOption[] | undefined;
    id?: string;

    /** Test ID of the input, and prefix for the option and clear-button test IDs. */
    testId?: string;
    disabled?: boolean;
    invalid?: boolean;
    placeholder?: string;
    'aria-describedby'?: string;

    /** Stacking order for the portaled menu, e.g. COMBOBOX_Z_INDEX_IN_MODAL inside a modal. */
    zIndex?: number;
};

export function AttributeCombobox(props: AttributeComboboxProps) {
    const {label, options, id, testId, disabled, invalid, placeholder, zIndex} = props;

    const labels = useComboboxLabels(label);
    const comboboxOptions = useMemo(() => toComboboxOptions(options, testId), [options, testId]);

    // Values found in options resolve from there first; the rest (e.g. deleted
    // options) still render, labelled with their raw id.
    const selectedOptions = useMemo(() => {
        let values: string[] = [];
        if (props.multiple) {
            values = props.value;
        } else if (props.value) {
            values = [props.value];
        }
        return values.map((value) => ({value, label: value}));
    }, [props.multiple, props.value]);

    const handleChange = (next: string | string[] | null) => {
        if (props.multiple) {
            props.onChange(Array.isArray(next) ? next : []);
        } else {
            props.onChange(typeof next === 'string' ? next : '');
        }
    };

    return (
        <div {...getAttributeComboboxWrapperProps()}>
            <Combobox
                id={id}
                data-testid={testId}
                aria-label={label}
                aria-describedby={props['aria-describedby']}
                options={comboboxOptions}
                multiple={props.multiple}
                value={props.value}
                selectedOptions={selectedOptions}
                clearable={true}
                clearButtonProps={getAttributeComboboxClearButtonProps(testId ? `${testId}-clear` : undefined)}
                disabled={disabled}
                invalid={invalid}
                placeholder={placeholder}
                zIndex={zIndex}
                {...labels}
                onChange={handleChange}
            />
        </div>
    );
}
