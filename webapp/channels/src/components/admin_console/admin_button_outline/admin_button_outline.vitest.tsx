// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import AdminButtonOutline from './admin_button_outline';

describe('components/admin_console/admin_button_outline/AdminButtonOutline', () => {
    test('should match snapshot with prop disable false', () => {
        const onClick = vi.fn();
        const {container} = renderWithContext(
            <AdminButtonOutline
                onClick={onClick}
                className='admin-btn-default'
                disabled={false}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with prop disable true', () => {
        const onClick = vi.fn();
        const {container} = renderWithContext(
            <AdminButtonOutline
                onClick={onClick}
                className='admin-btn-default'
                disabled={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with children', () => {
        const onClick = vi.fn();
        const {container} = renderWithContext(
            <AdminButtonOutline
                onClick={onClick}
                className='admin-btn-default'
                disabled={true}
            >
                {'Test children'}
            </AdminButtonOutline>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with className is not provided in scss file', () => {
        const onClick = vi.fn();
        const {container} = renderWithContext(
            <AdminButtonOutline
                onClick={onClick}
                className='btn-default'
                disabled={true}
            >
                {'Test children'}
            </AdminButtonOutline>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should handle onClick', () => {
        const onClick = vi.fn();
        renderWithContext(
            <AdminButtonOutline
                onClick={onClick}
                className='admin-btn-default'
                disabled={false}
            >
                {'Test children'}
            </AdminButtonOutline>,
        );

        const button = screen.getByRole('button');
        fireEvent.click(button);
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
