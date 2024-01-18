// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';

import ChannelsList from 'components/admin_console/team_channel_settings/channel/list';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

interface Props {
    siteName?: string;
}

export const ChannelsSettings = ({siteName}: Props) => {
    return (
        <div className='wrapper--fixed'>
            <AdminHeader>
                <FormattedMessage
                    id='admin.channel_settings.groupsPageTitle'
                    defaultMessage='{siteName} Channels'
                    values={{siteName}}
                />
            </AdminHeader>

            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    <AdminPanel
                        id='channels'
                        title={defineMessage({id: 'admin.channel_settings.title', defaultMessage: 'Channels'})}
                        subtitle={defineMessage({id: 'admin.channel_settings.description', defaultMessage: 'Manage channel settings.'})}
                        subtitleValues={{startCount: 0, endCount: 1, total: 0}}
                    >
                        <ChannelsList/>
                    </AdminPanel>
                </div>
            </div>
        </div>
    );
};
