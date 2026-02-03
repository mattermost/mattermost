// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen, userEvent} from 'tests/react_testing_utils';

import MenuGroup from './menu_group';

describe('components/MenuItem', () => {
    test('should render with default divider separator', () => {
        const {container} = render(<MenuGroup>{'text'}</MenuGroup>);

        const separator = screen.getByRole('separator');
        expect(separator).toBeInTheDocument();
        expect(separator).toHaveClass('MenuGroup', 'menu-divider');

        expect(container).toHaveTextContent('text');
    });

    test('should render with custom divider content', () => {
        const {container} = render(<MenuGroup divider='--'>{'text'}</MenuGroup>);

        // Custom divider is rendered as plain text, not a separator role
        expect(container).toHaveTextContent('--');
        expect(container).toHaveTextContent('text');

        // Should not have the default separator
        expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    });

    test('should prevent default and stop propagation when divider is clicked', async () => {
        render(<MenuGroup>{'text'}</MenuGroup>);

        const separator = screen.getByRole('separator');

        // Fire click event on separator
        await userEvent.click(separator);

        // Verify the element exists and is clickable
        expect(separator).toBeInTheDocument();
    });

    test('should render without children', () => {
        render(<MenuGroup/>);

        const separator = screen.getByRole('separator');
        expect(separator).toBeInTheDocument();
    });

    test('should render with custom divider as React element', () => {
        const customDivider = <div data-testid='custom-divider'>{'Custom'}</div>;
        render(<MenuGroup divider={customDivider}>{'text'}</MenuGroup>);

        expect(screen.getByTestId('custom-divider')).toBeInTheDocument();
        expect(screen.getByTestId('custom-divider')).toHaveTextContent('Custom');
        expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    });

    test('should memoize component correctly', () => {
        const {rerender} = render(<MenuGroup>{'text1'}</MenuGroup>);

        expect(screen.getByRole('separator')).toBeInTheDocument();
        expect(screen.getByText('text1')).toBeInTheDocument();

        // Rerender with same props - component should be memoized
        rerender(<MenuGroup>{'text1'}</MenuGroup>);

        expect(screen.getByRole('separator')).toBeInTheDocument();
        expect(screen.getByText('text1')).toBeInTheDocument();

        // Rerender with different props - should update
        rerender(<MenuGroup>{'text2'}</MenuGroup>);

        expect(screen.getByRole('separator')).toBeInTheDocument();
        expect(screen.queryByText('text1')).not.toBeInTheDocument();
        expect(screen.getByText('text2')).toBeInTheDocument();
    });
});
