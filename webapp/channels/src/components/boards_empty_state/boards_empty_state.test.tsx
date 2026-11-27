// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';
import {Route} from 'react-router-dom';

import type {DeepPartial} from '@mattermost/types/utilities';

import type {ChannelKindRegistration} from 'selectors/views/product_rail';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';
import type {SidebarBrowseOrAddChannelMenuAction} from 'types/store/plugins';

import BoardsEmptyState from './boards_empty_state';

const team = TestHelper.getTeamMock({id: 'team1', name: 'team-one'});
const user = TestHelper.getUserMock({id: 'user1', roles: 'system_user'});
const townSquare = TestHelper.getChannelMock({id: 'town', name: 'town-square', team_id: team.id});
const roadmap = TestHelper.getChannelMock({id: 'roadmap', name: 'roadmap', display_name: 'Roadmap', team_id: team.id});

const boardKind: ChannelKindRegistration = {
    id: 'board-kind',
    pluginId: 'boards',
    kind: 'board',
    matcher: (_state, channel) => channel.id === roadmap.id,
};

function makeCreateItem(pluginId: string, action = jest.fn()): SidebarBrowseOrAddChannelMenuAction {
    return {id: `${pluginId}-create`, pluginId, text: 'Create new board', action, icon: null, placement: 'afterCreateChannel'};
}

function getState({
    kinds = [boardKind],
    menuItems = [] as SidebarBrowseOrAddChannelMenuAction[],
    boardMember = false,
    canCreate = true,
} = {}): DeepPartial<GlobalState> {
    const member = (channelId: string) => TestHelper.getChannelMembershipMock({channel_id: channelId, user_id: user.id}, {});
    return {
        entities: {
            teams: {
                currentTeamId: team.id,
                teams: {[team.id]: team},
                myMembers: {[team.id]: TestHelper.getTeamMembershipMock({team_id: team.id, user_id: user.id, roles: 'team_user'})},
            },
            users: {currentUserId: user.id, profiles: {[user.id]: user}},
            channels: {
                currentChannelId: townSquare.id,
                channels: {[townSquare.id]: townSquare, [roadmap.id]: roadmap},
                myMembers: boardMember ? {[townSquare.id]: member(townSquare.id), [roadmap.id]: member(roadmap.id)} : {[townSquare.id]: member(townSquare.id)},
            },
            roles: {
                roles: {
                    system_user: {name: 'system_user', permissions: []},
                    team_user: {name: 'team_user', permissions: canCreate ? ['create_public_channel'] : []},
                },
            },
        },
        plugins: {

            // ChannelKind registrations come with the Boards plugin API, which the state type
            // doesn't know about yet.
            components: {
                ChannelKind: kinds,
                SidebarBrowseOrAddChannelMenu: menuItems,
            } as unknown as GlobalState['plugins']['components'],
        },
    };
}

function renderAt(state: DeepPartial<GlobalState>) {
    const history = createMemoryHistory({initialEntries: ['/team-one/boards']});
    renderWithContext(
        <Route
            path='/:team/boards'
            component={BoardsEmptyState}
        />,
        state,
        {history},
    );
    return history;
}

describe('BoardsEmptyState', () => {
    test('explains boards and creates one through the board plugin\'s own item', async () => {
        const action = jest.fn();
        renderAt(getState({menuItems: [makeCreateItem('other'), makeCreateItem('boards', action)]}));

        expect(screen.getByRole('heading', {name: 'Plan and track work with boards'})).toBeInTheDocument();
        expect(screen.getByText(/Boards organize work as cards/)).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Create a board'}));

        expect(action).toHaveBeenCalledWith(team.id);
    });

    test('leaves out the button without a board plugin item to create with', () => {
        renderAt(getState({menuItems: [makeCreateItem('other')]}));

        expect(screen.getByRole('heading', {name: 'Plan and track work with boards'})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Create a board'})).not.toBeInTheDocument();
    });

    test('leaves out the button for a user who cannot create channels', () => {
        renderAt(getState({menuItems: [makeCreateItem('boards')], canCreate: false}));

        expect(screen.queryByRole('button', {name: 'Create a board'})).not.toBeInTheDocument();
    });

    test('opens the first board once the user is in one', () => {
        const history = renderAt(getState({boardMember: true}));

        expect(history.location.pathname).toBe('/team-one/channels/roadmap');
    });

    test('goes back to the team when no plugin registers boards', () => {
        const history = renderAt(getState({kinds: []}));

        expect(history.location.pathname).toBe('/team-one');
    });
});
