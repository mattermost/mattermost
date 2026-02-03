// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChangeEvent} from 'react';
import React, {useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {setAdminConsoleUsersManagementTableProperties} from 'actions/views/admin';

import Input from 'components/widgets/inputs/input/input';

import type {AdminConsoleUserManagementTableProperties} from 'types/store/views';

import './system_users_search.scss';

type Props = {
    searchTerm: AdminConsoleUserManagementTableProperties['searchTerm'];
}

export function SystemUsersSearch(props: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const timeout = useRef<NodeJS.Timeout>();

    const [inputValue, setInputValue] = useState(props.searchTerm);

    function handleChange(event: ChangeEvent<HTMLInputElement>) {
        const {target: {value}} = event;
        setInputValue(value);

        clearTimeout(timeout.current);
        timeout.current = setTimeout(() => {
            dispatch(setAdminConsoleUsersManagementTableProperties({searchTerm: value}));
        }, 500);
    }

    function handleClear() {
        setInputValue('');
        dispatch(setAdminConsoleUsersManagementTableProperties({searchTerm: ''}));
    }

    return (
        <div className='system-users__filter'>
            <Input
                type='text'
                clearable={true}
                name='searchTerm'
                containerClassName='systemUsersSearch'
                placeholder={formatMessage({id: 'admin.system_users.search.placeholder', defaultMessage: 'Search users'})}
                inputPrefix={<i className={'icon icon-magnify'}/>}
                onChange={handleChange}
                onClear={handleClear}
                value={inputValue}
            />
        </div>
    );
}
