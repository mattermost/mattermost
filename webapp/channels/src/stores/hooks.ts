// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useSelector, useDispatch, shallowEqual} from 'react-redux';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {setGlobalItem} from 'actions/storage';
import {makeGetGlobalItem} from 'selectors/storage';

const currentUserAndTeamSuffix = createSelector('currentUserAndTeamSuffix', [
    getCurrentUserId,
    getCurrentTeamId,
], (
    userId,
    teamId,
) => {
    return `:${userId}:${teamId}`;
});

/**
 *
 * @param initialValue
 * @param name name of stored value, prepended to suffix
 * @param suffix to provide scope; defaults to user and team
 */
export function useGlobalState<TVal>(
    initialValue: TVal,
    name: string,
    suffix?: string,
): [TVal, (value: TVal) => ReturnType<typeof setGlobalItem>] {
    const dispatch = useDispatch();
    const defaultSuffix = useSelector(currentUserAndTeamSuffix);
    const suffixToUse = suffix || defaultSuffix;
    const storedKey = `${name}${suffixToUse}`;

    const value = useSelector(makeGetGlobalItem(storedKey, initialValue), shallowEqual);
    const setValue = useCallback((newValue) => dispatch(setGlobalItem(storedKey, newValue)), [storedKey]);

    return [
        value,
        setValue,
    ];
}
