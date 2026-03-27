// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import type {FilterOption} from './filter';
import FilterList from './filter_list';

describe('admin_console/filter/FilterList', () => {
    const baseOption: FilterOption = {
        name: 'Test Filter',
        keys: ['opt1', 'opt2'],
        values: {
            opt1: {name: 'Option 1', value: true},
            opt2: {name: 'Option 2', value: false},
        },
    };

    test('should render filter name and labels', () => {
        renderWithContext(
            <FilterList
                option={baseOption}
                optionKey='test'
                updateValues={jest.fn()}
            />,
        );

        expect(screen.getByText('Test Filter')).toBeInTheDocument();
        expect(screen.getByText('Option 1')).toBeInTheDocument();
        expect(screen.getByText('Option 2')).toBeInTheDocument();
    });

    test('should render checkboxes matching boolean values', () => {
        renderWithContext(
            <FilterList
                option={baseOption}
                optionKey='test'
                updateValues={jest.fn()}
            />,
        );

        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes).toHaveLength(2);
        expect(checkboxes[0]).toBeChecked();
        expect(checkboxes[1]).not.toBeChecked();
    });
});
