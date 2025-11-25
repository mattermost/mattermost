// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import BurnOnReadBadge from './burn_on_read_badge';

describe('BurnOnReadBadge', () => {
    const baseProps = {
        postId: 'post123',
        isSender: false,
        revealed: false,
    };

    it('should render flame icon for unrevealed recipient', () => {
        renderWithContext(
            <BurnOnReadBadge {...baseProps}/>,
        );

        const badge = screen.getByTestId('burn-on-read-badge-post123');
        expect(badge).toBeInTheDocument();
        expect(badge.querySelector('.icon-fire')).toBeInTheDocument();
    });

    it('should show "Click to Reveal" tooltip for unrevealed recipient', () => {
        renderWithContext(
            <BurnOnReadBadge {...baseProps}/>,
        );

        const badge = screen.getByTestId('burn-on-read-badge-post123');
        expect(badge).toHaveAttribute('aria-label', 'Click to Reveal');
    });

    it('should show informational tooltip for sender', () => {
        renderWithContext(
            <BurnOnReadBadge
                {...baseProps}
                isSender={true}
            />,
        );

        const badge = screen.getByTestId('burn-on-read-badge-post123');
        expect(badge).toHaveAttribute('aria-label', expect.stringContaining('Message will be deleted after all recipients have read it'));
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

        // Sender always sees the flame badge with informational tooltip
        const badge = screen.getByTestId('burn-on-read-badge-post123');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveAttribute('aria-label', expect.stringContaining('Message will be deleted after all recipients have read it'));
    });

    it('should have correct CSS class for styling', () => {
        renderWithContext(
            <BurnOnReadBadge {...baseProps}/>,
        );

        const badge = screen.getByTestId('burn-on-read-badge-post123');
        expect(badge).toHaveClass('BurnOnReadBadge');
    });
});
