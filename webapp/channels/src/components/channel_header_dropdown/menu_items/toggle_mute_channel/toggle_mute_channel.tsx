// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import type {Channel, ChannelNotifyProps} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import Menu from 'components/widgets/menu/menu';

import {Constants, NotificationLevels} from 'utils/constants';

export type Actions = {
    updateChannelNotifyProps(userId: string, channelId: string, props: Partial<ChannelNotifyProps>): void;
};

type Props = {

    /**
     * Object with info about the current user
     */
    user: UserProfile;

    /**
     * Object with info about the current channel
     */
    channel: Channel;

    /**
     * Boolean whether the current channel is muted
     */
    isMuted: boolean;

    /**
     * Use for test selector
     */
    id?: string;

    /**
     * Object with action creators
     */
    actions: Actions;
};

export default function MenuItemToggleMuteChannel({
    id,
    isMuted,
    channel,
    user,
    actions,
}: Props) {
    const intl = useIntl();

    const handleClick = useCallback(() => {
        actions.updateChannelNotifyProps(user.id, channel.id, {
            mark_unread: (isMuted ? NotificationLevels.ALL : NotificationLevels.MENTION) as 'all' | 'mention',
        });
    }, [actions, isMuted, user.id, channel.id]);

    let text;
    if (channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL) {
        text = isMuted ?
            intl.formatMessage({id: 'channel_header.unmuteConversation', defaultMessage: 'Unmute Conversation'}) :
            intl.formatMessage({id: 'channel_header.muteConversation', defaultMessage: 'Mute Conversation'});
    } else {
        text = isMuted ?
            intl.formatMessage({id: 'channel_header.unmute', defaultMessage: 'Unmute Channel'}) :
            intl.formatMessage({id: 'channel_header.mute', defaultMessage: 'Mute Channel'});
    }

    return (
        <Menu.ItemAction
            id={id}
            onClick={handleClick}
            text={text}
        />
    );
}
