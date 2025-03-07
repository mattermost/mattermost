// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen, fireEvent} from '@testing-library/react';

import {renderWithContext} from 'tests/react_testing_utils';

import AdminPanelWithButton from './admin_panel_with_button';

describe('components/widgets/admin_console/AdminPanelWithButton', () => {
    const defaultProps = {
        className: 'test-class-name',
        id: 'test-id',
        title: {id: 'test-title-id', defaultMessage: 'test-title-default'},
        subtitle: {
            id: 'test-subtitle-id',
            defaultMessage: 'test-subtitle-default',
        },
        onButtonClick: jest.fn(),
        buttonText: {
            id: 'test-button-text-id',
            defaultMessage: 'test-button-text-default',
        },
        disabled: false,
    };

    test('should render correctly with button', () => {
        renderWithContext(
            <AdminPanelWithButton {...defaultProps}>
                {'Test'}
            </AdminPanelWithButton>,
        );

        // Verify panel elements are rendered
        expect(screen.getByText('test-title-default')).toBeInTheDocument();
        expect(screen.getByText('test-subtitle-default')).toBeInTheDocument();
        expect(screen.getByText('Test')).toBeInTheDocument();
        
        // Verify button is rendered and clickable
        const button = screen.getByTestId('test-button-text-default');
        expect(button).toBeInTheDocument();
        expect(button).toHaveTextContent('test-button-text-default');
        expect(button).not.toHaveClass('disabled');
        
        // Test click handler
        fireEvent.click(button);
        expect(defaultProps.onButtonClick).toHaveBeenCalledTimes(1);
    });

    test('should render button as disabled when disabled prop is true', () => {
        renderWithContext(
            <AdminPanelWithButton
                {...defaultProps}
                disabled={true}
            >
                {'Test'}
            </AdminPanelWithButton>,
        );

        // Verify panel elements still render
        expect(screen.getByText('test-title-default')).toBeInTheDocument();
        expect(screen.getByText('test-subtitle-default')).toBeInTheDocument();
        
        // Verify button is disabled
        const button = screen.getByTestId('test-button-text-default');
        expect(button).toBeInTheDocument();
        expect(button).toHaveClass('disabled');
        
        // Test that click handler is not called when disabled
        fireEvent.click(button);
        expect(defaultProps.onButtonClick).not.toHaveBeenCalled();
    });
    
    test('should not render button when onButtonClick is not provided', () => {
        const propsWithoutButton = {
            ...defaultProps,
            onButtonClick: undefined,
        };
        
        renderWithContext(
            <AdminPanelWithButton {...propsWithoutButton}>
                {'Test'}
            </AdminPanelWithButton>,
        );
        
        // Verify panel elements render
        expect(screen.getByText('test-title-default')).toBeInTheDocument();
        expect(screen.getByText('test-subtitle-default')).toBeInTheDocument();
        
        // Verify button is not rendered
        expect(screen.queryByTestId('test-button-text-default')).not.toBeInTheDocument();
    });
});