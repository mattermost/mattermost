// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import BurnOnReadBadge from './burn_on_read_badge';

describe('BurnOnReadBadge', () => {
    const mockPost = TestHelper.getPostMock({
        id: 'post123',
        channel_id: 'channel123',
        user_id: 'user123',
        type: 'burn_on_read',
    });

    const baseProps = {
        post: mockPost,
        isSender: false,
        revealed: false,
    };

    it('should render flame icon for unrevealed recipient', () => {
        renderWithContext(
            <BurnOnReadBadge {...baseProps}/>,
        );

        const badge = screen.getByTestId('burn-on-read-badge-post123');
        expect(badge).toBeInTheDocument();
        expect(badge.querySelector('svg')).toBeInTheDocument();
    });

    it('should show burn-on-read tooltip for unrevealed recipient', () => {
        renderWithContext(
            <BurnOnReadBadge {...baseProps}/>,
        );

        const badge = screen.getByTestId('burn-on-read-badge-post123');
        expect(badge).toHaveAttribute('aria-label', 'Burn-on-read message');
    });

    it('should show delete tooltip for sender', () => {
        renderWithContext(
            <BurnOnReadBadge
                {...baseProps}
                isSender={true}
            />,
        );

        const badge = screen.getByTestId('burn-on-read-badge-post123');
        expect(badge.getAttribute('aria-label')).toContain('Click to delete message for everyone');
    });

    it('should not render when revealed and no timer', () => {
        const {container} = renderWithContext(
            <BurnOnReadBadge
                {...baseProps}
                revealed={true}
            />,
        );

        expect(container.firstChild).toBeNull();
    });

    it('should render badge for sender when timer is not active (not all recipients revealed)', () => {
        renderWithContext(
            <BurnOnReadBadge
                {...baseProps}
                isSender={true}
                revealed={true}
                expireAt={null}
            />,
        );

        // Sender sees the flame badge with delete tooltip when timer is not active
        const badge = screen.getByTestId('burn-on-read-badge-post123');
        expect(badge).toBeInTheDocument();
        expect(badge.getAttribute('aria-label')).toContain('Click to delete message for everyone');
    });

    it('should NOT render badge for sender when timer is active (all recipients revealed)', () => {
        renderWithContext(
            <BurnOnReadBadge
                {...baseProps}
                isSender={true}
                revealed={true}
                expireAt={Date.now() + 60000}
            />,
        );

        // When timer is active, badge should not render (timer chip shows instead)
        const badge = screen.queryByTestId('burn-on-read-badge-post123');
        expect(badge).not.toBeInTheDocument();
    });

    it('should have correct CSS class for styling', () => {
        renderWithContext(
            <BurnOnReadBadge {...baseProps}/>,
        );

        const badge = screen.getByTestId('burn-on-read-badge-post123');
        expect(badge).toHaveClass('BurnOnReadBadge');
    });

    it('should call onSenderDelete when sender clicks badge', async () => {
        const onSenderDelete = jest.fn();
        renderWithContext(
            <BurnOnReadBadge
                {...baseProps}
                isSender={true}
                onSenderDelete={onSenderDelete}
            />,
        );

        const badge = screen.getByTestId('burn-on-read-badge-post123');
        await userEvent.click(badge);

        expect(onSenderDelete).toHaveBeenCalledTimes(1);
    });

    it('should not call onSenderDelete when recipient clicks badge', async () => {
        const onSenderDelete = jest.fn();
        const onReveal = jest.fn();
        renderWithContext(
            <BurnOnReadBadge
                {...baseProps}
                isSender={false}
                revealed={false}
                onReveal={onReveal}
                onSenderDelete={onSenderDelete}
            />,
        );

        const badge = screen.getByTestId('burn-on-read-badge-post123');
        await userEvent.click(badge);

        expect(onSenderDelete).not.toHaveBeenCalled();
        expect(onReveal).toHaveBeenCalledWith('post123');
    });
});
