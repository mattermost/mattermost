// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {Agent} from '@mattermost/types/agents';
import type {PreferenceType} from '@mattermost/types/preferences';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getDefaultAgent} from 'mattermost-redux/selectors/entities/agents';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {get as getPreference} from 'mattermost-redux/selectors/entities/preferences';
import type {ActionResult} from 'mattermost-redux/types/actions';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

// Resolves the active agent (precedence: saved preference -> default agent -> first)
// and returns a setter that persists the choice. Persists only on explicit selection.
export default function useSelectedAgent(agents: Agent[]): [string, (agentId: string) => Promise<ActionResult>] {
    const dispatch = useDispatch();

    const userId = useSelector(getCurrentUserId);
    const preferredAgentId = useSelector((state: GlobalState) => getPreference(state, Preferences.CATEGORY_AGENTS, Preferences.SELECTED_AGENT));
    const defaultAgent = useSelector(getDefaultAgent);

    const selectedAgentId = useMemo(() => {
        if (preferredAgentId && agents.some((agent) => agent.id === preferredAgentId)) {
            return preferredAgentId;
        }
        if (defaultAgent && agents.some((agent) => agent.id === defaultAgent.id)) {
            return defaultAgent.id;
        }
        return agents.length > 0 ? agents[0].id : '';
    }, [agents, preferredAgentId, defaultAgent]);

    const setSelectedAgent = useCallback((agentId: string) => {
        const preference: PreferenceType = {
            category: Preferences.CATEGORY_AGENTS,
            name: Preferences.SELECTED_AGENT,
            user_id: userId,
            value: agentId,
        };
        return dispatch(savePreferences(userId, [preference]));
    }, [dispatch, userId]);

    return useMemo(() => ([selectedAgentId, setSelectedAgent]), [selectedAgentId, setSelectedAgent]);
}
