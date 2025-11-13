// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import AdminPanelWithLink from './admin_panel_with_link';

describe('components/widgets/admin_console/AdminPanelWithLink', () => {
    const defaultProps = {
        className: 'test-class-name',
        id: 'test-id',
        title: {id: 'test-title-id', defaultMessage: 'test-title-default'},
        subtitle: {
            id: 'test-subtitle-id',
            defaultMessage: 'test-subtitle-default',
        },
        url: '/path',
        linkText: {
            id: 'test-button-text-id',
            defaultMessage: 'test-button-text-default',
        },
        disabled: false,
    };

    test('should render with link button', () => {
        const {container} = renderWithContext(
            <AdminPanelWithLink {...defaultProps}>{'Test'}</AdminPanelWithLink>,
        );

        const panel = container.querySelector('#test-id');
        expect(panel).toBeInTheDocument();
        expect(panel).toHaveClass('AdminPanel', 'AdminPanelWithLink', 'test-class-name');

        expect(screen.getByText('test-title-default')).toBeInTheDocument();
        expect(screen.getByText('test-subtitle-default')).toBeInTheDocument();
        expect(screen.getByText('Test')).toBeInTheDocument();

        const link = screen.getByTestId('test-id-link');
        expect(link).toBeInTheDocument();
        expect(link).toHaveClass('btn', 'btn-primary');
        expect(link).not.toHaveClass('disabled');
        expect(link).toHaveAttribute('href', '/path');
        expect(screen.getByText('test-button-text-default')).toBeInTheDocument();
    });

    test('should render disabled link when disabled prop is true', () => {
        renderWithContext(
            <AdminPanelWithLink
                {...defaultProps}
                disabled={true}
            >
                {'Test'}
            </AdminPanelWithLink>,
        );

        const link = screen.getByTestId('test-id-link');
        expect(link).toBeInTheDocument();
        expect(link).toHaveClass('btn', 'btn-primary', 'disabled');
        expect(link).toHaveAttribute('href', '/path');
    });
});
