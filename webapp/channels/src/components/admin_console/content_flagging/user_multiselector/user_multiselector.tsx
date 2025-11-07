// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {type ReactElement, useCallback, useEffect, useMemo, useRef} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import type {MultiValue, SingleValue} from 'react-select';
import AsyncSelect from 'react-select/async';

import type {UserProfile} from '@mattermost/types/users';

import {debounce} from 'mattermost-redux/actions/helpers';
import {getMissingProfilesByIds, searchProfiles} from 'mattermost-redux/actions/users';
import {makeGetUsersByIds} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import {MultiUserProfilePill, SingleUserProfilePill} from './user_profile_pill';

import {MultiUserOptionComponent, SingleUserOptionComponent} from '../../content_flagging/user_multiselector/user_profile_option';
import {LoadingIndicator} from '../../system_users/system_users_filters_popover/system_users_filter_team';

import './user_multiselect.scss';

export type AutocompleteOptionType<T> = {
    label: string | ReactElement;
    value: string;
    raw?: T;
}

const BASE_SELECT_COMPONENTS = {
    LoadingIndicator,
    DropdownIndicator: () => null,
    IndicatorSeparator: () => null,
};

type MultiSelectProps = {
    multiSelectOnChange?: (selectedUserIds: string[]) => void;
    multiSelectInitialValue?: string[];
}

type SingleSelectProps = {
    singleSelectOnChange?: (selectedUserId: string) => void;
    singleSelectInitialValue?: string;
}

type Props = MultiSelectProps & SingleSelectProps & {
    id: string;
    isMulti: boolean;
    className?: string;
    hasError?: boolean;
    placeholder?: React.ReactNode;
    showDropdownIndicator?: boolean;
    searchFunc?: (term: string) => Promise<UserProfile[]>;
    disabled?: boolean;
};

export function UserSelector({id, isMulti, className, multiSelectOnChange, multiSelectInitialValue, singleSelectOnChange, singleSelectInitialValue, hasError, placeholder, showDropdownIndicator, searchFunc, disabled}: Props) {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const initialDataLoaded = useRef<boolean>(false);

    const initialValue = useMemo(() => {
        return isMulti ? multiSelectInitialValue : [singleSelectInitialValue || ''];
    }, [isMulti, multiSelectInitialValue, singleSelectInitialValue]);

    useEffect(() => {
        const fetchInitialData = async () => {
            const param = isMulti ? multiSelectInitialValue : [singleSelectInitialValue || ''];
            await dispatch(getMissingProfilesByIds(param || []));
            initialDataLoaded.current = true;
        };

        if (Boolean(initialValue) && !initialDataLoaded.current) {
            fetchInitialData();
        }
    }, [dispatch, initialValue, isMulti, multiSelectInitialValue, singleSelectInitialValue]);

    const getUsersByIds = useMemo(makeGetUsersByIds, []);
    const initialUsers = useSelector((state: GlobalState) => getUsersByIds(state, initialValue || []));
    const selectInitialValue = initialUsers.
        filter((userProfile) => Boolean(userProfile)).
        map((userProfile: UserProfile) => ({
            value: userProfile.id,
            label: userProfile.username,
            raw: userProfile,
        } as AutocompleteOptionType<UserProfile>));

    const userLoadingMessage = useCallback(() => formatMessage({id: 'admin.userMultiSelector.loading', defaultMessage: 'Loading users'}), [formatMessage]);
    const noUsersMessage = useCallback(() => formatMessage({id: 'admin.userMultiSelector.noUsers', defaultMessage: 'No users found'}), [formatMessage]);
    const defaultPlaceholder = formatMessage({id: 'admin.userMultiSelector.placeholder', defaultMessage: 'Start typing to search for users...'});

    const generalSearchUsers = useMemo(() => debounce(async (searchTerm: string, callback) => {
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

    const customSearchFunc = useMemo(() => debounce(async (searchTerm: string, callback) => {
        if (!searchFunc) {
            return null;
        }

        try {
            const response = await searchFunc(searchTerm);
            const users = response.
                map((user) => ({
                    value: user.id,
                    label: user.username,
                    raw: user,
                }));

            callback(users);
            return null;
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
            callback([]);
            return null;
        }
    }, 200), [searchFunc]);

    const searchUsers = searchFunc ? customSearchFunc : generalSearchUsers;

    const multiSelectHandleOnChange = useCallback((value: MultiValue<AutocompleteOptionType<UserProfile>>) => {
        const selectedUserIds = value.map((option) => option.value);
        multiSelectOnChange?.(selectedUserIds);
    }, [multiSelectOnChange]);

    const singleSelectHandleOnChange = useCallback((value: SingleValue<AutocompleteOptionType<UserProfile>>) => {
        const selectedUserIds = value?.value || '';
        singleSelectOnChange?.(selectedUserIds);
    }, [singleSelectOnChange]);

    const multiSelectComponents = useMemo(() => {
        const componentObj = {
            ...BASE_SELECT_COMPONENTS,
            Option: MultiUserOptionComponent,
            MultiValue: MultiUserProfilePill,
        };

        if (showDropdownIndicator) {
            // @ts-expect-error doing this any other way runs into TypeScript nightmares due to very complex ReactSelect types
            delete componentObj.DropdownIndicator;
        }

        return componentObj;
    }, [showDropdownIndicator]);

    const singleSelectComponents = useMemo(() => {
        const componentObj = {
            ...BASE_SELECT_COMPONENTS,
            Option: SingleUserOptionComponent,
            SingleValue: SingleUserProfilePill,
        };

        if (showDropdownIndicator) {
            // @ts-expect-error doing this any other way runs into TypeScript nightmares due to very complex ReactSelect types
            delete componentObj.DropdownIndicator;
        }

        return componentObj;
    }, [showDropdownIndicator]);

    const baseProps = useMemo(() => {
        return {
            id,
            inputId: `${id}_input`,
            classNamePrefix: 'UserMultiSelector',
            className: classNames('Input Input__focus', className, {error: hasError}),
            isClearable: false,
            hideSelectedOptions: true,
            cacheOptions: true,
            placeholder: placeholder || defaultPlaceholder,
            loadingMessage: userLoadingMessage,
            noOptionsMessage: noUsersMessage,
            loadOptions: searchUsers,
            menuPortalTarget: document.body,
        };
    }, [className, defaultPlaceholder, hasError, id, noUsersMessage, placeholder, searchUsers, userLoadingMessage]);

    const containerClassName = classNames('UserMultiSelector', {multiSelect: isMulti, singleSelect: !isMulti});

    if (isMulti) {
        return (
            <div className={containerClassName}>
                <AsyncSelect
                    {...baseProps}
                    isMulti={true}
                    onChange={multiSelectHandleOnChange}
                    value={selectInitialValue}
                    components={multiSelectComponents}
                    isDisabled={disabled}
                />
            </div>
        );
    }

    return (
        <div className={containerClassName}>
            <AsyncSelect
                {...baseProps}
                isMulti={false}
                onChange={singleSelectHandleOnChange}
                value={selectInitialValue ? selectInitialValue[0] : null}
                components={singleSelectComponents}
                isDisabled={disabled}
            />
        </div>
    );
}
