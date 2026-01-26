// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import GetLinkModal from 'components/get_link_modal';

import {renderWithContext, act, screen, userEvent} from 'tests/react_testing_utils';

describe('components/GetLinkModal', () => {
    const onHide = jest.fn();
    const requiredProps = {
        show: true,
        onHide,
        onExited: jest.fn(),
        title: 'title',
        link: 'https://mattermost.com',
    };

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should match snapshot when all props is set', () => {
        const helpText = 'help text';
        const props = {...requiredProps, helpText};

        const {baseElement} = renderWithContext(
            <GetLinkModal {...props}/>,
        );

        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot when helpText is not set', () => {
        const {baseElement} = renderWithContext(
            <GetLinkModal {...requiredProps}/>,
        );

        expect(baseElement).toMatchSnapshot();
    });

    test('should have called onHide when close button is clicked', async () => {
        const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
        const newOnHide = jest.fn();
        const props = {...requiredProps, onHide: newOnHide};

        const {baseElement} = renderWithContext(
            <GetLinkModal {...props}/>,
        );

        // Click the modal header X button (triggers Modal's onHide)
        const modalCloseButton = baseElement.querySelector('.close') as HTMLElement;
        await user.click(modalCloseButton);
        expect(newOnHide).toHaveBeenCalledTimes(1);

        // Copy link to set copiedLink state to true
        const copyButton = screen.getByRole('button', {name: /Copy Link/});
        await user.click(copyButton);
        expect(copyButton).toHaveTextContent('Copied');
        expect(copyButton).toHaveClass('btn-success');

        // Take snapshot with copied state
        expect(baseElement).toMatchSnapshot();

        // Click the footer close button
        const footerCloseButton = baseElement.querySelector('#linkModalCloseButton') as HTMLElement;
        await user.click(footerCloseButton);
        expect(newOnHide).toHaveBeenCalledTimes(2);

        // Take snapshot after closing (copiedLink should be reset)
        expect(baseElement).toMatchSnapshot();

        // Verify copiedLink was reset (button should show Copy Link, not Copied)
        expect(copyButton).toHaveTextContent('Copy Link');
        expect(copyButton).not.toHaveClass('btn-success');
    });

    test('should have handle copyLink', async () => {
        const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
        const {baseElement} = renderWithContext(
            <GetLinkModal {...requiredProps}/>,
        );

        const textarea = baseElement.querySelector('#linkModalTextArea') as HTMLElement;
        const copyButton = screen.getByRole('button', {name: /Copy Link/});

        // Initial state
        expect(copyButton).toHaveTextContent('Copy Link');

        // Click on the textarea triggers copyLink
        await user.click(textarea);

        // Button should now show "Copied"
        expect(copyButton).toHaveTextContent('Copied');
        expect(copyButton).toHaveClass('btn-success');
    });

    test('should change button state when copying', async () => {
        const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
        renderWithContext(
            <GetLinkModal {...requiredProps}/>,
        );

        const copyButton = screen.getByRole('button', {name: /Copy Link/});

        // Initial state
        expect(copyButton).toHaveTextContent('Copy Link');
        expect(copyButton).toHaveClass('btn-primary');
        expect(copyButton).not.toHaveClass('btn-success');

        // After copying
        await user.click(copyButton);
        expect(copyButton).toHaveTextContent('Copied');
        expect(copyButton).toHaveClass('btn-primary');
        expect(copyButton).toHaveClass('btn-success');

        // After timeout
        act(() => {
            jest.advanceTimersByTime(1000);
        });
        expect(copyButton).toHaveTextContent('Copy Link');
        expect(copyButton).toHaveClass('btn-primary');
        expect(copyButton).not.toHaveClass('btn-success');
    });

    test('should cleanup timeout on unmount', async () => {
        const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
        const {unmount} = renderWithContext(
            <GetLinkModal {...requiredProps}/>,
        );

        const copyButton = screen.getByRole('button', {name: /Copy Link/});
        await user.click(copyButton);
        expect(copyButton).toHaveTextContent('Copied');

        unmount();
        jest.advanceTimersByTime(1000);

        // If we get here without errors, the timeout was properly cleaned up
    });
});
