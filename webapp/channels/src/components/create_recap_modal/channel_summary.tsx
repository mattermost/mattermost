// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

import ChannelTypeIcon from 'components/channel_type_icon';

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

    return (
        <div className='step-two-summary'>
            <label className='form-label'>
                {formatMessage({id: 'recaps.modal.summaryTitle', defaultMessage: 'The following channels will be included in your recap'})}
            </label>

            <div className='summary-channels-list'>
                {selectedChannels.map((channel) => {
                    let icon: React.ReactNode = <ChannelTypeIcon channel={channel}/>;
                    if (channel.type === Constants.DM_CHANNEL) {
                        icon = <i className='icon icon-account-outline'/>;
                    } else if (channel.type === Constants.GM_CHANNEL) {
                        icon = <i className='icon icon-account-multiple-outline'/>;
                    }
                    return (
                        <div
                            key={channel.id}
                            className='summary-channel-item'
                            data-testid='summary-channel-item'
                        >
                            {icon}
                            <span className='channel-name'>{channel.display_name}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ChannelSummary;

