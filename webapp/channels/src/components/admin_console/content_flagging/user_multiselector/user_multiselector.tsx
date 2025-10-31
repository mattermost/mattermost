// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {type ReactElement, useCallback, useEffect, useMemo, useRef} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import type {MultiValue, SingleValue} from 'react-select';
import AsyncSelect from 'react-select/async';

import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import {getGroup, searchGroups} from 'mattermost-redux/actions/groups';
import {debounce} from 'mattermost-redux/actions/helpers';
import {getMissingProfilesByIds, searchProfiles} from 'mattermost-redux/actions/users';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getAllGroups} from 'mattermost-redux/selectors/entities/groups';
import {isCustomGroupsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {makeGetUsersByIds} from 'mattermost-redux/selectors/entities/users';
import type {ActionResult} from 'mattermost-redux/types/actions';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {sortUsersAndGroups} from 'utils/utils';

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
    enableGroups?: boolean;
    disabled?: boolean;
};

export function UserSelector({id, isMulti, className, multiSelectOnChange, multiSelectInitialValue, singleSelectOnChange, singleSelectInitialValue, hasError, placeholder, showDropdownIndicator, searchFunc, enableGroups = false, disabled = false}: Props) {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const initialDataLoaded = useRef<boolean>(false);

    // Check if groups are enabled
    const currentLicense = useSelector(getLicense);
    const isGroupsEnabled = useSelector((state: GlobalState) => {
        if (!enableGroups) {
            return false;
        }
        const customGroupsEnabled = isCustomGroupsEnabled(state);
        const ldapGroupsEnabled = currentLicense?.IsLicensed === 'true' && currentLicense?.LDAPGroups === 'true';
        return customGroupsEnabled || ldapGroupsEnabled;
    });

    const initialValue = useMemo(() => {
        return isMulti ? multiSelectInitialValue : [singleSelectInitialValue || ''];
    }, [isMulti, multiSelectInitialValue, singleSelectInitialValue]);

    useEffect(() => {
        const fetchInitialData = async () => {
            const param = isMulti ? multiSelectInitialValue : [singleSelectInitialValue || ''];

            if (!param || param.length === 0 || !param[0]) {
                return;
            }

            // Fetch user profiles
            await dispatch(getMissingProfilesByIds(param));

            // Fetch groups if enabled
            // Note: We try to fetch all IDs as groups, but silently ignore errors since some might be user IDs
            if (isGroupsEnabled) {
                // Fetch each group individually, ignoring errors for non-group IDs
                const groupFetchPromises = param.map((id) =>
                    dispatch(getGroup(id)).catch(() => {
                        // Silently ignore - this ID might be a user, not a group
                        return {error: true};
                    }),
                );
                await Promise.allSettled(groupFetchPromises);
            }

            initialDataLoaded.current = true;
        };

        if (initialValue && initialValue.length > 0) {
            fetchInitialData();
        }
    }, [dispatch, initialValue, isMulti, multiSelectInitialValue, singleSelectInitialValue, isGroupsEnabled]);

    const getUsersByIds = useMemo(makeGetUsersByIds, []);
    const initialUsers = useSelector((state: GlobalState) => getUsersByIds(state, initialValue || []));
    const allGroups = useSelector(getAllGroups);

    const selectInitialValue = useMemo(() => {
        const result: Array<AutocompleteOptionType<UserProfile | Group>> = [];
        const addedIds = new Set<string>();

        if (!initialValue) {
            return result;
        }

        // Build a map of user IDs for quick lookup
        const userMap = new Map<string, UserProfile>();
        initialUsers.filter(Boolean).forEach((user: UserProfile) => {
            userMap.set(user.id, user);
        });

        // Iterate through initialValue once and add each ID as either user or group
        initialValue.forEach((id) => {
            if (addedIds.has(id)) {
                return; // Skip duplicates
            }

            // Try to add as user first
            const user = userMap.get(id);
            if (user) {
                result.push({
                    value: user.id,
                    label: user.username,
                    raw: user,
                });
                addedIds.add(id);
                return;
            }

            // If not a user and groups are enabled, try to add as group
            if (isGroupsEnabled) {
                const group = allGroups[id];
                if (group) {
                    result.push({
                        value: group.id,
                        label: group.display_name || group.name,
                        raw: group,
                    });
                    addedIds.add(id);
                }
            }
        });

        return result;
    }, [initialUsers, allGroups, initialValue, isGroupsEnabled]);

    const userLoadingMessage = useCallback(() => formatMessage({id: 'admin.userMultiSelector.loading', defaultMessage: 'Loading users'}), [formatMessage]);
    const noUsersMessage = useCallback(() => formatMessage({id: 'admin.userMultiSelector.noUsers', defaultMessage: 'No users found'}), [formatMessage]);
    const defaultPlaceholder = formatMessage({id: 'admin.userMultiSelector.placeholder', defaultMessage: 'Start typing to search for users...'});

    const generalSearchUsers = useMemo(() => debounce(async (searchTerm: string, callback) => {
        try {
            const userSearchOptions = {
                page: 0,
            };

            // Always search for users
            const userResults: ActionResult<UserProfile[]> = await dispatch(searchProfiles(searchTerm, userSearchOptions));

            // Search for groups if enabled
            let groupResults: ActionResult<Group[]> | undefined;
            if (isGroupsEnabled) {
                const groupSearchOpts = {
                    q: searchTerm,
                    filter_allow_reference: true,
                    page: 0,
                    per_page: 100,
                    include_member_count: true,
                    include_member_ids: false,
                };

                groupResults = await dispatch(searchGroups(groupSearchOpts));
            }

            let options: Array<AutocompleteOptionType<UserProfile | Group>> = [];

            // Process user results
            if (userResults && userResults.data && userResults.data.length > 0) {
                const userOptions = userResults.data.
                    filter((userProfile) => !userProfile.is_bot && userProfile.delete_at === 0).
                    map((user) => ({
                        value: user.id,
                        label: displayUsername(user, ''),
                        raw: user,
                    }));

                options = [...options, ...userOptions];
            }

            // Process group results
            if (groupResults && groupResults.data && groupResults.data.length > 0) {
                const groupOptions = groupResults.data.
                    filter((group) => group.delete_at === 0).
                    map((group) => ({
                        value: group.id,
                        label: group.display_name || group.name,
                        raw: group,
                    }));

                options = [...options, ...groupOptions];
            }

            // Sort results (users and/or groups)
            if (options.length > 0) {
                options.sort((a, b) => {
                    if (!a.raw || !b.raw) {
                        return 0;
                    }

                    // For users only, sort by username
                    if ('username' in a.raw && 'username' in b.raw) {
                        return (a.raw.username || '').localeCompare(b.raw.username || '');
                    }

                    // For mixed or groups, use the utility function
                    return sortUsersAndGroups(a.raw, b.raw);
                });
            }

            callback(options);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
            callback([]);
        }
    }, 200), [dispatch, isGroupsEnabled]);

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

    const multiSelectHandleOnChange = useCallback((value: MultiValue<AutocompleteOptionType<UserProfile | Group>>) => {
        const selectedUserIds = value.map((option) => option.value);
        multiSelectOnChange?.(selectedUserIds);
    }, [multiSelectOnChange]);

    const singleSelectHandleOnChange = useCallback((value: SingleValue<AutocompleteOptionType<UserProfile | Group>>) => {
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
            isDisabled: disabled,
        };
    }, [className, defaultPlaceholder, disabled, hasError, id, noUsersMessage, placeholder, searchUsers, userLoadingMessage]);

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
            />
        </div>
    );
}
