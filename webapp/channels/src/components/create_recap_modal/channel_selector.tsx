// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useMemo} from 'react';
import {useIntl} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

import Input from 'components/widgets/inputs/input/input';

import {Constants} from 'utils/constants';

type Props = {
    selectedChannelIds: string[];
    setSelectedChannelIds: (ids: string[]) => void;
    myChannels: Channel[];
    unreadChannels: Channel[];
};

const ChannelSelector = ({selectedChannelIds, setSelectedChannelIds, myChannels, unreadChannels}: Props) => {
    const {formatMessage} = useIntl();
    const [searchTerm, setSearchTerm] = useState('');

    const toggleChannel = (channelId: string) => {
        if (selectedChannelIds.includes(channelId)) {
            setSelectedChannelIds(selectedChannelIds.filter((id) => id !== channelId));
        } else {
            setSelectedChannelIds([...selectedChannelIds, channelId]);
        }
    };

    const filteredChannels = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return myChannels.filter((channel) => {
            return channel.display_name.toLowerCase().includes(term) ||
                   channel.name.toLowerCase().includes(term);
        });
    }, [myChannels, searchTerm]);

    const recommendedChannels = useMemo(() => {
        // Recommended channels are unread channels that match the search
        return filteredChannels.filter((channel) =>
            unreadChannels.some((uc) => uc.id === channel.id),
        ).slice(0, 5);
    }, [filteredChannels, unreadChannels]);

    const otherChannels = useMemo(() => {
        const recommendedIds = recommendedChannels.map((c) => c.id);
        return filteredChannels.filter((channel) => !recommendedIds.includes(channel.id));
    }, [filteredChannels, recommendedChannels]);

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

    const renderChannelItem = (channel: Channel) => {
        const isSelected = selectedChannelIds.includes(channel.id);
        return (
            <div
                key={channel.id}
                className='channel-selector-item'
                onClick={() => toggleChannel(channel.id)}
            >
                <div className='channel-selector-checkbox'>
                    <input
                        type='checkbox'
                        checked={isSelected}
                        onChange={() => {}} // Handled by parent div
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
                <div className='channel-selector-channel-info'>
                    <i className={`icon ${getChannelIcon(channel)}`}/>
                    <span className='channel-name'>{channel.display_name}</span>
                </div>
            </div>
        );
    };

    return (
        <div className='step-two-channel-selector'>
            <label className='form-label'>
                {formatMessage({id: 'recaps.modal.selectChannels', defaultMessage: 'Select the channels you want to include'})}
            </label>

            <div className='channel-selector-container'>
                <div className='channel-selector-search'>
                    <Input
                        type='text'
                        placeholder={{id: 'recaps.modal.searchChannels', defaultMessage: 'Search and select channels'}}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        useLegend={false}
                        containerClassName='channel-selector-input-container'
                        inputPrefix={<i className='icon icon-magnify'/>}
                    />
                </div>

                <div className='channel-selector-list'>
                    {recommendedChannels.length > 0 && (
                        <div className='channel-group'>
                            <div className='channel-group-title'>
                                {formatMessage({id: 'recaps.modal.recommended', defaultMessage: 'RECOMMENDED'})}
                            </div>
                            {recommendedChannels.map(renderChannelItem)}
                        </div>
                    )}

                    {otherChannels.length > 0 && (
                        <div className='channel-group'>
                            <div className='channel-group-title'>
                                {formatMessage({id: 'recaps.modal.allChannels', defaultMessage: 'ALL CHANNELS'})}
                            </div>
                            {otherChannels.map(renderChannelItem)}
                        </div>
                    )}

                    {filteredChannels.length === 0 && (
                        <div className='channel-selector-empty'>
                            {formatMessage({id: 'recaps.modal.noChannels', defaultMessage: 'No channels found'})}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChannelSelector;

