// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import type {ChangeEventHandler} from 'react';
import {useIntl} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

import Constants from 'utils/constants';

type Props = {
    channels: Channel[];
    onChange?: ChangeEventHandler<HTMLSelectElement>;
    value?: string;
    selectOpen: boolean;
    selectPrivate: boolean;
    selectDm: boolean;
};

const ChannelSelect = ({
    channels,
    selectOpen,
    selectPrivate,
    selectDm,
    value,
    onChange,
}: Props) => {
    const intl = useIntl();

    const options = [
        <option
            key=''
            value=''
        >
            {intl.formatMessage({
                id: 'channel_select.placeholder',
                defaultMessage: '--- Select a channel ---',
            })}
        </option>,
    ];

    channels.forEach((channel: Channel) => {
        const channelName = channel.display_name || channel.name;
        if (channel.type === Constants.OPEN_CHANNEL && selectOpen) {
            options.push(
                <option
                    key={channel.id}
                    value={channel.id}
                >
                    {channelName}
                </option>,
            );
        } else if (channel.type === Constants.PRIVATE_CHANNEL && selectPrivate) {
            options.push(
                <option
                    key={channel.id}
                    value={channel.id}
                >
                    {channelName}
                </option>,
            );
        } else if (channel.type === Constants.DM_CHANNEL && selectDm) {
            options.push(
                <option
                    key={channel.id}
                    value={channel.id}
                >
                    {channelName}
                </option>,
            );
        }
    });

    return (
        <select
            className='form-control'
            value={value}
            onChange={onChange}
            id='channelSelect'
        >
            {options}
        </select>
    );
};

export default memo(ChannelSelect);
