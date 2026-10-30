// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {defineMessages, useIntl} from 'react-intl';

import {Combobox} from '@mattermost/compass-ui/components/combobox';
import type {PropertyFieldOption} from '@mattermost/types/properties';

import {
    attributeComboboxKeyGuard,
    attributeComboboxMouseDownGuard,
    clearButtonKeyGuard,
    enterSubmitGuard,
    toComboboxOptions,
} from './attribute_combobox_utils';

const messages = defineMessages({
    listbox: {
        id: 'property_fields.attribute_combobox.listbox',
        defaultMessage: 'Options',
        description: 'Accessible name of an attribute dropdown\'s option list when no field name is available.',
    },
    clear: {
        id: 'property_fields.attribute_combobox.clear',
        defaultMessage: 'Clear {label}',
        description: 'Accessible name of the button that clears a single-value attribute. {label} is the attribute name.',
    },
    selections: {
        id: 'property_fields.attribute_combobox.selections',
        defaultMessage: '{label} selections',
        description: 'Accessible name of the group of selected-value chips in a multi-value attribute. {label} is the attribute name.',
    },
    empty: {
        id: 'property_fields.attribute_combobox.empty',
        defaultMessage: 'No results',
        description: 'Shown in an attribute dropdown when no option matches the typed text.',
    },
    loading: {
        id: 'property_fields.attribute_combobox.loading',
        defaultMessage: 'Loading…',
        description: 'Shown in an attribute dropdown while options load.',
    },
});

export type AttributeComboboxProps = {
    multiple?: boolean;

    /**
     * Option ids, in either shape whatever the mode, since a field's stored value
     * can predate a change of its type: a multiple field treats a lone id as a
     * one-item list, and a single field shows the first id of a list.
     */
    value: string | string[];

    /** Called with an id ('' when cleared), or with an id list in multiple mode. */
    onChange: (value: string | string[]) => void;

    /** Field name: the input's accessible name, also used in the clear and selections labels. */
    label: string;
    options: PropertyFieldOption[];
    id?: string;

    /** Test ID of the input, and prefix for the option and clear-button test IDs. */
    testId?: string;
    disabled?: boolean;
    invalid?: boolean;
    placeholder?: string;

    /** Stacking order for the portaled menu, e.g. ZIndex.MENU inside a modal. */
    zIndex?: number;

    /** Class for the wrapper, the element a layout sizes. */
    className?: string;
    'aria-describedby'?: string;

    /**
     * Inside a form: prevents any Enter that doesn't pick an option, so it can't
     * submit the form. That Enter then no longer reaches document listeners either.
     */
    preventEnterSubmit?: boolean;
};

export function AttributeCombobox({
    multiple = false,
    value,
    onChange,
    label,
    options,
    id,
    testId,
    disabled,
    invalid,
    placeholder,
    zIndex,
    className,
    'aria-describedby': ariaDescribedBy,
    preventEnterSubmit,
}: AttributeComboboxProps) {
    const {formatMessage} = useIntl();
    const labels = useMemo(() => ({
        listboxLabel: formatMessage(messages.listbox),
        clearLabel: formatMessage(messages.clear, {label}),
        selectionsLabel: formatMessage(messages.selections, {label}),
        emptyMessage: formatMessage(messages.empty),
        loadingMessage: formatMessage(messages.loading),
    }), [formatMessage, label]);
    const comboboxOptions = useMemo(() => toComboboxOptions(options, testId), [options, testId]);

    const values = useMemo(() => {
        if (Array.isArray(value)) {
            return value;
        }
        return value ? [value] : [];
    }, [value]);

    // Values found in options resolve from there first; the rest (e.g. deleted
    // options) still render, labelled with their raw id.
    const selectedOptions = useMemo(() => values.map((v) => ({value: v, label: v})), [values]);

    const handleChange = (next: string | string[] | null) => {
        if (multiple) {
            onChange(Array.isArray(next) ? next : []);
        } else {
            onChange(typeof next === 'string' ? next : '');
        }
    };

    // Both guards are needed: without the mousedown guard, focus can leave the
    // input and the key guard stops seeing Escape.
    return (
        <div
            role='presentation'
            className={className}
            onKeyDown={attributeComboboxKeyGuard}
            onMouseDown={attributeComboboxMouseDownGuard}
        >
            <Combobox
                id={id}
                data-testid={testId}
                aria-label={label}
                aria-describedby={ariaDescribedBy}
                options={comboboxOptions}
                multiple={multiple}
                value={multiple ? values : values[0] ?? ''}
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
                onKeyDown={preventEnterSubmit ? enterSubmitGuard : undefined}
            />
        </div>
    );
}
