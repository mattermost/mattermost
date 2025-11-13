// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import userEvent from '@testing-library/user-event';
import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

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
        const {container} = renderWithContext(
            <AdminPanel {...defaultProps}>{'Test'}</AdminPanel>,
        );

        const panel = container.querySelector('#test-id');
        expect(panel).toBeInTheDocument();
        expect(panel).toHaveClass('AdminPanel', 'clearfix', 'test-class-name');

        expect(screen.getByRole('heading', {level: 3})).toHaveTextContent('test-title-default');
        expect(screen.getByText('test-subtitle-default')).toBeInTheDocument();
        expect(screen.getByText('Test')).toBeInTheDocument();

        const header = container.querySelector('.header');
        expect(header).toBeInTheDocument();
        expect(container.querySelector('.button')).not.toBeInTheDocument();
    });

    test('should render with button when provided', () => {
        const {container} = renderWithContext(
            <AdminPanel
                {...defaultProps}
                button={<span>{'TestButton'}</span>}
            >
                {'Test'}
            </AdminPanel>,
        );

        expect(screen.getByText('TestButton')).toBeInTheDocument();
        expect(container.querySelector('.button')).toBeInTheDocument();
        expect(screen.getByText('test-title-default')).toBeInTheDocument();
        expect(screen.getByText('Test')).toBeInTheDocument();
    });

    test('should call onHeaderClick when header is clicked', async () => {
        const onHeaderClick = jest.fn();
        const {container} = renderWithContext(
            <AdminPanel
                {...defaultProps}
                onHeaderClick={onHeaderClick}
            >
                {'Test'}
            </AdminPanel>,
        );

        const header = container.querySelector('.header');
        expect(header).toBeInTheDocument();

        await userEvent.click(header!);

        expect(onHeaderClick).toHaveBeenCalledTimes(1);
    });
});
