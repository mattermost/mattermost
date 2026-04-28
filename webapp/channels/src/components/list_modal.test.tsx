// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Group} from '@mattermost/types/groups';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ListModal, {DEFAULT_NUM_PER_PAGE} from './list_modal';

describe('components/ListModal', () => {
    const mockItem1 = TestHelper.getGroupMock({id: '123', name: 'bar31'});
    const mockItem2 = TestHelper.getGroupMock({id: '234', name: 'bar2'});
    const mockItem3 = TestHelper.getGroupMock({id: '345', name: 'bar3'});
    const mockItems = [mockItem1, mockItem2];
    const mockItemsPage2 = [mockItem3];
    const mockSearchTerm = 'ar3';
    const mockItemsSearch = mockItems.concat(mockItemsPage2).filter((item) => item.name.includes(mockSearchTerm));
    const totalCount = mockItems.length + mockItemsPage2.length;

    const baseProps = {
        loadItems: jest.fn(async (pageNumber: number, searchTerm: string) => {
            if (searchTerm === mockSearchTerm) {
                return {items: mockItemsSearch, totalCount};
            }
            if (pageNumber === 0) {
                return {items: mockItems, totalCount};
            }
            return {items: mockItemsPage2, totalCount};
        }),
        renderRow: (item: Group) => {
            return (
                <div
                    className='item'
                    key={item.id}
                    data-testid={`item-${item.id}`}
                >
                    {item.id}
                </div>
            );
        },
        titleText: 'list modal',
        searchPlaceholderText: 'search for name',
        numPerPage: DEFAULT_NUM_PER_PAGE,
        titleBarButtonText: 'DEFAULT',
        titleBarButtonTextOnClick: () => {},
    };

    it('should match snapshot', async () => {
        const {baseElement} = renderWithContext(
            <ListModal {...baseProps}/>,
        );

        // Wait for items to load
        await waitFor(() => {
            expect(screen.getByTestId('item-123')).toBeInTheDocument();
        });

        expect(baseElement).toMatchSnapshot();

        // Verify items are rendered
        expect(screen.getByTestId('item-123')).toBeInTheDocument();
        expect(screen.getByTestId('item-234')).toBeInTheDocument();

        // Verify pagination text
        expect(screen.getByText(/1 - 2 of 3 total/)).toBeInTheDocument();
    });

    it('should update numPerPage', async () => {
        const numPerPage = totalCount - 1; // numPerPage = 2
        const props = {...baseProps, numPerPage};
        renderWithContext(
            <ListModal {...props}/>,
        );

        // Wait for items to load
        await waitFor(() => {
            expect(screen.getByTestId('item-123')).toBeInTheDocument();
        });

        // Verify numPerPage is applied by checking Next button appears
        // With numPerPage=2 and 2 items loaded, items.length >= numPerPage is true
        // so Next button should be visible (unlike default numPerPage=50 where it wouldn't)
        expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
    });

    it('should match snapshot with title bar button', async () => {
        const props = {
            ...baseProps,
            titleBarButtonText: 'Add Foo',
            titleBarButtonOnClick: jest.fn(),
        };
        const {baseElement} = renderWithContext(
            <ListModal {...props}/>,
        );

        // Wait for items to load
        await waitFor(() => {
            expect(screen.getByTestId('item-123')).toBeInTheDocument();
        });

        expect(baseElement).toMatchSnapshot();

        // Verify title bar button is present
        expect(screen.getByRole('link', {name: 'Add Foo'})).toBeInTheDocument();
    });

    test('should have called onHide when handleExit is called', async () => {
        const onHide = jest.fn();
        const props = {...baseProps, onHide};
        const {baseElement} = renderWithContext(
            <ListModal {...props}/>,
        );

        // Wait for items to load
        await waitFor(() => {
            expect(screen.getByTestId('item-123')).toBeInTheDocument();
        });

        // Click the modal close button
        const closeButton = baseElement.querySelector('.close') as HTMLElement;
        await userEvent.click(closeButton);

        // Wait for onHide to be called (called after exit animation)
        await waitFor(() => {
            expect(onHide).toHaveBeenCalledTimes(1);
        });
    });

    test('paging loads new items', async () => {
        const props = {
            ...baseProps,
            numPerPage: 2, // Set to 2 so Next button appears when we have 2 items
        };
        renderWithContext(
            <ListModal {...props}/>,
        );

        // Wait for initial items to load
        await waitFor(() => {
            expect(screen.getByTestId('item-123')).toBeInTheDocument();
        });

        // Verify page 1 items
        expect(screen.getByTestId('item-123')).toBeInTheDocument();
        expect(screen.getByTestId('item-234')).toBeInTheDocument();

        // Click Next
        await userEvent.click(screen.getByRole('button', {name: 'Next'}));

        // Wait for page 2 items
        await waitFor(() => {
            expect(screen.getByTestId('item-345')).toBeInTheDocument();
        });

        // Verify page 1 items are gone and page 2 items are present
        expect(screen.queryByTestId('item-123')).not.toBeInTheDocument();
        expect(screen.getByTestId('item-345')).toBeInTheDocument();

        // Click Previous
        await userEvent.click(screen.getByRole('button', {name: 'Previous'}));

        // Wait for page 1 items again
        await waitFor(() => {
            expect(screen.getByTestId('item-123')).toBeInTheDocument();
        });

        // Verify we're back on page 1
        expect(screen.getByTestId('item-123')).toBeInTheDocument();
        expect(screen.getByTestId('item-234')).toBeInTheDocument();
    });

    test('search input', async () => {
        renderWithContext(
            <ListModal {...baseProps}/>,
        );

        // Wait for initial items to load
        await waitFor(() => {
            expect(screen.getByTestId('item-123')).toBeInTheDocument();
        });

        // Type in search input
        const searchInput = screen.getByPlaceholderText('search for name');
        await userEvent.type(searchInput, mockSearchTerm);

        // Wait for filtered items
        await waitFor(() => {
            // mockItemsSearch contains items with 'ar3' in name: bar31 and bar3
            expect(screen.getByTestId('item-123')).toBeInTheDocument(); // bar31 matches
        });

        // Verify item-234 (bar2) is not present since it doesn't match 'ar3'
        expect(screen.queryByTestId('item-234')).not.toBeInTheDocument();
    });
});
