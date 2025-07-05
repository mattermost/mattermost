// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {type ReactElement, useCallback, useEffect, useMemo, useRef} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import type {MultiValue} from 'react-select';
import AsyncSelect from 'react-select/async';

import type {UserProfile} from '@mattermost/types/users';

import {debounce} from 'mattermost-redux/actions/helpers';
import {getMissingProfilesByIds, searchProfiles} from 'mattermost-redux/actions/users';
import {getUsersByIDs} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import {UserProfilePill} from './user_profile_pill';

import {UserOptionComponent} from '../../content_flagging/user_multiselector/user_profile_option';
import {LoadingIndicator} from '../../system_users/system_users_filters_popover/system_users_filter_team';

import './user_multiselect.scss';

export type AutocompleteOptionType<T> = {
    label: string | ReactElement;
    value: string;
    raw?: T;
}

type Props = {
    id: string;
    className?: string;
    onChange: (selectedUserIds: string[]) => void;
    initialValue?: string[];
    hasError?: boolean;
}

export function UserMultiSelector({id, className, onChange, initialValue, hasError}: Props) {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const initialDataLoaded = useRef<boolean>(false);

    useEffect(() => {
        const fetchInitialData = async () => {
            await dispatch(getMissingProfilesByIds(initialValue || []));
            initialDataLoaded.current = true;
        };

        if (initialValue && !initialDataLoaded.current) {
            fetchInitialData();
        }
    }, [dispatch, initialValue]);

    const initialUsers = useSelector((state: GlobalState) => getUsersByIDs(state, initialValue || []));
    const selectInitialValue = initialUsers.
        filter((userProfile) => Boolean(userProfile)).
        map((userProfile: UserProfile) => ({
            value: userProfile.id,
            label: userProfile.username,
            raw: userProfile,
        } as AutocompleteOptionType<UserProfile>));

    const userLoadingMessage = useCallback(() => formatMessage({id: 'admin.userMultiSelector.loading', defaultMessage: 'Loading users'}), [formatMessage]);
    const noUsersMessage = useCallback(() => formatMessage({id: 'admin.userMultiSelector.noUsers', defaultMessage: 'No users found'}), [formatMessage]);
    const placeholder = formatMessage({id: 'admin.userMultiSelector.placeholder', defaultMessage: 'Start typing to search for users...'});

    const searchUsers = useMemo(() => debounce(async (searchTerm: string, callback) => {
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
            } else {
                callback([]);
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
            callback([]);
        }
    }, 200), [dispatch]);

    function handleOnChange(value: MultiValue<AutocompleteOptionType<UserProfile>>) {
        const selectedUserIds = value.map((option) => option.value);
        onChange?.(selectedUserIds);
    }

    return (
        <div className='UserMultiSelector'>
            <AsyncSelect
                id={id}
                inputId={`${id}_input`}
                classNamePrefix='UserMultiSelector'
                className={classNames('Input Input__focus', className, {error: hasError})}
                isMulti={true}
                isClearable={false}
                hideSelectedOptions={true}
                cacheOptions={true}
                placeholder={placeholder}
                loadingMessage={userLoadingMessage}
                noOptionsMessage={noUsersMessage}
                loadOptions={searchUsers}
                onChange={handleOnChange}
                value={selectInitialValue}
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
