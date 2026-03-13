// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

import {Constants} from 'utils/constants';

type Props = {
    selectedChannelIds: string[];
    myChannels: Channel[];
};

const ChannelSummary = ({selectedChannelIds, myChannels}: Props) => {
    const {formatMessage} = useIntl();

    const selectedChannels = myChannels.filter((channel) =>
        selectedChannelIds.includes(channel.id),
    );

    const getChannelIcon = (channel: Channel) => {
        switch (channel.type) {
        case Constants.OPEN_CHANNEL:
            return 'icon-globe';
        case Constants.PRIVATE_CHANNEL:
            return 'icon-lock-outline';
        case Constants.GM_CHANNEL:
            return 'icon-account-multiple-outline';
        case Constants.DM_CHANNEL:
            return 'icon-account-outline';
        default:
            return 'icon-globe';
        }
    };

    return (
        <div className='step-two-summary'>
            <label className='form-label'>
                {formatMessage({id: 'recaps.modal.summaryTitle', defaultMessage: 'The following channels will be included in your recap'})}
            </label>

            <div className='summary-channels-list'>
                {selectedChannels.map((channel) => (
                    <div
                        key={channel.id}
                        className='summary-channel-item'
                    >
                        <i className={`icon ${getChannelIcon(channel)}`}/>
                        <span className='channel-name'>{channel.display_name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ChannelSummary;

