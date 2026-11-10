// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import ChannelMentionBadge from './channel_mention_badge';

const urgentTooltipDescriptor = {
    id: 'channel_mention_badge.urgent_tooltip',
    defaultMessage: 'You have an urgent mention',
};

describe('ChannelMentionBadge', () => {
    it('should render nothing when unreadMentions is 0', () => {
        const {container} = renderWithContext(
            <ChannelMentionBadge unreadMentions={0}/>,
        );

        expect(container.firstChild).toBeNull();
    });

    it('should render badge when unreadMentions > 0', () => {
        renderWithContext(
            <ChannelMentionBadge unreadMentions={3}/>,
        );

        expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should add urgent class when hasUrgent is true', () => {
        renderWithContext(
            <ChannelMentionBadge
                unreadMentions={1}
                hasUrgent={true}
            />,
        );

        expect(screen.getByText('1').closest('.badge')).toHaveClass('urgent');
    });

    it('should not add urgent class when hasUrgent is false', () => {
        renderWithContext(
            <ChannelMentionBadge
                unreadMentions={1}
                hasUrgent={false}
            />,
        );

        expect(screen.getByText('1').closest('.badge')).not.toHaveClass('urgent');
    });

    it('should show tooltip on hover when tooltip prop is provided', async () => {
        jest.useFakeTimers();

        renderWithContext(
            <ChannelMentionBadge
                unreadMentions={2}
                hasUrgent={true}
                tooltip={urgentTooltipDescriptor}
            />,
        );

        const badge = screen.getByText('2').closest('.badge')!;
        await userEvent.hover(badge, {advanceTimers: jest.advanceTimersByTime});

        await waitFor(() => {
            expect(screen.getByText('You have an urgent mention')).toBeInTheDocument();
        });
    });

    it('should not render WithTooltip wrapper when tooltip prop is not provided', () => {
        const {container} = renderWithContext(
            <ChannelMentionBadge
                unreadMentions={2}
                hasUrgent={true}
            />,
        );

        const badge = screen.getByText('2').closest('.badge')!;
        expect(badge).toBeInTheDocument();
        expect(container.querySelector('.tooltipContainer')).not.toBeInTheDocument();
    });
});
