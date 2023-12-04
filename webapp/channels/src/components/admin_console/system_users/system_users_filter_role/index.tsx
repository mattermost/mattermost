// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

function SystemUsersFilterRole() {
    return (
        <label>
            <span className='system-users__filter-label'>
                <FormattedMessage
                    id='filtered_user_list.userStatus'
                    defaultMessage='User Status:'
                />
            </span>
            <select
                id='selectUserStatus'
                className='form-control system-users__filter'
                value={this.props.filter}
                onChange={this.handleFilterChange}
            >
                <option value=''>
                    {this.props.intl.formatMessage({
                        id: 'admin.system_users.allUsers',
                        defaultMessage: 'All Users',
                    })}
                </option>
                <option value={UserFilters.SYSTEM_ADMIN}>
                    {this.props.intl.formatMessage({
                        id: 'admin.system_users.system_admin',
                        defaultMessage: 'System Admin',
                    })}
                </option>
                <option value={UserFilters.SYSTEM_GUEST}>
                    {this.props.intl.formatMessage({
                        id: 'admin.system_users.guest',
                        defaultMessage: 'Guest',
                    })}
                </option>
                <option value={UserFilters.ACTIVE}>
                    {this.props.intl.formatMessage({
                        id: 'admin.system_users.active',
                        defaultMessage: 'Active',
                    })}
                </option>
                <option value={UserFilters.INACTIVE}>
                    {this.props.intl.formatMessage({
                        id: 'admin.system_users.inactive',
                        defaultMessage: 'Inactive',
                    })}
                </option>
            </select>
        </label>
    );
}

export default SystemUsersFilterRole;
