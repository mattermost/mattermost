// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {withIntl} from 'tests/helpers/intl-test-helper';
import {render, screen, userEvent} from 'tests/react_testing_utils';

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

    test('should render with open state showing title, subtitle, and content', () => {
        render(
            withIntl(
                <AdminPanelTogglable {...defaultProps}>
                    {'Test Content'}
                </AdminPanelTogglable>,
            ),
        );

        const panel = document.getElementById('test-id');
        expect(panel).toBeInTheDocument();
        expect(panel).not.toHaveClass('closed');

        // Verify all user-visible content
        expect(screen.getByText('test-title-default')).toBeInTheDocument();
        expect(screen.getByText('test-subtitle-default')).toBeInTheDocument();
        expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    test('should render with closed state', () => {
        render(
            withIntl(
                <AdminPanelTogglable
                    {...defaultProps}
                    open={false}
                >
                    {'Test Content'}
                </AdminPanelTogglable>,
            ),
        );

        const panel = document.getElementById('test-id');
        expect(panel).toBeInTheDocument();
        expect(panel).toHaveClass('closed');
        expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    test('should call onToggle when header is clicked', async () => {
        const onToggle = jest.fn();

        render(
            withIntl(
                <AdminPanelTogglable
                    {...defaultProps}
                    onToggle={onToggle}
                >
                    {'Test Content'}
                </AdminPanelTogglable>,
            ),
        );

        // Click on the title/header area
        const title = screen.getByText('test-title-default');
        await userEvent.click(title);

        expect(onToggle).toHaveBeenCalledTimes(1);
    });
});
