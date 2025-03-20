// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {PreferenceType} from '@mattermost/types/preferences';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {get as getPreference} from 'mattermost-redux/selectors/entities/preferences';
import type {ActionResult} from 'mattermost-redux/types/actions';

import type {GlobalState} from 'types/store';

export default function usePreference(category: string, name: string): [string | undefined, (value: string) => Promise<ActionResult>] {
    const dispatch = useDispatch();

    const userId = useSelector(getCurrentUserId);
    const preferenceValue = useSelector((state: GlobalState) => getPreference(state, category, name));

    const setPreference = useCallback((value: string) => {
        const preference: PreferenceType = {
            category,
            name,
            user_id: userId,
            value,
        };
        return dispatch(savePreferences(userId, [preference]));
    }, [category, dispatch, name, userId]);

    return useMemo(() => ([preferenceValue, setPreference]), [preferenceValue, setPreference]);
}
