// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useMemo, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {ServerLimits} from '@mattermost/types/limits';

import {getServerLimits as getServerLimitsAction} from 'mattermost-redux/actions/limits';
import {getServerLimits as getServerLimitsSelector} from 'mattermost-redux/selectors/entities/limits';

import {useIsLoggedIn} from 'components/global_header/hooks';

export default function useGetServerLimits(): [ServerLimits, boolean] {
    const isLoggedIn = useIsLoggedIn();
    const serverLimits = useSelector(getServerLimitsSelector);
    const dispatch = useDispatch();
    const [requested, setRequested] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        // All logged-in users can fetch server limits (server handles permission filtering)
        if (isLoggedIn && !requested) {
            dispatch(getServerLimitsAction());
            setRequested(true);
        }
    }, [isLoggedIn, requested, dispatch]);

    useEffect(() => {
        // Mark as loaded when we have server limits data
        if (serverLimits && (serverLimits.postHistoryLimit !== undefined || serverLimits.activeUserCount >= 0)) {
            setLoaded(true);
        }
    }, [serverLimits]);

    const result: [ServerLimits, boolean] = useMemo(() => {
        return [serverLimits, loaded];
    }, [serverLimits, loaded]);

    return result;
}
