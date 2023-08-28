// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {getChannel as selectChannel, getChannelMessageCount, getMyChannelMembership as selectMyChannelMember} from 'mattermost-redux/selectors/entities/channels';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {calculateUnreadCount} from 'mattermost-redux/utils/channel_utils';

import type {GlobalState} from 'types/store';

export function useChannel(channelId: string) {
    const channel = useSelector((state: GlobalState) => selectChannel(state, channelId));

    // TODO load channel if needed

    return channel;
}

export function useMyChannelMember(channelId: string) {
    const member = useSelector((state: GlobalState) => selectMyChannelMember(state, channelId));

    // TODO load channel member if needed

    return member;
}

function useChannelMessageCount(channelId: string) {
    const messageCount = useSelector((state: GlobalState) => getChannelMessageCount(state, channelId));

    // TODO load channel if needed

    return messageCount;
}

export function useChannelUnreadCount(channelId: string) {
    const member = useMyChannelMember(channelId);
    const messageCount = useChannelMessageCount(channelId);

    const crtEnabled = useSelector(isCollapsedThreadsEnabled);

    return calculateUnreadCount(messageCount, member, crtEnabled);
}
