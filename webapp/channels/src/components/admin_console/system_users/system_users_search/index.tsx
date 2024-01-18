// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChangeEvent} from 'react';
import React, {useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {setAdminConsoleUsersManagementTableProperties} from 'actions/views/admin';
import {getAdminConsoleUserManagementTableProperties} from 'selectors/views/admin';

import Input from 'components/widgets/inputs/input/input';

import './system_users_search.scss';

export function SystemUsersSearch() {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const timeout = useRef<NodeJS.Timeout>();

    const initialValue = useSelector(getAdminConsoleUserManagementTableProperties).searchTerm;
    const [inputValue, setInputValue] = useState(initialValue);

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
