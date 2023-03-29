// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserSearchOptions, UserListOptions, UserFilters} from 'utils/constants';

export type FilterOptions = Record<string, string | boolean>
const NEVER = 0;

// userSelectorOptionsFromFilter will convert a string UI filter to an options object
// for selecting users out of redux state
// Note: this is currently the same as getUserOptionsFromFilter but wrapped to be clear
// that there are separate purposes (this can be used with both getProfiles and searchProfiles
// selectors)
export function userSelectorOptionsFromFilter(filter: string | undefined): FilterOptions {
    return getUserOptionsFromFilter(filter);
}

// getUserOptionsFromFilter will convert a string UI filter to an options objects
// for an API request to the get users endpoint
export function getUserOptionsFromFilter(filter: string | undefined): FilterOptions {
    const options: FilterOptions = {};
    if (filter === UserFilters.SYSTEM_ADMIN) {
        options[UserListOptions.ROLE] = UserFilters.SYSTEM_ADMIN;
    } else if (filter === UserFilters.SYSTEM_GUEST) {
        options[UserListOptions.ROLE] = UserFilters.SYSTEM_GUEST;
    } else if (filter === UserFilters.INACTIVE) {
        options[UserListOptions.INACTIVE] = true;
    } else if (filter === UserFilters.ACTIVE) {
        options[UserListOptions.ACTIVE] = true;
    }
    return options;
}

// searchUserOptionsFromFilter will convert a string UI filter to an options objects
// for an API request to the search users endpoint
export function searchUserOptionsFromFilter(filter: string | undefined): FilterOptions {
    const options: FilterOptions = {};
    if (filter === UserFilters.SYSTEM_ADMIN) {
        options[UserSearchOptions.ROLE] = UserFilters.SYSTEM_ADMIN;
    } else if (filter === UserFilters.SYSTEM_GUEST) {
        options[UserSearchOptions.ROLE] = UserFilters.SYSTEM_GUEST;
    } else if (filter === UserFilters.INACTIVE) {
        options[UserSearchOptions.ALLOW_INACTIVE] = true;
    }
    return options;
}

// isActive returns whether a user is active or not.
export function isActive(user: {delete_at: number}): boolean {
    return user.delete_at === NEVER;
}
