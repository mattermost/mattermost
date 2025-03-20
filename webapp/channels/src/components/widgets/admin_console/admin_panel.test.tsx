// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import AdminPanel from './admin_panel';

describe('components/widgets/admin_console/AdminPanel', () => {
    const defaultProps = {
        className: 'test-class-name',
        id: 'test-id',
        title: {id: 'test-title-id', defaultMessage: 'test-title-default'},
        subtitle: {id: 'test-subtitle-id', defaultMessage: 'test-subtitle-default'},
        subtitleValues: {foo: 'bar'},
    };

    test('should render correctly with default props', () => {
        renderWithContext(
            <AdminPanel {...defaultProps}>{'Test'}</AdminPanel>,
        );

        // Verify the panel has the correct title and subtitle
        expect(screen.getByText('test-title-default')).toBeInTheDocument();
        expect(screen.getByText('test-subtitle-default')).toBeInTheDocument();

        // Verify the children content is rendered
        expect(screen.getByText('Test')).toBeInTheDocument();

        // Verify the panel has the correct class and ID
        const panel = screen.getByText('Test').closest('div.AdminPanel');
        expect(panel).toHaveClass('test-class-name');
        expect(panel).toHaveAttribute('id', 'test-id');
    });

    test('should render correctly with button', () => {
        renderWithContext(
            <AdminPanel
                {...defaultProps}
                button={<span data-testid='test-button'>{'TestButton'}</span>}
            >
                {'Test'}
            </AdminPanel>,
        );

        // Verify the button is rendered
        expect(screen.getByTestId('test-button')).toBeInTheDocument();
        expect(screen.getByText('TestButton')).toBeInTheDocument();

        // Verify the button is in the header
        const button = screen.getByText('TestButton');
        const buttonContainer = button.closest('div.button');
        expect(buttonContainer).toBeInTheDocument();

        // Verify other elements are still present
        expect(screen.getByText('test-title-default')).toBeInTheDocument();
        expect(screen.getByText('test-subtitle-default')).toBeInTheDocument();
        expect(screen.getByText('Test')).toBeInTheDocument();
    });

    test('should call onHeaderClick when header is clicked', () => {
        const onHeaderClick = jest.fn();

        renderWithContext(
            <AdminPanel
                {...defaultProps}
                onHeaderClick={onHeaderClick}
            >
                {'Test'}
            </AdminPanel>,
        );

        // Find the header and click it
        const header = screen.getByText('test-title-default').closest('div.header');
        fireEvent.click(header!);

        // Verify the click handler was called
        expect(onHeaderClick).toHaveBeenCalledTimes(1);
    });
});
