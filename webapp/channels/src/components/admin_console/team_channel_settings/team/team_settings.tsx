// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {t} from 'utils/i18n';
import TeamList from 'components/admin_console/team_channel_settings/team/list';
import AdminPanel from 'components/widgets/admin_console/admin_panel';
import AdminHeader from 'components/widgets/admin_console/admin_header';

type Props = {
    siteName: string;
};

export function TeamsSettings(props: Props) {
    return (
        <div className='wrapper--fixed'>
            <AdminHeader>
                <FormattedMessage
                    id='admin.team_settings.groupsPageTitle'
                    defaultMessage='{siteName} Teams'
                    values={{siteName: props.siteName}}
                />
            </AdminHeader>

            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    <AdminPanel
                        id='teams'
                        titleId={t('admin.team_settings.title')}
                        titleDefault='Teams'
                        subtitleId={t('admin.team_settings.description')}
                        subtitleDefault='Manage team settings.'
                    >
                        <TeamList/>
                    </AdminPanel>
                </div>
            </div>
        </div>
    );
}
