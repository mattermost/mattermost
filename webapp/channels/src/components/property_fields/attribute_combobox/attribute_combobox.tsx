// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import type {FocusEventHandler, ReactNode} from 'react';
import {defineMessages, useIntl} from 'react-intl';

import {Combobox} from '@mattermost/compass-ui/components/combobox';
import type {ComboboxOption} from '@mattermost/compass-ui/components/combobox';
import type {PropertyFieldOption} from '@mattermost/types/properties';

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

export type AttributeOptionDecoration = {
    leadingVisual?: ReactNode;
    secondaryLabel?: ReactNode;
};

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

    /**
     * Single mode only: per-option leading visual and secondary text, replacing the
     * default colour swatch. Must be a stable reference. Ignored with `multiple`,
     * since Compass copies a row's visual into its chip.
     */
    decorateOption?: (option: PropertyFieldOption) => AttributeOptionDecoration;
};

type DecoratedOptions = {
    comboboxOptions: ComboboxOption[];
    visualsById: ReadonlyMap<string, ReactNode>;
};

function hasVisual(visual: ReactNode): boolean {
    return visual != null && typeof visual !== 'boolean';
}

function defaultDecoration(option: PropertyFieldOption): AttributeOptionDecoration {
    return option.color ? {leadingVisual: <AttributeOptionSwatch color={option.color}/>} : {};
}

function toComboboxOptions(
    options: readonly PropertyFieldOption[],
    testIdPrefix?: string,
    decorate?: (option: PropertyFieldOption) => AttributeOptionDecoration,
): DecoratedOptions {
    const decorations = decorate ? options.map(decorate) : [];

    // Compass reserves the leading slot per row, so rows without a visual need a placeholder to stay aligned.
    const reserveSlot = decorations.some((decoration) => hasVisual(decoration.leadingVisual));
    const visualsById = new Map<string, ReactNode>();

    const comboboxOptions = options.map((option, index) => {
        const comboboxOption: ComboboxOption = {value: option.id, label: option.name};
        if (testIdPrefix) {
            comboboxOption.menuItemProps = {'data-testid': `${testIdPrefix}-option-${option.id}`};
        }

        const {leadingVisual, secondaryLabel} = decorations[index] ?? {};
        if (hasVisual(leadingVisual)) {
            comboboxOption.leadingVisual = leadingVisual;
            visualsById.set(option.id, leadingVisual);
        } else if (reserveSlot) {
            comboboxOption.leadingVisual = <AttributeOptionVisualPlaceholder/>;
        }
        if (secondaryLabel) {
            comboboxOption.secondaryLabel = secondaryLabel;
        }
        return comboboxOption;
    });

    return {comboboxOptions, visualsById};
}

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
    required,
    placeholder,
    zIndex,
    className,
    'aria-describedby': ariaDescribedBy,
    submitOnEnter,
    onBlur,
    decorateOption,
}: AttributeComboboxProps) {
    const {formatMessage} = useIntl();
    const labels = useMemo(() => ({
        listboxLabel: formatMessage(messages.listbox),
        clearLabel: formatMessage(messages.clear, {label}),
        selectionsLabel: formatMessage(messages.selections, {label}),
        emptyMessage: formatMessage(messages.empty),
        loadingMessage: formatMessage(messages.loading),
    }), [formatMessage, label]);
    const {comboboxOptions, visualsById} = useMemo(
        () => toComboboxOptions(options, testId, multiple ? undefined : decorateOption ?? defaultDecoration),
        [options, testId, multiple, decorateOption],
    );

    const values = useMemo(() => {
        if (Array.isArray(value)) {
            return value;
        }
        return value ? [value] : [];
    }, [value]);

    const leadingIcon = useMemo(() => visualsById.get(values[0] ?? ''), [visualsById, values]);

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
