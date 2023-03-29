// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Store} from 'redux';
import {GlobalState} from '@mattermost/types/store';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {matchPath} from 'react-router-dom';

import {fetchPlaybookRuns, telemetryEventForPlaybookRun} from 'src/client';
import {currentPlaybookRun, inPlaybookRunChannel, isPlaybookRunRHSOpen} from 'src/selectors';
import {PlaybookRunStatus} from 'src/types/playbook_run';

import {receivedTeamPlaybookRuns, toggleRHS} from 'src/actions';
import {browserHistory} from 'src/webapp_globals';

export function makeRHSOpener(store: Store<GlobalState>): () => Promise<void> {
    let currentTeamId = '';
    let currentChannelId = '';
    let currentChannelIsPlaybookRun = false;

    return async () => {
        const state = store.getState();
        const currentChannel = getCurrentChannel(state);
        const currentTeam = getCurrentTeam(state);
        const playbookRun = currentPlaybookRun(state);
        const url = new URL(window.location.href);
        const isInChannel = matchPath(url.pathname, {path: '/:team/:path(channels|messages)/:identifier/:postid?'});

        //@ts-ignore Views not in global state
        const mmRhsOpen = state.views.rhs.isSidebarOpen;

        // Wait for a valid team and channel before doing anything.
        if (!isInChannel || !currentChannel || !currentTeam) {
            return;
        }

        // Update the known set of playbook runs whenever the team changes.
        if (currentTeamId !== currentTeam.id) {
            currentTeamId = currentTeam.id;
            const currentUserId = getCurrentUserId(state);
            const fetched = await fetchPlaybookRuns({
                page: 0,
                per_page: 0,
                team_id: currentTeam.id,
                participant_id: currentUserId,
                statuses: [PlaybookRunStatus.InProgress],
            });
            store.dispatch(receivedTeamPlaybookRuns(fetched.items));
        }

        const searchParams = new URLSearchParams(url.searchParams);

        if (searchParams.has('telem_action') && searchParams.has('telem_run_id')) {
            // Record and remove telemetry
            const action = searchParams.get('telem_action') || '';
            const runId = searchParams.get('telem_run_id') || '';
            telemetryEventForPlaybookRun(runId, action);
            searchParams.delete('telem_action');
            searchParams.delete('telem_run_id');
            browserHistory.replace({pathname: url.pathname, search: searchParams.toString()});
        }

        // Only consider opening the RHS if the channel has changed and wasn't already seen as
        // a playbook run.
        if (currentChannel.id === currentChannelId && currentChannelIsPlaybookRun) {
            return;
        }
        currentChannelId = currentChannel.id;
        currentChannelIsPlaybookRun = inPlaybookRunChannel(state);

        // Don't do anything unless we're in a playbook run channel.
        if (!currentChannelIsPlaybookRun) {
            return;
        }

        // Record (and remove) if we were asked to force the RHS open.
        let forceRHSOpen = false;
        if (searchParams.has('forceRHSOpen')) {
            forceRHSOpen = true;
            searchParams.delete('forceRHSOpen');
            browserHistory.replace({pathname: url.pathname, search: searchParams.toString()});
        }

        // Don't do anything if the playbook run RHS is already open.
        if (isPlaybookRunRHSOpen(state)) {
            return;
        }

        // Should we force open the RHS?
        if (forceRHSOpen) {
            //@ts-ignore thunk
            store.dispatch(toggleRHS());
            return;
        }

        // Don't do anything if the playbook run is finished.
        if (playbookRun && playbookRun.current_status === PlaybookRunStatus.Finished) {
            return;
        }

        // Don't navigate away from an alternate sidebar that is open.
        if (mmRhsOpen) {
            return;
        }

        //@ts-ignore thunk
        store.dispatch(toggleRHS());
    };
}
