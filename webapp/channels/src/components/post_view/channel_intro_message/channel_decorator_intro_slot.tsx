// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import ChannelIntroMessage from 'components/post_view/channel_intro_message';

import Pluggable from 'plugins/pluggable';
import {createMatcherErrorLog} from 'utils/matcher_error_log';

import type {GlobalState} from 'types/store';

type Props = {channelId: string};

const ChannelDecoratorIntroSlot = ({channelId}: Props) => {
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId));
    const matchingId = useSelector((state: GlobalState) => getMatchingChannelIntroOverrideComponent(state, channelId));

    if (channel && matchingId) {
        return (
            <Pluggable
                pluggableName='ChannelIntroOverride'
                pluggableId={matchingId}
                channel={channel}
            />
        );
    }

    return <ChannelIntroMessage/>;
};

export default ChannelDecoratorIntroSlot;

const matcherErrorLog = createMatcherErrorLog('ChannelDecorator');

export const clearLoggedDecoratorErrors = matcherErrorLog.clear;

export function getMatchingChannelIntroOverrideComponent(
    state: GlobalState,
    channelId: string,
): string | undefined {
    if (!channelId) {
        return undefined;
    }

    const channel = getChannel(state, channelId);
    if (!channel) {
        return undefined;
    }

    const components = state.plugins.components.ChannelIntroOverride;
    const matching = components.find((component) => {
        try {
            return component.matcher(state, channel) === true;
        } catch (err) {
            matcherErrorLog.logOnce(component.pluginId, err);
            return false;
        }
    });

    return matching?.id;
}
