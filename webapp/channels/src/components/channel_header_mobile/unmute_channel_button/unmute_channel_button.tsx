// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {ChannelNotifyProps} from '@mattermost/types/channels';

import {NotificationLevels} from 'utils/constants';

type Actions = {
    updateChannelNotifyProps: (userId: string, channelId: string, props: ChannelNotifyProps) => void;
}

type Props = {
    user: { id: string };
    channel: { id: string };
    actions: Actions;
}

export default class UnmuteChannelButton extends React.PureComponent<Props> {
    handleClick = (): void => {
        const {
            user,
            channel,
            actions: {
                updateChannelNotifyProps,
            },
        } = this.props;

        updateChannelNotifyProps(user.id, channel.id, {mark_unread: NotificationLevels.ALL} as ChannelNotifyProps);
    };

    render(): JSX.Element {
        return (
            <button
                type='button'
                className='navbar-toggle icon icon__mute'
                onClick={this.handleClick}
            >
                <span className='fa fa-bell-slash-o icon'/>
            </button>
        );
    }
}
