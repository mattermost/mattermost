// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import AdminPanelTogglable from './admin_panel_togglable';

describe('components/widgets/admin_console/AdminPanelTogglable', () => {
    const defaultProps = {
        className: 'test-class-name',
        id: 'test-id',
        title: {id: 'test-title-id', defaultMessage: 'test-title-default'},
        subtitle: {
            id: 'test-subtitle-id',
            defaultMessage: 'test-subtitle-default',
        },
        open: true,
        onToggle: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render with open state', () => {
        const {container} = renderWithContext(
            <AdminPanelTogglable {...defaultProps}>
                {'Test'}
            </AdminPanelTogglable>,
        );

        // Verify title and subtitle are displayed
        expect(screen.getByText('test-title-default')).toBeInTheDocument();
        expect(screen.getByText('test-subtitle-default')).toBeInTheDocument();

        // Verify content is displayed
        expect(screen.getByText('Test')).toBeInTheDocument();

        // Verify it has the right classes in open state
        const panel = container.querySelector('.AdminPanelTogglable');
        expect(panel).toHaveClass('test-class-name');
        expect(panel).not.toHaveClass('closed');
    });

    test('should render with closed state', () => {
        const {container} = renderWithContext(
            <AdminPanelTogglable
                {...defaultProps}
                open={false}
            >
                {'Test'}
            </AdminPanelTogglable>,
        );

        // Verify title and subtitle are still displayed when closed
        expect(screen.getByText('test-title-default')).toBeInTheDocument();
        expect(screen.getByText('test-subtitle-default')).toBeInTheDocument();

        // Verify content is still in the DOM even when closed (it's just styled differently)
        expect(screen.getByText('Test')).toBeInTheDocument();

        // Verify it has the closed class
        const panel = container.querySelector('.AdminPanelTogglable');
        expect(panel).toHaveClass('test-class-name', 'closed');
    });

    test('should call onToggle when header is clicked', () => {
        renderWithContext(
            <AdminPanelTogglable {...defaultProps}>
                {'Test'}
            </AdminPanelTogglable>,
        );

        // Find and click the header
        const header = screen.getByText('test-title-default').closest('.header');
        fireEvent.click(header!);

        // Verify onToggle was called
        expect(defaultProps.onToggle).toHaveBeenCalledTimes(1);
    });
});
