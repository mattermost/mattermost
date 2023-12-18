// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import ChannelsList from 'components/admin_console/team_channel_settings/channel/list';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

type Props = {
    siteName: string;
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
                        titleId={messages.title.id}
                        titleDefault={messages.title.defaultMessage}
                        subtitleId={messages.subtitle.id}
                        subtitleDefault={messages.subtitle.defaultMessage}
                        subtitleValues={{startCount: 0, endCount: 1, total: 0}}
                    >
                        <ChannelsList/>
                    </AdminPanel>
                </div>
            </div>
        </div>
    );
};

const messages = defineMessages({
    subtitle: {
        id: 'admin.channel_settings.description',
        defaultMessage: 'Manage channel settings.',
    },
    title: {
        id: 'admin.channel_settings.title',
        defaultMessage: 'Channels',
    },
});
