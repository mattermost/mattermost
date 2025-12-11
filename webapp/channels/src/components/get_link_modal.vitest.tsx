// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import GetLinkModal from 'components/get_link_modal';

import {renderWithContext, screen, fireEvent, act} from 'tests/vitest_react_testing_utils';

describe('components/GetLinkModal', () => {
    const onHide = vi.fn();
    const requiredProps = {
        show: true,
        onHide,
        onExited: vi.fn(),
        title: 'title',
        link: 'https://mattermost.com',
    };

    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('should match snapshot when all props is set', () => {
        const helpText = 'help text';
        const props = {...requiredProps, helpText};

        const {container} = renderWithContext(
            <GetLinkModal {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when helpText is not set', () => {
        const {container} = renderWithContext(
            <GetLinkModal {...requiredProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should have called onHide', () => {
        const newOnHide = vi.fn();
        const props = {...requiredProps, onHide: newOnHide};

        renderWithContext(
            <GetLinkModal {...props}/>,
        );

        // Click close button
        const closeButton = screen.getByLabelText('Close');
        fireEvent.click(closeButton);
        expect(newOnHide).toHaveBeenCalledTimes(1);
    });

    test('should have handle copyLink', () => {
        renderWithContext(
            <GetLinkModal {...requiredProps}/>,
        );

        // Verify initial state - button shows "Copy Link"
        expect(screen.getByText('Copy Link')).toBeInTheDocument();

        // Verify textarea is rendered and click it to trigger copyLink
        const textArea = screen.getByRole('textbox');
        expect(textArea).toBeInTheDocument();

        // Click textarea triggers copyLink
        fireEvent.click(textArea);

        // Verify copy was triggered - button should show "Link copied"
        expect(screen.getByText('Link copied')).toBeInTheDocument();
    });

    test('should change button state when copying', () => {
        renderWithContext(
            <GetLinkModal {...requiredProps}/>,
        );

        // Initial state - button shows "Copy Link"
        const copyButton = screen.getByText('Copy Link');
        expect(copyButton).toBeInTheDocument();

        // Click copy button
        fireEvent.click(copyButton);

        // After copying - button should show "Link copied"
        expect(screen.getByText('Link copied')).toBeInTheDocument();
        expect(screen.queryByText('Copy Link')).not.toBeInTheDocument();

        // After timeout (1000ms) - button should return to "Copy Link"
        act(() => {
            vi.advanceTimersByTime(1000);
        });

        expect(screen.getByText('Copy Link')).toBeInTheDocument();
        expect(screen.queryByText('Link copied')).not.toBeInTheDocument();
    });

    test('should cleanup timeout on unmount', () => {
        const {unmount} = renderWithContext(
            <GetLinkModal {...requiredProps}/>,
        );

        // Click copy button to start the timeout
        const copyButton = screen.getByText('Copy Link');
        fireEvent.click(copyButton);

        // Verify copy was triggered
        expect(screen.getByText('Link copied')).toBeInTheDocument();

        // Unmount component before timeout completes
        unmount();

        // Advance timers - should not throw error since timeout was cleaned up
        act(() => {
            vi.advanceTimersByTime(1000);
        });

        // If we get here without errors, the timeout was properly cleaned up
    });
});
