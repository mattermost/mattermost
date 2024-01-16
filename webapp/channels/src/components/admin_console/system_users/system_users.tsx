// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, defineMessages} from 'react-intl';

import AdminHeader from 'components/widgets/admin_console/admin_header';

import RevokeSessionsButton from './revoke_sessions_button';
import SystemUsersList from './system_users_list';

import type {PropsFromRedux} from './index';

type Props = PropsFromRedux;

const messages = defineMessages({
    title: {id: 'admin.system_users.title', defaultMessage: '{siteName} Users'},
});

export const searchableStrings: Array<string|MessageDescriptor|[MessageDescriptor, {[key: string]: any}]> = [[messages.title, {siteName: ''}]];

function SystemUsers(props: Props) {
    // Filters and search states need to come here from the store for passing down similar to how sort states are passed down currently

    return (
        <div className='wrapper--fixed'>
            <AdminHeader>
                <FormattedMessage
                    {...messages.title}
                    values={{siteName: props.siteName}}
                >
                    {(formatMessageChunk) => (
                        <span id='systemUsersTable-headerId'>{formatMessageChunk}</span>
                    )}
                </FormattedMessage>
                <RevokeSessionsButton/>
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-console__container'>
                    <SystemUsersList
                        currentUserRoles={props.currentUserRoles}
                        tablePropertySortColumn={props.tablePropertySortColumn}
                        tablePropertySortIsDescending={props.tablePropertySortIsDescending}
                        tablePropertyPageSize={props.tablePropertyPageSize}
                        tablePropertyPageIndex={props.tablePropertyPageIndex}
                        tablePropertyCursorDirection={props.tablePropertyCursorDirection}
                        tablePropertyCursorColumnValue={props.tablePropertyCursorColumnValue}
                        tablePropertyCursorUserId={props.tablePropertyCursorUserId}
                        getUserReports={props.getUserReports}
                        getUserCountForReporting={props.getUserCountForReporting}
                        setAdminConsoleUsersManagementTableProperties={props.setAdminConsoleUsersManagementTableProperties}
                    />
                </div>
            </div>
        </div>
    );
}

export default SystemUsers;
