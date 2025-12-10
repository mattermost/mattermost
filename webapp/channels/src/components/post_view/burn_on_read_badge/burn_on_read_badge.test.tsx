// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent} from '@testing-library/react';
import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
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
        expect(badge).toHaveAttribute('role', 'button');
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

    it('should always render badge for sender (even when all recipients have revealed)', () => {
        renderWithContext(
            <BurnOnReadBadge
                {...baseProps}
                isSender={true}
                revealed={true}
            />,
        );

        // Sender always sees the flame badge with delete tooltip
        const badge = screen.getByTestId('burn-on-read-badge-post123');
        expect(badge).toBeInTheDocument();
        expect(badge.getAttribute('aria-label')).toContain('Click to delete message for everyone');
    });

    it('should have correct CSS class for styling', () => {
        renderWithContext(
            <BurnOnReadBadge {...baseProps}/>,
        );

        const badge = screen.getByTestId('burn-on-read-badge-post123');
        expect(badge).toHaveClass('BurnOnReadBadge');
    });

    it('should call onSenderDelete when sender clicks badge', () => {
        const onSenderDelete = jest.fn();
        renderWithContext(
            <BurnOnReadBadge
                {...baseProps}
                isSender={true}
                onSenderDelete={onSenderDelete}
            />,
        );

        const badge = screen.getByTestId('burn-on-read-badge-post123');
        fireEvent.click(badge);

        expect(onSenderDelete).toHaveBeenCalledTimes(1);
    });

    it('should not call onSenderDelete when recipient clicks badge', () => {
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
        fireEvent.click(badge);

        expect(onSenderDelete).not.toHaveBeenCalled();
        expect(onReveal).toHaveBeenCalledWith('post123');
    });
});
