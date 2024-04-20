// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type MouseEvent} from 'react';
import {Constants} from 'utils/constants';
import {localizeMessage} from 'utils/utils';

import type {Channel} from '@mattermost/types/channels';

import Menu from 'components/widgets/menu/menu';

import type {PropsFromRedux} from './index';

interface Props extends PropsFromRedux {

    /**
     * Object with info about current channel
     */
    channel: Channel;

    /**
     * Use for test selector
     */
    id?: string;
}

const joinLeavePostTypes = [
    'system_join_channel',
    'system_leave_channel',
];

const hasMutedJoinLeave = (channel: Channel): boolean => {
    return joinLeavePostTypes.every(
        (type) => channel.options.excludeTypes!.includes(type),
    );
};

const MuteJoinLeaveMessages = ({
    channel,
    id,
    actions: {
        patchChannel,
    },
}: Props) => {
    const isMuted = hasMutedJoinLeave(channel);

    const handleMute = async (e?: MouseEvent<HTMLButtonElement>) => {
        if (e) {
            e.preventDefault();
        }

        const options = {...channel.options};

        options.excludeTypes = options.excludeTypes.filter(
            (type) => !joinLeavePostTypes.includes(type),
        );

        // if it's not muted we'll add the types to exclude
        if (!isMuted) {
            options.excludeTypes.push(...joinLeavePostTypes);
        }

        await patchChannel(channel.id, {
            options,
        });
    };

    let text = localizeMessage('channel_header.hideJoinLeaveMessages', 'Hide Join/Leave Messages');
    if (isMuted) {
        text = localizeMessage('channel_header.showJoinLeaveMessages', 'Show Join/Leave Messages');
    }

    return (
        <Menu.ItemAction
            id={id}
            show={channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL}
            onClick={handleMute}
            text={text}
        />
    );
};

export default MuteJoinLeaveMessages;
