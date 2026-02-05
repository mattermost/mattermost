// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import GuildedTeamSidebar from '../index';

const mockStore = configureStore([]);

// Mock the child components to avoid selector issues
jest.mock('../dm_button', () => ({onClick}: {onClick: () => void}) => (
    <button aria-label="Direct Messages" onClick={onClick}>DM</button>
));
jest.mock('../unread_dm_avatars', () => () => <div className="unread-dm-avatars" />);
jest.mock('../favorited_teams', () => ({onTeamClick, onExpandClick}: any) => (
    <div className="favorited-teams">
        <button onClick={onExpandClick}>Expand</button>
    </div>
));
jest.mock('../team_list', () => () => <div className="team-list" />);
jest.mock('../expanded_overlay', () => ({onClose}: any) => (
    <div className="expanded-overlay">
        <button onClick={onClose}>Close</button>
    </div>
));

describe('GuildedTeamSidebar', () => {
    const defaultState = {
        views: {
            guildedLayout: {
                isTeamSidebarExpanded: false,
                isDmMode: false,
                favoritedTeamIds: [],
            },
        },
        entities: {
            teams: {
                teams: {},
                myMembers: {},
                currentTeamId: 'team1',
            },
            channels: {
                channels: {},
                myMembers: {},
            },
            users: {
                profiles: {},
                statuses: {},
            },
            general: {
                config: {},
            },
        },
    };

    it('renders the collapsed sidebar container', () => {
        const store = mockStore(defaultState);

        const {container} = render(
            <Provider store={store}>
                <GuildedTeamSidebar />
            </Provider>
        );

        expect(container.querySelector('.guilded-team-sidebar')).toBeInTheDocument();
        expect(container.querySelector('.guilded-team-sidebar__collapsed')).toBeInTheDocument();
    });

    it('has team-sidebar class for CSS Grid positioning', () => {
        const store = mockStore(defaultState);

        const {container} = render(
            <Provider store={store}>
                <GuildedTeamSidebar />
            </Provider>
        );

        // Must have team-sidebar class to be positioned correctly in the app grid layout
        expect(container.querySelector('.team-sidebar')).toBeInTheDocument();
    });

    it('renders DM button', () => {
        const store = mockStore(defaultState);

        render(
            <Provider store={store}>
                <GuildedTeamSidebar />
            </Provider>
        );

        expect(screen.getByRole('button', {name: /direct messages/i})).toBeInTheDocument();
    });

    it('renders at least one divider (after DM section)', () => {
        const store = mockStore(defaultState);

        const {container} = render(
            <Provider store={store}>
                <GuildedTeamSidebar />
            </Provider>
        );

        const dividers = container.querySelectorAll('.guilded-team-sidebar__divider');
        // At minimum, there's one divider after DM button section
        // Second divider only renders when there are favorited teams
        expect(dividers.length).toBeGreaterThanOrEqual(1);
    });

    it('renders two dividers when there are favorited teams', () => {
        const stateWithFavorites = {
            ...defaultState,
            views: {
                ...defaultState.views,
                guildedLayout: {
                    ...defaultState.views.guildedLayout,
                    favoritedTeamIds: ['team1'],
                },
            },
        };
        const store = mockStore(stateWithFavorites);

        const {container} = render(
            <Provider store={store}>
                <GuildedTeamSidebar />
            </Provider>
        );

        const dividers = container.querySelectorAll('.guilded-team-sidebar__divider');
        expect(dividers.length).toBe(2);
    });

    it('shows expanded overlay when isTeamSidebarExpanded is true', () => {
        const expandedState = {
            ...defaultState,
            views: {
                ...defaultState.views,
                guildedLayout: {
                    ...defaultState.views.guildedLayout,
                    isTeamSidebarExpanded: true,
                },
            },
        };
        const store = mockStore(expandedState);

        const {container} = render(
            <Provider store={store}>
                <GuildedTeamSidebar />
            </Provider>
        );

        expect(container.querySelector('.expanded-overlay')).toBeInTheDocument();
    });

    it('does not show expanded overlay when collapsed', () => {
        const store = mockStore(defaultState);

        const {container} = render(
            <Provider store={store}>
                <GuildedTeamSidebar />
            </Provider>
        );

        expect(container.querySelector('.expanded-overlay')).not.toBeInTheDocument();
    });

    it('dispatches setDmMode when DM button clicked', () => {
        const store = mockStore(defaultState);

        render(
            <Provider store={store}>
                <GuildedTeamSidebar />
            </Provider>
        );

        const dmButton = screen.getByRole('button', {name: /direct messages/i});
        fireEvent.click(dmButton);

        const actions = store.getActions();
        expect(actions).toContainEqual(expect.objectContaining({
            type: 'GUILDED_SET_DM_MODE',
            isDmMode: true,
        }));
    });
});
