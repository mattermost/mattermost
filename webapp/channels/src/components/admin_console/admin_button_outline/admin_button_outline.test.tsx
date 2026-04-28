// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen, userEvent} from 'tests/react_testing_utils';

import AdminButtonOutline from './admin_button_outline';

describe('components/admin_console/admin_button_outline/AdminButtonOutline', () => {
    test('should match snapshot with prop disable false', () => {
        const onClick = jest.fn();
        const {container} = render(
            <AdminButtonOutline
                onClick={onClick}
                className='admin-btn-default'
                disabled={false}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with prop disable true', () => {
        const onClick = jest.fn();
        const {container} = render(
            <AdminButtonOutline
                onClick={onClick}
                className='admin-btn-default'
                disabled={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with children', () => {
        const onClick = jest.fn();
        const {container} = render(
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
        const onClick = jest.fn();
        const {container} = render(
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

        await userEvent.click(screen.getByRole('button'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
