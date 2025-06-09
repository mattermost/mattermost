// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {type ReactElement, useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import type {MultiValue} from 'react-select';
import AsyncSelect from 'react-select/async';

import type {UserProfile} from '@mattermost/types/users';

import {debounce} from 'mattermost-redux/actions/helpers';
import {searchProfiles} from 'mattermost-redux/actions/users';

import {UserProfilePill} from './user_profile_pill';

import {UserOptionComponent} from '../../content_flagging/user_multiselector/user_profile_option';
import {LoadingIndicator} from '../../system_users/system_users_filters_popover/system_users_filter_team';

import './user_multiselect.scss';

export type UserProfileAutocompleteOptionType = {
    label: string | ReactElement;
    value: string;
    raw?: UserProfile;
}

type Props = {
    id: string;
    className?: string;
}

export function UserMultiSelector({id, className}: Props) {
    const dispatch = useDispatch();

    const {formatMessage} = useIntl();
    const userLoadingMessage = useCallback(() => formatMessage({id: 'admin.userMultiSelector.loading', defaultMessage: 'Loading users'}), []);
    const noUsersMessage = useCallback(() => formatMessage({id: 'admin.userMultiSelector.noUsers', defaultMessage: 'No users found'}), []);
    const placeholder = formatMessage({id: 'admin.userMultiSelector.placeholder', defaultMessage: 'Start typing to search for users...'});

    const searchUsersFromTerm = useMemo(() => debounce(async (searchTerm: string, callback) => {
        try {
            const response = await dispatch(searchProfiles(searchTerm, {page: 0}));
            if (response && response.data && response.data.length > 0) {
                const users = response.data.
                    filter((userProfile) => !userProfile.is_bot).
                    map((user) => ({
                        value: user.id,
                        label: user.username,
                        raw: user,
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

    function handleOnChange(value: MultiValue<UserProfileAutocompleteOptionType>) {
        // TODO
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
                placeholder={placeholder}
                loadingMessage={userLoadingMessage}
                noOptionsMessage={noUsersMessage}
                loadOptions={searchUsersFromTerm}
                onChange={handleOnChange}
                components={{
                    LoadingIndicator,
                    DropdownIndicator: () => null,
                    IndicatorSeparator: () => null,
                    Option: UserOptionComponent,
                    MultiValue: UserProfilePill,
                }}
            />
        </div>
    );
}
