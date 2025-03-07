// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen, render, fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {renderWithContext} from 'tests/react_testing_utils';
import DataGrid from './data_grid';

describe('components/admin_console/data_grid/DataGrid', () => {
    const baseProps = {
        page: 1,
        startCount: 0,
        endCount: 0,
        total: 0,
        loading: false,

        nextPage: jest.fn(),
        previousPage: jest.fn(),
        onSearch: jest.fn(),

        rows: [],
        columns: [],
        term: '',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render empty state when no items found', () => {
        renderWithContext(
            <DataGrid
                {...baseProps}
            />
        );
        
        // Verify empty state message is displayed
        expect(screen.getByText('No items found')).toBeInTheDocument();
    });

    test('should render loading state', () => {
        renderWithContext(
            <DataGrid
                {...baseProps}
                loading={true}
            />
        );
        
        // Verify loading message is displayed
        expect(screen.getByText('Loading')).toBeInTheDocument();
    });

    test('should render content with custom styling', () => {
        // Use jest.spyOn on window.matchMedia to mock resize behavior
        jest.spyOn(window, 'addEventListener').mockImplementation(() => {});
        jest.spyOn(window, 'removeEventListener').mockImplementation(() => {});
        // Mock clientWidth to ensure columns are shown
        jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(1000);
        
        const {container} = renderWithContext(
            <DataGrid
                {...baseProps}
                rows={[
                    {cells: {name: 'Joe Schmoe', team: 'Admin Team'}},
                    {cells: {name: 'Foo Bar', team: 'Admin Team'}},
                    {cells: {name: 'Some Guy', team: 'Admin Team'}},
                ]}
                columns={[
                    {name: 'Name', field: 'name', width: 3, overflow: 'hidden'},
                    {name: 'Team', field: 'team', textAlign: 'center'},
                ]}
            />
        );
        
        // Check for row data directly
        expect(screen.getByText('Joe Schmoe')).toBeInTheDocument();
        expect(screen.getByText('Foo Bar')).toBeInTheDocument();
        expect(screen.getByText('Some Guy')).toBeInTheDocument();
        expect(screen.getAllByText('Admin Team').length).toBe(3);
    });

    test('should render with custom class', () => {
        const {container} = renderWithContext(
            <DataGrid
                {...baseProps}
                rows={[
                    {cells: {name: 'Joe Schmoe', team: 'Admin Team'}},
                    {cells: {name: 'Foo Bar', team: 'Admin Team'}},
                    {cells: {name: 'Some Guy', team: 'Admin Team'}},
                ]}
                columns={[
                    {name: 'Name', field: 'name'},
                    {name: 'Team', field: 'team'},
                ]}
                className={'customTable'}
            />
        );
        
        // Verify custom class is applied to the DataGrid
        const dataGridElement = container.querySelector('div.DataGrid');
        expect(dataGridElement).toHaveClass('customTable');
    });
    
    test('should render pagination and handle page navigation', () => {
        const {container} = renderWithContext(
            <DataGrid
                {...baseProps}
                startCount={1}
                endCount={10}
                total={20}
            />
        );
        
        // Verify pagination text is displayed
        expect(screen.getByText('1 - 10 of 20')).toBeInTheDocument();
        
        // Get next and previous buttons using container query
        const prevButton = container.querySelector('.prev');
        const nextButton = container.querySelector('.next');
        
        // First page, prev should be disabled
        expect(prevButton).toHaveClass('disabled');
        expect(nextButton).not.toHaveClass('disabled');
        
        // Click next page
        userEvent.click(nextButton!);
        expect(baseProps.nextPage).toHaveBeenCalledTimes(1);
    });
    
    test('should handle search when provided', async () => {
        // Create a new mock function specifically for this test
        const onSearchMock = jest.fn();
        
        renderWithContext(
            <DataGrid
                {...baseProps}
                onSearch={onSearchMock}
            />
        );
        
        // Find search input
        const searchInput = screen.getByPlaceholderText('Search');
        
        // Set value directly and trigger submit
        fireEvent.change(searchInput, { target: { value: 'test search' } });
        fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });
        
        // Check if onSearch was called with the search term
        expect(onSearchMock).toHaveBeenCalledWith('test search');
    });
});
