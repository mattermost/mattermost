// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {t} from 'utils/i18n';
import {getSiteURL} from 'utils/url';

import GroupsList from 'components/admin_console/group_settings/groups_list';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

type Props = {
    isDisabled?: boolean;
}

const GroupSettings = ({isDisabled}: Props) => {
    const siteURL = getSiteURL();
    return (
        <div className='wrapper--fixed'>
            <div className='admin-console__header'>
                <FormattedMessage
                    id='admin.group_settings.groupsPageTitle'
                    defaultMessage='Groups'
                />
            </div>

            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    <div className={'banner info'}>
                        <div className='banner__content'>
                            <FormattedMessage
                                id='admin.group_settings.introBanner'
                                defaultMessage={'Groups are a way to organize users and apply actions to all users within that group.\nFor more information on Groups, please see <link>documentation</link>.'}
                                values={{
                                    link: (msg: React.ReactNode) => (
                                        <a
                                            href='https://www.mattermost.com/default-ad-ldap-groups'
                                            target='_blank'
                                            rel='noreferrer'
                                        >
                                            {msg}
                                        </a>
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
                                <a
                                    href={`${siteURL}/admin_console/authentication/ldap`}
                                    target='_blank'
                                    rel='noreferrer'
                                >
                                    {msg}
                                </a>
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
