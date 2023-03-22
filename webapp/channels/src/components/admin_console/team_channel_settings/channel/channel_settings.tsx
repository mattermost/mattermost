// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {t} from 'utils/i18n';
import ChannelsList from 'components/admin_console/team_channel_settings/channel/list';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

interface Props {
    siteName?: string;
}

export interface ChannelSettingsState {
    startCount: number;
    endCount: number;
    total: number;
}

export class ChannelsSettings extends React.PureComponent<Props> {
    constructor(props: Props) {
        super(props);
        this.state = {
            startCount: 0,
            endCount: 1,
            total: 0,
        };
    }

    render = () => {
        return (
            <div className='wrapper--fixed'>
                <div className='admin-console__header'>
                    <FormattedMessage
                        id='admin.channel_settings.groupsPageTitle'
                        defaultMessage='{siteName} Channels'
                        values={{siteName: this.props.siteName}}
                    />
                </div>

                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>
                        <AdminPanel
                            id='channels'
                            titleId={t('admin.channel_settings.title')}
                            titleDefault='Channels'
                            subtitleId={t('admin.channel_settings.description')}
                            subtitleDefault={'Manage channel settings.'}
                            subtitleValues={{...this.state}}
                        >
                            <ChannelsList/>
                        </AdminPanel>
                    </div>
                </div>
            </div>
        );
    };
}
