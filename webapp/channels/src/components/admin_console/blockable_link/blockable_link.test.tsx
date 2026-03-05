// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter} from 'react-router-dom';

import {render, screen, userEvent} from 'tests/react_testing_utils';

import BlockableLink from './blockable_link';

jest.mock('utils/browser_history', () => ({
    getHistory: jest.fn().mockReturnValue({
        push: jest.fn(),
    }),
}));

describe('components/admin_console/blockable_link/BlockableLink', () => {
    const defaultProps = {
        to: '/admin_console/test',
        blocked: false,
        actions: {
            deferNavigation: jest.fn(),
        },
        children: 'Link Text',
    };

    test('should render properly', () => {
        render(
            <MemoryRouter>
                <BlockableLink {...defaultProps}/>
            </MemoryRouter>,
        );

        expect(screen.getByText('Link Text')).toBeInTheDocument();
        expect(screen.getByRole('link')).toHaveAttribute('href', '/admin_console/test');
    });

    test('should navigate directly when not blocked', async () => {
        render(
            <MemoryRouter>
                <BlockableLink {...defaultProps}/>
            </MemoryRouter>,
        );

        await userEvent.click(screen.getByText('Link Text'));
        expect(defaultProps.actions.deferNavigation).not.toHaveBeenCalled();
    });

    test('should defer navigation when blocked', async () => {
        const blockedProps = {
            ...defaultProps,
            blocked: true,
        };

        render(
            <MemoryRouter>
                <BlockableLink {...blockedProps}/>
            </MemoryRouter>,
        );

        await userEvent.click(screen.getByText('Link Text'));
        expect(blockedProps.actions.deferNavigation).toHaveBeenCalled();
    });

    test('should call custom onClick handler if provided', async () => {
        const onClickProps = {
            ...defaultProps,
            onClick: jest.fn(),
        };

        render(
            <MemoryRouter>
                <BlockableLink {...onClickProps}/>
            </MemoryRouter>,
        );

        await userEvent.click(screen.getByText('Link Text'));
        expect(onClickProps.onClick).toHaveBeenCalled();
    });

    test('should apply additional props correctly', () => {
        const customProps = {
            ...defaultProps,
            className: 'custom-class',
            id: 'custom-id',
            'data-testid': 'custom-test-id',
        };

        render(
            <MemoryRouter>
                <BlockableLink {...customProps}/>
            </MemoryRouter>,
        );

        const link = screen.getByRole('link');
        expect(link).toHaveClass('custom-class');
        expect(link).toHaveAttribute('id', 'custom-id');
        expect(link).toHaveAttribute('data-testid', 'custom-test-id');
    });
});
