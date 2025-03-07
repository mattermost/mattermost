// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AdminButtonOutline from './admin_button_outline';

describe('components/admin_console/admin_button_outline/AdminButtonOutline', () => {
    test('should render correctly with prop disable false', () => {
        const onClick = jest.fn();
        render(
            <AdminButtonOutline
                onClick={onClick}
                className='admin-btn-default'
                disabled={false}
            />,
        );
        
        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        expect(button).not.toBeDisabled();
        expect(button).toHaveClass('AdminButtonOutline', 'btn', 'admin-btn-default');
    });

    test('should render correctly with prop disable true', () => {
        const onClick = jest.fn();
        render(
            <AdminButtonOutline
                onClick={onClick}
                className='admin-btn-default'
                disabled={true}
            />,
        );
        
        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        expect(button).toBeDisabled();
        expect(button).toHaveClass('AdminButtonOutline', 'btn', 'admin-btn-default');
    });

    test('should render correctly with children', () => {
        const onClick = jest.fn();
        render(
            <AdminButtonOutline
                onClick={onClick}
                className='admin-btn-default'
                disabled={true}
            >
                {'Test children'}
            </AdminButtonOutline>,
        );
        
        const button = screen.getByRole('button', {name: 'Test children'});
        expect(button).toBeInTheDocument();
        expect(button).toBeDisabled();
        expect(button).toHaveClass('AdminButtonOutline', 'btn', 'admin-btn-default');
        expect(button).toHaveTextContent('Test children');
    });

    test('should render correctly with className is not provided in scss file', () => {
        const onClick = jest.fn();
        render(
            <AdminButtonOutline
                onClick={onClick}
                className='btn-default'
                disabled={true}
            >
                {'Test children'}
            </AdminButtonOutline>,
        );
        
        const button = screen.getByRole('button', {name: 'Test children'});
        expect(button).toBeInTheDocument();
        expect(button).toHaveClass('AdminButtonOutline', 'btn', 'btn-default');
    });

    test('should handle onClick', async () => {
        const onClick = jest.fn();
        render(
            <AdminButtonOutline
                onClick={onClick}
                className='admin-btn-default'
                disabled={false}
            >
                {'Test children'}
            </AdminButtonOutline>,
        );
        
        const button = screen.getByRole('button', {name: 'Test children'});
        await userEvent.click(button);
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
