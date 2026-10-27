// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {defineMessages, useIntl} from 'react-intl';

const messages = defineMessages({
    listbox: {
        id: 'combobox.listbox',
        defaultMessage: 'Options',
        description: 'Accessible name of a dropdown\'s option list when no field name is available.',
    },
    clear: {
        id: 'combobox.clear',
        defaultMessage: 'Clear {label}',
        description: 'Accessible name of the button that clears a single-value dropdown. {label} is the field name.',
    },
    selections: {
        id: 'combobox.selections',
        defaultMessage: '{label} selections',
        description: 'Accessible name of the group of selected-value chips in a multi-value dropdown. {label} is the field name.',
    },
    empty: {
        id: 'combobox.empty',
        defaultMessage: 'No results',
        description: 'Shown in a dropdown when no option matches the typed text.',
    },
    loading: {
        id: 'combobox.loading',
        defaultMessage: 'Loading…',
        description: 'Shown in a dropdown while options load.',
    },
});

export type ComboboxLabels = {
    listboxLabel: string;
    clearLabel: string;
    selectionsLabel: string;
    emptyMessage: string;
    loadingMessage: string;
};

export function useComboboxLabels(fieldLabel: string): ComboboxLabels {
    const {formatMessage} = useIntl();
    return useMemo(() => ({
        listboxLabel: formatMessage(messages.listbox),
        clearLabel: formatMessage(messages.clear, {label: fieldLabel}),
        selectionsLabel: formatMessage(messages.selections, {label: fieldLabel}),
        emptyMessage: formatMessage(messages.empty),
        loadingMessage: formatMessage(messages.loading),
    }), [formatMessage, fieldLabel]);
}
