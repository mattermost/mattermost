// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import AdminPanel from './admin_panel';

describe('components/widgets/admin_console/AdminPanel', () => {
    const defaultProps = {
        className: 'test-class-name',
        id: 'test-id',
        title: {id: 'test-title-id', defaultMessage: 'test-title-default'},
        subtitle: {id: 'test-subtitle-id', defaultMessage: 'test-subtitle-default'},
        subtitleValues: {foo: 'bar'},
    };

    test('should render with title, subtitle, and children', () => {
        renderWithContext(
            <AdminPanel {...defaultProps}>{'Test'}</AdminPanel>,
        );

        // Verify panel is rendered by checking its heading
        const heading = screen.getByRole('heading', {level: 2});
        expect(heading).toHaveTextContent('test-title-default');

        // Verify panel has correct classes via its container
        const panel = document.getElementById('test-id');
        expect(panel).toHaveClass('AdminPanel', 'clearfix', 'test-class-name');
        expect(panel).toHaveAttribute('id', 'test-id');

        // Verify content is rendered
        expect(screen.getByText('test-subtitle-default')).toBeInTheDocument();
        expect(screen.getByText('Test')).toBeInTheDocument();

        // Verify button is not present
        expect(screen.queryByText(/Button/i)).not.toBeInTheDocument();
    });

    test('should render with button when provided', () => {
        renderWithContext(
            <AdminPanel
                {...defaultProps}
                button={<span>{'TestButton'}</span>}
            >
                {'Test'}
            </AdminPanel>,
        );

        // Verify button is rendered
        expect(screen.getByText('TestButton')).toBeInTheDocument();

        // Verify other content is rendered
        expect(screen.getByText('test-title-default')).toBeInTheDocument();
        expect(screen.getByText('Test')).toBeInTheDocument();
    });

    test('should call header action handler when header action is clicked', async () => {
        const onActionClick = jest.fn();
        renderWithContext(
            <AdminPanel
                {...defaultProps}
                button={
                    <button
                        type='button'
                        onClick={onActionClick}
                    >
                        {'Header action'}
                    </button>
                }
            >
                {'Test'}
            </AdminPanel>,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Header action'}));

        expect(onActionClick).toHaveBeenCalledTimes(1);
    });
});
