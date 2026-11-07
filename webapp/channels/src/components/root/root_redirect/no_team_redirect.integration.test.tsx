// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';
import {Route, Switch} from 'react-router-dom';

import {Client4} from 'mattermost-redux/client';

import PreparingWorkspace from 'components/preparing_workspace/preparing_workspace';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';

import RootRedirect from './index';

jest.mock('react-router-dom', () => jest.requireActual('react-router-dom'));
jest.mock('utils/browser_history', () => ({getHistory: jest.fn()}));
jest.mock('utils/utils', () => ({...jest.requireActual('utils/utils'), applyTheme: jest.fn(), resetTheme: jest.fn()}));
jest.mock('stores/redux_store', () => ({dispatch: jest.fn(), getState: jest.fn(), replaceReducer: jest.fn(), subscribe: jest.fn(), '@@observable': jest.fn()}));
jest.mock('mattermost-redux/actions/users', () => ({
    ...jest.requireActual('mattermost-redux/actions/users'),
    loadMe: () => ({type: 'MOCK_LOAD_ME'}),
}));
jest.mock('components/preparing_workspace/organization', () => () => null);
jest.mock('components/preparing_workspace/plugins', () => () => null);
jest.mock('components/preparing_workspace/invite_members', () => () => null);
jest.mock('components/preparing_workspace/launching_workspace', () => ({__esModule: true, default: () => null, START_TRANSITIONING_OUT: 0}));

test.each([
    {initialPath: '/', expectedTransitions: ['/select_team'], expectedSearch: ''},
    {initialPath: '/preparing-workspace', expectedTransitions: ['/', '/select_team'], expectedSearch: ''},
    {initialPath: '/?test=value', expectedTransitions: ['/select_team'], expectedSearch: '?test=value'},
])('a first admin with completed setup and no teams reaches team selection from $initialPath without a redirect cycle', async ({initialPath, expectedTransitions, expectedSearch}) => {
    const history = createMemoryHistory({initialEntries: [initialPath]});
    jest.mocked(getHistory).mockReturnValue(history);
    jest.spyOn(Client4, 'getFirstAdminSetupComplete').mockResolvedValue({name: 'FirstAdminSetupComplete', value: 'true'});
    const transitions: string[] = [];
    const push = history.push;
    jest.spyOn(history, 'push').mockImplementation((path, state) => {
        const pathname = typeof path === 'string' ? path : path.pathname!;
        transitions.push(pathname);

        // Bound an unfixed redirect loop so the test can report its route sequence.
        if (transitions.length <= 6) {
            push(path, state);
        }
    });

    const selectionHeading = 'Select a team';
    renderWithContext(
        <Switch>
            <Route path='/select_team'>
                <h1>{selectionHeading}</h1>
            </Route>
            <Route
                path='/preparing-workspace'
                render={(props) => (
                    <PreparingWorkspace
                        {...props}
                        actions={{createTeam: jest.fn(), updateTeam: jest.fn(), checkIfTeamExists: jest.fn(), getProfiles: jest.fn()}}
                    />
                )}
            />
            <Route>
                <RootRedirect/>
            </Route>
        </Switch>,
        {
            entities: {
                general: {
                    config: {EnableOnboardingFlow: 'true', DefaultClientLocale: 'en'},
                },
                users: {
                    currentUserId: 'admin',
                    profiles: {admin: {id: 'admin', roles: 'system_admin', create_at: 1}},
                },
                teams: {teams: {}, myMembers: {}},
            },
        },
        {history},
    );

    await waitFor(() => {
        expect(transitions).toEqual(expectedTransitions);
        expect(history.location.pathname).toBe('/select_team');
        expect(history.location.search).toBe(expectedSearch);
        expect(screen.getByRole('heading', {name: selectionHeading})).toBeVisible();
    });
});
