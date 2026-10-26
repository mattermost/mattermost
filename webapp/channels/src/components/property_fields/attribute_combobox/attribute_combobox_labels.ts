// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

const messages = defineMessages({
    listbox: {
        id: 'property_fields.attribute_combobox.listbox',
        defaultMessage: 'Options',
        description: 'Accessible name of an attribute value dropdown\'s option list when no field name is available.',
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
        description: 'Shown in an attribute value dropdown when no option matches the typed text.',
    },
    loading: {
        id: 'property_fields.attribute_combobox.loading',
        defaultMessage: 'Loading…',
        description: 'Shown in an attribute value dropdown while options load.',
    },
});

export type AttributeComboboxLabels = {
    listboxLabel: string;
    clearLabel: string;
    selectionsLabel: string;
    emptyMessage: string;
    loadingMessage: string;
};

export function getAttributeComboboxLabels(intl: Pick<IntlShape, 'formatMessage'>, fieldLabel: string): AttributeComboboxLabels {
    return {
        listboxLabel: intl.formatMessage(messages.listbox),
        clearLabel: intl.formatMessage(messages.clear, {label: fieldLabel}),
        selectionsLabel: intl.formatMessage(messages.selections, {label: fieldLabel}),
        emptyMessage: intl.formatMessage(messages.empty),
        loadingMessage: intl.formatMessage(messages.loading),
    };
}

export function useAttributeComboboxLabels(fieldLabel: string): AttributeComboboxLabels {
    const intl = useIntl();
    return useMemo(() => getAttributeComboboxLabels(intl, fieldLabel), [intl, fieldLabel]);
}
