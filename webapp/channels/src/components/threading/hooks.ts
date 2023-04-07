// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo, useCallback} from 'react';
import {useParams, useHistory} from 'react-router-dom';
import {useSelector, shallowEqual} from 'react-redux';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import type {History} from 'history';

import type {UserThread} from '@mattermost/types/threads';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

export type ThreadRouting = {
    currentTeamId: Team['id'];
    currentUserId: UserProfile['id'];
    history?: History;
    params?: {
        team?: Team['name'];
    };

    clear?: () => void;
    goToInChannel: (id: UserThread['id'], teamName?: Team['name']) => void;
    select: (threadId?: UserThread['id']) => void;
}

/**
 * GlobalThreads-specific hook for nav/routing, selection, and common data needed for actions.
 */
export function useThreadRouting() {
    const matchParams = useParams<{team: Team['name']; threadIdentifier?: UserThread['id']}>();
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
