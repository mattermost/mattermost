// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, render, screen} from '@testing-library/react';
import React from 'react';
import {MemoryRouter} from 'react-router-dom';

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

    test('should navigate directly when not blocked', () => {
        render(
            <MemoryRouter>
                <BlockableLink {...defaultProps}/>
            </MemoryRouter>,
        );

        fireEvent.click(screen.getByText('Link Text'));
        expect(defaultProps.actions.deferNavigation).not.toHaveBeenCalled();
    });

    test('should defer navigation when blocked', () => {
        const blockedProps = {
            ...defaultProps,
            blocked: true,
        };

        render(
            <MemoryRouter>
                <BlockableLink {...blockedProps}/>
            </MemoryRouter>,
        );

        fireEvent.click(screen.getByText('Link Text'));
        expect(blockedProps.actions.deferNavigation).toHaveBeenCalled();
    });

    test('should call custom onClick handler if provided', () => {
        const onClickProps = {
            ...defaultProps,
            onClick: jest.fn(),
        };

        render(
            <MemoryRouter>
                <BlockableLink {...onClickProps}/>
            </MemoryRouter>,
        );

        fireEvent.click(screen.getByText('Link Text'));
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
