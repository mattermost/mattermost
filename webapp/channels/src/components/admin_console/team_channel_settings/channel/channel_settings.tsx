// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import ChannelsList from 'components/admin_console/team_channel_settings/channel/list';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

import {t} from 'utils/i18n';

interface Props {
    siteName?: string;
}

export interface ChannelSettingsState {
    startCount: number;
    endCount: number;
    total: number;
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
                        titleId={t('admin.channel_settings.title')}
                        titleDefault='Channels'
                        subtitleId={t('admin.channel_settings.description')}
                        subtitleDefault={'Manage channel settings.'}
                        subtitleValues={{startCount: 0, endCount: 1, total: 0}}
                    >
                        <ChannelsList/>
                    </AdminPanel>
                </div>
            </div>
        </div>
    );
};
