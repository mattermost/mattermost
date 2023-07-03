// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {t} from 'utils/i18n';
import {getSiteURL} from 'utils/url';

import GroupsList from 'components/admin_console/group_settings/groups_list';
import AdminPanel from 'components/widgets/admin_console/admin_panel';
import ExternalLink from 'components/external_link';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import {DocLinks} from 'utils/constants';

type Props = {
    isDisabled?: boolean;
}

const GroupSettings = ({isDisabled}: Props) => {
    const siteURL = getSiteURL();
    return (
        <div className='wrapper--fixed'>
            <AdminHeader>
                <FormattedMessage
                    id='admin.group_settings.groupsPageTitle'
                    defaultMessage='Groups'
                />
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    <div className={'banner info'}>
                        <div className='banner__content'>
                            <FormattedMessage
                                id='admin.group_settings.introBanner'
                                defaultMessage={'Groups are a way to organize users and apply actions to all users within that group.\nFor more information on Groups, please see <link>documentation</link>.'}
                                values={{
                                    link: (msg: React.ReactNode) => (
                                        <ExternalLink
                                            location='group_settings'
                                            href={DocLinks.DEFAULT_LDAP_GROUP_SYNC}
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                }}
                            />
                        </div>
                    </div>

                    <AdminPanel
                        id='ldap_groups'
                        titleId={t('admin.group_settings.ldapGroupsTitle')}
                        titleDefault='AD/LDAP Groups'
                        subtitleId={t('admin.group_settings.ldapGroupsDescription')}
                        subtitleDefault={'Connect AD/LDAP and create groups in Mattermost. To get started, configure group attributes on the <link>AD/LDAP</link> configuration page.'}
                        subtitleValues={{
                            link: (msg: React.ReactNode) => (
                                <ExternalLink
                                    href={`${siteURL}/admin_console/authentication/ldap`}
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        }}
                    >
                        <GroupsList
                            readOnly={isDisabled}
                        />
                    </AdminPanel>
                </div>
            </div>
        </div>
    );
};

export default GroupSettings;
