// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import DesktopApp from 'utils/desktop_api';
import {isDesktopApp} from 'utils/user_agent';

import PopoutButton from './popout_button';

// Mock dependencies
jest.mock('utils/desktop_api', () => ({
    __esModule: true,
    default: {
        canPopout: jest.fn(),
    },
}));

jest.mock('utils/user_agent', () => ({
    isDesktopApp: jest.fn(),
}));

jest.mock('components/with_tooltip', () => ({
    __esModule: true,
    default: ({children, title}: {children: React.ReactNode; title: React.ReactNode}) => (
        <div
            data-testid='with-tooltip'
            title={typeof title === 'string' ? title : 'tooltip'}
        >
            {children}
        </div>
    ),
}));

const mockDesktopApp = DesktopApp as jest.Mocked<typeof DesktopApp>;
const mockIsDesktopApp = isDesktopApp as jest.MockedFunction<typeof isDesktopApp>;

describe('PopoutButton', () => {
    const defaultProps = {
        onClick: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should not render when not in desktop app', () => {
        mockIsDesktopApp.mockReturnValue(false);

        const {container} = renderWithContext(
            <PopoutButton {...defaultProps}/>,
        );

        expect(container.firstChild).toBeNull();
    });

    it('should not render when desktop app cannot popout', async () => {
        mockIsDesktopApp.mockReturnValue(true);
        mockDesktopApp.canPopout.mockResolvedValue(false);

        const {container} = renderWithContext(
            <PopoutButton {...defaultProps}/>,
        );

        await waitFor(() => {
            expect(container.firstChild).toBeNull();
        });
    });

    it('should render when desktop app can popout', async () => {
        mockIsDesktopApp.mockReturnValue(true);
        mockDesktopApp.canPopout.mockResolvedValue(true);

        renderWithContext(
            <PopoutButton {...defaultProps}/>,
        );

        await waitFor(() => {
            expect(screen.getByRole('button')).toBeInTheDocument();
        });
    });

    it('should render with correct button attributes', async () => {
        mockIsDesktopApp.mockReturnValue(true);
        mockDesktopApp.canPopout.mockResolvedValue(true);

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
        mockIsDesktopApp.mockReturnValue(true);
        mockDesktopApp.canPopout.mockResolvedValue(true);

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
        mockIsDesktopApp.mockReturnValue(true);
        mockDesktopApp.canPopout.mockResolvedValue(true);

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

    it('should render with tooltip', async () => {
        mockIsDesktopApp.mockReturnValue(true);
        mockDesktopApp.canPopout.mockResolvedValue(true);

        renderWithContext(
            <PopoutButton {...defaultProps}/>,
        );

        await waitFor(() => {
            expect(screen.getByTestId('with-tooltip')).toBeInTheDocument();
        });
    });

    it('should check canPopout on mount when in desktop app', async () => {
        mockIsDesktopApp.mockReturnValue(true);
        mockDesktopApp.canPopout.mockResolvedValue(true);

        renderWithContext(
            <PopoutButton {...defaultProps}/>,
        );

        await waitFor(() => {
            expect(mockDesktopApp.canPopout).toHaveBeenCalledTimes(1);
        });
    });

    it('should not check canPopout when not in desktop app', () => {
        mockIsDesktopApp.mockReturnValue(false);

        renderWithContext(
            <PopoutButton {...defaultProps}/>,
        );

        expect(mockDesktopApp.canPopout).not.toHaveBeenCalled();
    });
});

