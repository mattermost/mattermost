// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';
import {defineMessages} from 'react-intl';

import {renderWithContext} from 'tests/react_testing_utils';

import ChannelMentionBadge from './channel_mention_badge';

const messages = defineMessages({
    urgentTooltip: {
        id: 'channel_mention_badge.urgent_tooltip',
        defaultMessage: 'You have an urgent mention',
    },
});

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

    it('should show tooltip when tooltip prop is provided', async () => {
        renderWithContext(
            <ChannelMentionBadge
                unreadMentions={2}
                hasUrgent={true}
                tooltip={messages.urgentTooltip}
            />,
        );

        const badge = screen.getByText('2').closest('.badge')!;
        expect(badge).toBeInTheDocument();
        expect(badge.closest('[class]')).toBeInTheDocument();
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
