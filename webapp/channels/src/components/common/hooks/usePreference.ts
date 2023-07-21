// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PreferenceType} from '@mattermost/types/preferences';
import {useCallback, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getMyPreferences} from 'mattermost-redux/selectors/entities/preferences';
import {ActionFunc} from 'mattermost-redux/types/actions';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

export default function usePreference(category: string, name: string): [string | undefined, (value: string) => ActionFunc] {
    const dispatch = useDispatch();

    const userId = useSelector(getCurrentUserId);
    const preferences = useSelector(getMyPreferences);

    const key = getPreferenceKey(category, name);
    const preference = preferences[key];

    const setPreference = useCallback((value: string) => {
        const preference: PreferenceType = {
            category,
            name,
            user_id: userId,
            value,
        };
        return dispatch(savePreferences(userId, [preference]));
    }, [category, name, userId]);

    return useMemo(() => ([preference?.value, setPreference]), [preference?.value, setPreference]);
}
