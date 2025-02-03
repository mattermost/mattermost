// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';

import SharedChannelIndicator from 'components/shared_channel_indicator';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

import './channel_profile.scss';
interface ChannelProfileProps {
    channel: Partial<Channel>;
    team?: Team;
    onToggleArchive?: () => void;
    isArchived: boolean;
    isDisabled?: boolean;
}

export const ChannelProfile = (props: ChannelProfileProps): JSX.Element => {
    const {team, channel, isArchived, isDisabled} = props;

    const archiveBtn = isArchived ?
        defineMessage({id: 'admin.channel_settings.channel_details.unarchiveChannel', defaultMessage: 'Unarchive Channel'}) :
        defineMessage({id: 'admin.channel_settings.channel_details.archiveChannel', defaultMessage: 'Archive Channel'});

    let sharedBlock;
    if (channel.shared && channel.type) {
        sharedBlock = (
            <div className='channel-organizations'>
                <b>
                    <FormattedMessage
                        id='admin.channelSettings.channelDetail.channel_organizations'
                        defaultMessage='Organizations'
                    />
                </b>
                <br/>
                <SharedChannelIndicator
                    className='shared-channel-icon'
                />
                <FormattedMessage
                    id='admin.channel_settings.channel_detail.channelOrganizationsMessage'
                    defaultMessage='Shared with trusted organizations'
                />
            </div>
        );
    }

    return (
        <AdminPanel
            id='channel_profile'
            title={defineMessage({id: 'admin.channel_settings.channel_detail.profileTitle', defaultMessage: 'Channel Profile'})}
            subtitle={defineMessage({id: 'admin.channel_settings.channel_detail.profileDescription', defaultMessage: 'Summary of the channel, including the channel name.'})}
        >
            <div className='group-teams-and-channels AdminChannelDetails'>
                <div className='group-teams-and-channels--body channel-desc-col'>
                    <div className='channel-name'>
                        <b>
                            <FormattedMessage
                                id='admin.channelSettings.channelDetail.channelName'
                                defaultMessage='Name'
                            />
                        </b>
                        <br/>
                        {channel.display_name}
                    </div>
                    <div className='channel-team'>
                        <b>
                            <FormattedMessage
                                id='admin.channelSettings.channelDetail.channelTeam'
                                defaultMessage='Team'
                            />
                        </b>
                        <br/>
                        {team?.display_name}
                    </div>
                    {sharedBlock}
                    <div className='AdminChannelDetails_archiveContainer'>
                        <button
                            type='button'
                            className={
                                classNames(
                                    'btn',
                                    'btn-secondary',
                                    {'btn-danger': !isArchived},
                                    {disabled: isDisabled},
                                )
                            }
                            onClick={props.onToggleArchive}
                        >
                            {isArchived ?
                                <i className='icon icon-archive-arrow-up-outline'/> :
                                <i className='icon icon-archive-outline'/>}
                            <FormattedMessage {...archiveBtn}/>
                        </button>
                    </div>
                </div>
            </div>
        </AdminPanel>
    );
};
