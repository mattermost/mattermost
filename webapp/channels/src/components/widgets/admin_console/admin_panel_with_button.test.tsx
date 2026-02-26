// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

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

    test('should render with button', () => {
        const {container} = renderWithContext(
            <AdminPanelWithButton {...defaultProps}>
                {'Test'}
            </AdminPanelWithButton>,
        );

        const panel = container.querySelector('#test-id');
        expect(panel).toBeInTheDocument();
        expect(panel).toHaveClass('AdminPanel', 'AdminPanelWithButton', 'test-class-name');

        expect(screen.getByText('test-title-default')).toBeInTheDocument();
        expect(screen.getByText('test-subtitle-default')).toBeInTheDocument();
        expect(screen.getByText('Test')).toBeInTheDocument();

        const button = screen.getByTestId('test-button-text-default');
        expect(button).toBeInTheDocument();
        expect(button).toHaveClass('btn', 'btn-primary');
        expect(button).not.toHaveClass('disabled');
        expect(screen.getByText('test-button-text-default')).toBeInTheDocument();
    });

    test('should render disabled button when disabled prop is true', () => {
        const onButtonClick = jest.fn();
        renderWithContext(
            <AdminPanelWithButton
                {...defaultProps}
                disabled={true}
                onButtonClick={onButtonClick}
            >
                {'Test'}
            </AdminPanelWithButton>,
        );

        const button = screen.getByTestId('test-button-text-default');
        expect(button).toBeInTheDocument();
        expect(button).toHaveClass('btn', 'btn-primary', 'disabled');
    });

    test('should call onButtonClick when button is clicked', async () => {
        const onButtonClick = jest.fn();
        renderWithContext(
            <AdminPanelWithButton
                {...defaultProps}
                onButtonClick={onButtonClick}
            >
                {'Test'}
            </AdminPanelWithButton>,
        );

        const button = screen.getByTestId('test-button-text-default');
        await userEvent.click(button);

        expect(onButtonClick).toHaveBeenCalledTimes(1);
    });
});
