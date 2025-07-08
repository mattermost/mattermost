// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';

jest.mock('./list_item_size_observer', () => {
    const mockObserve = jest.fn(() => jest.fn());
    const mockUnobserve = jest.fn();

    return {
        ListItemSizeObserver: {
            getInstance: jest.fn(() => ({
                observe: mockObserve,
                unobserve: mockUnobserve,
            })),
        },
    };
});

jest.mock('lodash/debounce', () => {
    return jest.fn((fn) => {
        const debouncedFn = (...args: any[]) => fn(...args);
        debouncedFn.cancel = jest.fn();
        debouncedFn.flush = jest.fn();
        return debouncedFn;
    });
});

import ListItem from './list_item';

describe('ListItem', () => {
    const defaultProps = {
        item: <div data-testid='test-item'>{'Test Item Content'}</div>,
        itemId: 'test-item-1',
        index: 0,
        height: 100,
        width: 300,
        onHeightChange: jest.fn(),
        onUnmount: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders the item content correctly', () => {
        render(<ListItem {...defaultProps}/>);

        expect(screen.getByTestId('test-item')).toBeInTheDocument();
        expect(screen.getByText('Test Item Content')).toBeInTheDocument();
    });

    test('applies correct attributes to the wrapper div', () => {
        render(<ListItem {...defaultProps}/>);

        const wrapper = screen.getByRole('listitem');
        expect(wrapper).toHaveClass('item_measurer');
        expect(wrapper).toHaveAttribute('role', 'listitem');
    });

    test('calls onHeightChange on mount with initial height', () => {
        const mockOnHeightChange = jest.fn();

        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
            configurable: true,
            value: 120,
        });

        render(
            <ListItem
                {...defaultProps}
                onHeightChange={mockOnHeightChange}
            />,
        );

        expect(mockOnHeightChange).toHaveBeenCalledWith('test-item-1', 120, false);
    });

    test('handles zero offsetHeight gracefully', () => {
        const mockOnHeightChange = jest.fn();

        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
            configurable: true,
            value: 0,
        });

        render(
            <ListItem
                {...defaultProps}
                onHeightChange={mockOnHeightChange}
            />,
        );

        expect(mockOnHeightChange).toHaveBeenCalledWith('test-item-1', 0, false);
    });
});
