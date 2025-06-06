// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import type {MultiValue} from 'react-select';
import AsyncSelect from 'react-select/async';

import {debounce} from 'mattermost-redux/actions/helpers';
import {searchProfiles} from 'mattermost-redux/actions/users';

import {LoadingIndicator} from 'components/admin_console/system_users/system_users_filters_popover/system_users_filter_team';
import type {OptionType} from 'components/admin_console/system_users/system_users_filters_popover/system_users_filter_team';

import './user_multiselect.scss';

type Props = {
    id: string;
    className?: string;
}

export function UserMultiSelector({id, className}: Props) {
    const dispatch = useDispatch();

    const {formatMessage} = useIntl();
    const userLoadingMessage = useCallback(() => formatMessage({id: 'admin.userMultiSelector.loading', defaultMessage: 'Loading users'}), []);
    const noUsersMessage = useCallback(() => formatMessage({id: 'admin.userMultiSelector.noUsers', defaultMessage: 'No users found'}), []);

    const searchUsersFromTerm = useMemo(() => debounce(async (searchTerm: string, callback) => {
        try {
            const response = await dispatch(searchProfiles(searchTerm, {page: 0, per_page: 50}));
            if (response && response.data && response.data.length > 0) {
                const users = response.data.map((user) => ({
                    value: user.id,
                    label: user.username,
                }));

                callback(users);
            }

            callback([]);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
            callback([]);
        }
    }, 200), [dispatch]);

    function handleOnChange(value: MultiValue<OptionType>) {
        console.log('UserMultiSelector handleOnChange value:', value);
    }

    return (
        <div className='UserMultiSelector'>
            <AsyncSelect
                id={id}
                inputId={`${id}_input`}
                classNamePrefix='user-multiselector'
                className={classNames('Input Input__focus', className)}
                isMulti={true}
                isClearable={false}
                hideSelectedOptions={true}
                cacheOptions={true}
                placeholder=''
                loadingMessage={userLoadingMessage}
                noOptionsMessage={noUsersMessage}
                loadOptions={searchUsersFromTerm}
                onChange={handleOnChange}
                components={{
                    LoadingIndicator,
                    DropdownIndicator: () => null,
                    IndicatorSeparator: () => null,
                }}
            />
        </div>
    );
}
