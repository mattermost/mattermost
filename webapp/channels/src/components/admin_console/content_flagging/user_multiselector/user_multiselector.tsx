// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {type ReactElement, useCallback, useEffect, useMemo, useRef} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import type {MultiValue, SingleValue} from 'react-select';
import AsyncSelect from 'react-select/async';

import type {Group} from '@mattermost/types/groups';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {getGroup, searchGroups} from 'mattermost-redux/actions/groups';
import {debounce} from 'mattermost-redux/actions/helpers';
import {getTeam, searchTeams} from 'mattermost-redux/actions/teams';
import {getMissingProfilesByIds, searchProfiles} from 'mattermost-redux/actions/users';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getAllGroups} from 'mattermost-redux/selectors/entities/groups';
import {isCustomGroupsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getTeams} from 'mattermost-redux/selectors/entities/teams';
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
    enableTeams?: boolean;
    disabled?: boolean;
};

export function UserSelector({id, isMulti, className, multiSelectOnChange, multiSelectInitialValue, singleSelectOnChange, singleSelectInitialValue, hasError, placeholder, showDropdownIndicator, searchFunc, enableGroups = false, enableTeams = false, disabled = false}: Props) {
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

            // Fetch teams if enabled
            // Note: We try to fetch all IDs as teams, but silently ignore errors since some might be user IDs
            if (enableTeams) {
                // Fetch each team individually, ignoring errors for non-team IDs
                const teamFetchPromises = param.map((id) =>
                    dispatch(getTeam(id)).catch(() => {
                        // Silently ignore - this ID might be a user, not a team
                        return {error: true};
                    }),
                );
                await Promise.allSettled(teamFetchPromises);
            }

            initialDataLoaded.current = true;
        };

        if (initialValue && initialValue.length > 0) {
            fetchInitialData();
        }
    }, [dispatch, initialValue, isMulti, multiSelectInitialValue, singleSelectInitialValue, isGroupsEnabled, enableTeams]);

    const getUsersByIds = useMemo(makeGetUsersByIds, []);
    const initialUsers = useSelector((state: GlobalState) => getUsersByIds(state, initialValue || []));
    const allGroups = useSelector(getAllGroups);
    const allTeams = useSelector(getTeams);

    const selectInitialValue = useMemo(() => {
        const result: Array<AutocompleteOptionType<UserProfile | Group | Team>> = [];
        const addedIds = new Set<string>();

        if (!initialValue) {
            return result;
        }

        // Build a map of user IDs for quick lookup
        const userMap = new Map<string, UserProfile>();
        initialUsers.filter(Boolean).forEach((user: UserProfile) => {
            userMap.set(user.id, user);
        });

        // Iterate through initialValue once and add each ID as either user, group, or team
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
                    return;
                }
            }

            // If not a user or group and teams are enabled, try to add as team
            if (enableTeams) {
                const team = allTeams[id];
                if (team) {
                    result.push({
                        value: team.id,
                        label: team.display_name || team.name,
                        raw: team,
                    });
                    addedIds.add(id);
                }
            }
        });

        return result;
    }, [initialUsers, allGroups, allTeams, initialValue, isGroupsEnabled, enableTeams]);

    const userLoadingMessage = useCallback(() => formatMessage({id: 'admin.userMultiSelector.loading', defaultMessage: 'Loading users'}), [formatMessage]);
    const noUsersMessage = useCallback(({inputValue}: {inputValue: string}) => {
        // Don't show "No users found" when input is empty
        if (!inputValue || inputValue.trim() === '') {
            return null;
        }
        return formatMessage({id: 'admin.userMultiSelector.noUsers', defaultMessage: 'No users found'});
    }, [formatMessage]);
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

            // Search for teams if enabled
            let teamResults: ActionResult<{teams: Team[]; total_count: number} | Team[]> | undefined;
            if (enableTeams) {
                const teamSearchOpts = {
                    page: 0,
                    per_page: 100,
                };

                teamResults = await dispatch(searchTeams(searchTerm, teamSearchOpts));
            }

            let options: Array<AutocompleteOptionType<UserProfile | Group | Team>> = [];

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

            // Process team results
            if (teamResults && teamResults.data) {
                // Handle both response formats: {teams: Team[]} or Team[]
                const teams = Array.isArray(teamResults.data) ? teamResults.data : teamResults.data.teams;
                if (teams && teams.length > 0) {
                    const teamOptions = teams.
                        filter((team) => team.delete_at === 0).
                        map((team) => ({
                            value: team.id,
                            label: team.display_name || team.name,
                            raw: team,
                        }));

                    options = [...options, ...teamOptions];
                }
            }

            // Sort results (users, groups, and/or teams)
            if (options.length > 0) {
                options.sort((a, b) => {
                    if (!a.raw || !b.raw) {
                        return 0;
                    }

                    // For users only, sort by username
                    if ('username' in a.raw && 'username' in b.raw) {
                        return (a.raw.username || '').localeCompare(b.raw.username || '');
                    }

                    // For teams, sort by display_name
                    if ('type' in a.raw && 'type' in b.raw) {
                        const aName = a.raw.display_name || a.raw.name || '';
                        const bName = b.raw.display_name || b.raw.name || '';
                        return aName.localeCompare(bName);
                    }

                    // For groups or mixed types with users
                    if ('source' in a.raw || 'source' in b.raw) {
                        return sortUsersAndGroups(a.raw as UserProfile | Group, b.raw as UserProfile | Group);
                    }

                    // Default: sort by display_name/name
                    const aName = ('display_name' in a.raw ? a.raw.display_name : '') || ('name' in a.raw ? a.raw.name : '') || '';
                    const bName = ('display_name' in b.raw ? b.raw.display_name : '') || ('name' in b.raw ? b.raw.name : '') || '';
                    return aName.localeCompare(bName);
                });
            }

            callback(options);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
            callback([]);
        }
    }, 200), [dispatch, isGroupsEnabled, enableTeams]);

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

    const multiSelectHandleOnChange = useCallback((value: MultiValue<AutocompleteOptionType<UserProfile | Group | Team>>) => {
        const selectedUserIds = value.map((option) => option.value);
        multiSelectOnChange?.(selectedUserIds);
    }, [multiSelectOnChange]);

    const singleSelectHandleOnChange = useCallback((value: SingleValue<AutocompleteOptionType<UserProfile | Group | Team>>) => {
        const selectedUserIds = value?.value || '';
        singleSelectOnChange?.(selectedUserIds);
    }, [singleSelectOnChange]);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - Complex ReactSelect types with Team support - AriaLiveMessages type mismatch unavoidable
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

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - Complex ReactSelect types with Team support - AriaLiveMessages type mismatch unavoidable
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
                <AsyncSelect<AutocompleteOptionType<UserProfile | Group | Team>, true>
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
            <AsyncSelect<AutocompleteOptionType<UserProfile | Group | Team>, false>
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
