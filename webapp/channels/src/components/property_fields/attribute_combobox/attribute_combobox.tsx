// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import type {FocusEventHandler, ReactElement} from 'react';
import {defineMessages, useIntl} from 'react-intl';

import {Combobox} from '@mattermost/compass-ui/components/combobox';
import type {ComboboxOption} from '@mattermost/compass-ui/components/combobox';
import type {FieldType, PropertyFieldOption} from '@mattermost/types/properties';

import {sortOptionsByRank} from 'mattermost-redux/utils/property_utils';

import RankBadge from 'components/admin_console/system_properties/rank_badge';

import {AttributeOptionSwatch, AttributeOptionVisualPlaceholder} from './attribute_option_swatch';

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

export type AttributeComboboxType = 'select' | 'multiselect' | 'rank';

export type AttributeComboboxProps = {

    /**
     * select: one id, with a colour swatch on coloured options. multiselect: an
     * id list shown as chips, with no option visuals (Compass copies a row's
     * visual into its chip). rank: one id, highest rank first, with a swatch or
     * a rank badge. Default: select.
     */
    type?: AttributeComboboxType;

    /**
     * Option ids, in either shape whatever the type, since a field's stored value
     * can predate a change of its type: a multiselect treats a lone id as a
     * one-item list, and a select or rank shows the first id of a list.
     */
    value: string | string[];

    /** Called with an id ('' when cleared), or with an id list for a multiselect. */
    onChange: (value: string | string[]) => void;

    /** Field name: the input's accessible name, also used in the clear and selections labels. */
    label: string;
    options: PropertyFieldOption[];
    id?: string;

    /** Test ID of the input, and prefix for the option and clear-button test IDs. */
    testId?: string;
    disabled?: boolean;
    invalid?: boolean;

    /** Marks the input required for assistive tech (aria-required). Validation stays with the caller. */
    required?: boolean;
    placeholder?: string;

    /** Stacking order for the portaled menu, e.g. ZIndex.MENU inside a modal. */
    zIndex?: number;

    /** Class for the wrapper, the element a layout sizes. */
    className?: string;
    'aria-describedby'?: string;

    /**
     * When false, Enter with the menu closed can't submit a surrounding form or
     * reach document listeners. Default: true.
     */
    submitOnEnter?: boolean;
    onBlur?: FocusEventHandler<HTMLInputElement>;
};

// Any field whose value is a list of option ids renders as a select unless it is
// a multiselect or a rank.
export function getAttributeComboboxType(field: {type: FieldType}): AttributeComboboxType {
    return field.type === 'multiselect' || field.type === 'rank' ? field.type : 'select';
}

function optionVisual(option: PropertyFieldOption, type: AttributeComboboxType): ReactElement | undefined {
    if (type === 'multiselect') {
        return undefined;
    }
    if (option.color) {
        return <AttributeOptionSwatch color={option.color}/>;
    }
    if (type === 'rank' && typeof option.rank === 'number') {
        return <RankBadge rank={option.rank}/>;
    }
    return undefined;
}

function toComboboxOptions(
    options: readonly PropertyFieldOption[],
    type: AttributeComboboxType,
    testIdPrefix?: string,
): ComboboxOption[] {
    const visuals = options.map((option) => optionVisual(option, type));

    // Compass reserves the leading slot per row, so rows without a visual need a placeholder to stay aligned.
    const reserveSlot = visuals.some(Boolean);

    return options.map((option, index) => {
        const comboboxOption: ComboboxOption = {value: option.id, label: option.name};
        if (testIdPrefix) {
            comboboxOption.menuItemProps = {'data-testid': `${testIdPrefix}-option-${option.id}`};
        }
        if (visuals[index]) {
            comboboxOption.leadingVisual = visuals[index];
        } else if (reserveSlot) {
            comboboxOption.leadingVisual = <AttributeOptionVisualPlaceholder/>;
        }
        return comboboxOption;
    });
}

export function AttributeCombobox({
    type = 'select',
    value,
    onChange,
    label,
    options,
    id,
    testId,
    disabled,
    invalid,
    required,
    placeholder,
    zIndex,
    className,
    'aria-describedby': ariaDescribedBy,
    submitOnEnter,
    onBlur,
}: AttributeComboboxProps) {
    const {formatMessage} = useIntl();
    const multiple = type === 'multiselect';
    const labels = useMemo(() => ({
        listboxLabel: formatMessage(messages.listbox),
        clearLabel: formatMessage(messages.clear, {label}),
        selectionsLabel: formatMessage(messages.selections, {label}),
        emptyMessage: formatMessage(messages.empty),
        loadingMessage: formatMessage(messages.loading),
    }), [formatMessage, label]);
    const orderedOptions = useMemo(() => (type === 'rank' ? sortOptionsByRank(options) : options), [options, type]);
    const comboboxOptions = useMemo(() => toComboboxOptions(orderedOptions, type, testId), [orderedOptions, type, testId]);

    const values = useMemo(() => {
        if (Array.isArray(value)) {
            return value;
        }
        return value ? [value] : [];
    }, [value]);

    const leadingIcon = useMemo(() => {
        const selected = options.find((option) => option.id === values[0]);
        return selected ? optionVisual(selected, type) : undefined;
    }, [options, type, values]);

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

    return (
        <Combobox
            id={id}
            data-testid={testId}
            aria-label={label}
            aria-describedby={ariaDescribedBy}
            className={className}
            options={comboboxOptions}
            multiple={multiple}
            value={multiple ? values : values[0] ?? ''}
            selectedOptions={selectedOptions}
            clearable={true}
            clearButtonProps={{'data-testid': testId ? `${testId}-clear` : undefined}}
            disabled={disabled}
            invalid={invalid}
            required={required}
            leadingIcon={leadingIcon}
            placeholder={placeholder}
            zIndex={zIndex}
            submitOnEnter={submitOnEnter}
            onBlur={onBlur}
            {...labels}
            onChange={handleChange}
        />
    );
}
