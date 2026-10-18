// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import DataGridSearch from './data_grid_search';

describe('components/admin_console/data_grid/DataGridSearch', () => {
    test('clear button is in the tab order when the field has a value', async () => {
        const onSearch = jest.fn();
        renderWithContext(
            <DataGridSearch
                term='teams'
                onSearch={onSearch}
            />,
        );

        const clearButton = screen.getByTestId('clear-search');
        expect(clearButton).toHaveAttribute('tabindex', '0');

        await userEvent.click(clearButton);
        expect(onSearch).toHaveBeenCalledWith('');
    });

    test('Escape clears the search from the input', async () => {
        const onSearch = jest.fn();
        renderWithContext(
            <DataGridSearch
                term='teams'
                onSearch={onSearch}
            />,
        );

        const input = screen.getByTestId('searchInput');
        await userEvent.click(input);
        await userEvent.keyboard('{Escape}');

        expect(onSearch).toHaveBeenCalledWith('');
    });
});
