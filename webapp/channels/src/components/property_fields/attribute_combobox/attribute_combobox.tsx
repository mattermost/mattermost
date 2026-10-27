// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';

import {Combobox} from '@mattermost/compass-ui/components/combobox';
import type {PropertyFieldOption} from '@mattermost/types/properties';

import {useComboboxLabels} from 'components/widgets/combobox';

import {A11yAttributeNames} from 'utils/constants';

import {
    attributeComboboxKeyGuard,
    attributeComboboxMouseDownGuard,
    clearButtonKeyGuard,
    toComboboxOptions,
} from './attribute_combobox_utils';

type SingleProps = {
    multiple?: false;
    value: string;
    onChange: (value: string) => void;
};

type MultiProps = {
    multiple: true;

    /** A lone id, e.g. one stored before the field became multiselect, is treated as a one-item list. */
    value: string | string[];
    onChange: (value: string[]) => void;
};

export type AttributeComboboxProps = (SingleProps | MultiProps) & {

    /** Field name: the input's accessible name, also used in the clear and selections labels. */
    label: string;
    options: PropertyFieldOption[];
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

    const values = useMemo(() => {
        if (Array.isArray(props.value)) {
            return props.value;
        }
        return props.value ? [props.value] : [];
    }, [props.value]);

    // Values found in options resolve from there first; the rest (e.g. deleted
    // options) still render, labelled with their raw id.
    const selectedOptions = useMemo(() => values.map((value) => ({value, label: value})), [values]);

    const handleChange = (next: string | string[] | null) => {
        if (props.multiple) {
            props.onChange(Array.isArray(next) ? next : []);
        } else {
            props.onChange(typeof next === 'string' ? next : '');
        }
    };

    return (

        // Wrap only the Combobox. Both guards are needed: without the mousedown
        // guard, focus can leave the input and the key guard stops seeing Escape.
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- key and focus guards only; the Combobox input owns keyboard interaction
        <div
            {...{[A11yAttributeNames.SKIP_INITIAL_FOCUS]: ''}}
            onKeyDown={attributeComboboxKeyGuard}
            onMouseDown={attributeComboboxMouseDownGuard}
        >
            <Combobox
                id={id}
                data-testid={testId}
                aria-label={label}
                aria-describedby={props['aria-describedby']}
                options={comboboxOptions}
                multiple={props.multiple}
                value={props.multiple ? values : props.value}
                selectedOptions={selectedOptions}
                clearable={true}
                clearButtonProps={{
                    'data-testid': testId ? `${testId}-clear` : undefined,
                    onKeyDown: clearButtonKeyGuard,
                }}
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
