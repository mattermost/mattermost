// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ChangeEvent} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {UserFilters} from 'utils/constants';

type Props = {
    value?: string;
    onChange: ({searchTerm, teamId, filter}: {searchTerm?: string; teamId?: string; filter?: string}) => void;
    onFilter: ({teamId, filter}: {teamId?: string; filter?: string}) => Promise<void>;
};

// Repurpose for the new filter

function SystemUsersFilterRole(props: Props) {
    const {formatMessage} = useIntl();

    function handleChange(e: ChangeEvent<HTMLSelectElement>) {
        const filter = e?.target?.value ?? '';
        props.onChange({filter});
        props.onFilter({filter});
    }

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
                value={props.value}
                onChange={handleChange}
            >
                <option value=''>
                    {formatMessage({id: 'admin.system_users.allUsers', defaultMessage: 'All Users'})}
                </option>
                <option value={UserFilters.SYSTEM_ADMIN}>
                    {formatMessage({id: 'admin.system_users.system_admin', defaultMessage: 'System Admin'})}
                </option>
                <option value={UserFilters.SYSTEM_GUEST}>
                    {formatMessage({id: 'admin.system_users.guest', defaultMessage: 'Guest'})}
                </option>
                <option value={UserFilters.ACTIVE}>
                    {formatMessage({id: 'admin.system_users.active', defaultMessage: 'Active'})}
                </option>
                <option value={UserFilters.INACTIVE}>
                    {formatMessage({id: 'admin.system_users.inactive', defaultMessage: 'Inactive'})}
                </option>
            </select>
        </label>
    );
}

export default SystemUsersFilterRole;
