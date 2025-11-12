// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import PopoutButton from './popout_button';

let mockCanPopout = true;

jest.mock('utils/popouts/popout_windows', () => ({
    __esModule: true,
    get canPopout() {
        return mockCanPopout;
    },
}));

jest.mock('utils/user_agent', () => ({
    isDesktopApp: jest.fn(),
}));

describe('PopoutButton', () => {
    const defaultProps = {
        onClick: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockCanPopout = true;
    });

    it('should not render when cannot popout', async () => {
        mockCanPopout = false;
        const {container} = renderWithContext(
            <PopoutButton {...defaultProps}/>,
        );

        await waitFor(() => {
            expect(container.firstChild).toBeNull();
        });
    });

    it('should render with correct button attributes', async () => {
        renderWithContext(
            <PopoutButton {...defaultProps}/>,
        );

        await waitFor(() => {
            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('type', 'button');
            expect(button).toHaveAttribute('aria-label', 'Open in new window');
            expect(button).toHaveClass('btn', 'btn-icon', 'btn-sm', 'PopoutButton');

            const icon = screen.getByRole('button').querySelector('.icon-dock-window');
            expect(icon).toBeInTheDocument();
        });
    });

    it('should render with custom className', async () => {
        renderWithContext(
            <PopoutButton
                {...defaultProps}
                className='custom-class'
            />,
        );

        await waitFor(() => {
            const button = screen.getByRole('button');
            expect(button).toHaveClass('custom-class');
        });
    });

    it('should call onClick when clicked', async () => {
        const onClick = jest.fn();

        renderWithContext(
            <PopoutButton onClick={onClick}/>,
        );

        await waitFor(() => {
            const button = screen.getByRole('button');
            expect(button).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole('button'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});

