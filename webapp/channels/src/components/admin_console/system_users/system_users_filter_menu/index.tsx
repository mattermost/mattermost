// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import './system_users_filter_menu.scss';

export function SystemUsersFilterMenu() {
    return (
        <div className='systemUsersFilterContainer'>
            <button className='btn btn-md btn-tertiary'>
                <i className='icon icon-filter-variant'/>
                <FormattedMessage
                    id='admin.system_users.filtersMenu'
                    defaultMessage='Filters ({count})'
                    values={{
                        count: 0,
                    }}
                />
            </button>
        </div>
    );
}
