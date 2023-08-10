// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo, useCallback} from 'react';
import {useSelector, shallowEqual} from 'react-redux';
import {useParams, useHistory} from 'react-router-dom';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import type {Team} from '@mattermost/types/teams';
import type {UserThread} from '@mattermost/types/threads';

/**
 * GlobalThreads-specific hook for nav/routing, selection, and common data needed for actions.
 */
export function useThreadRouting() {
    const matchParams = useParams<{team: string; threadIdentifier?: UserThread['id']}>();
    const params = useMemo(() => matchParams, [matchParams.threadIdentifier, matchParams.team]);
    const history = useHistory();

    const currentTeamId = useSelector(getCurrentTeamId, shallowEqual);
    const currentUserId = useSelector(getCurrentUserId, shallowEqual);

    const select = useCallback((threadId?: UserThread['id']) => {
        return history.push(`/${params.team}/threads${threadId ? '/' + threadId : ''}`);
    }, [params.team]);

    const clear = useCallback(() => history.replace(`/${params.team}/threads`), [params.team]);

    const goToInChannel = useCallback((threadId?: UserThread['id'], teamName: Team['name'] = params.team) => {
        return history.push(`/${teamName}/pl/${threadId ?? params.threadIdentifier}`);
    }, [params.threadIdentifier, params.team]);

    return {
        params,
        history,
        currentTeamId,
        currentUserId,
        clear,
        select,
        goToInChannel,
    };
}
