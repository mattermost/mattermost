// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {AnyAction} from 'redux';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {ActionTypes, ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import {SwitchProductMenu} from './switch_product_menu';

describe('SwitchProductMenu', () => {
    const initialState: DeepPartial<GlobalState> = {
        entities: {
            general: {
                config: {},
                license: TestHelper.getLicenseMock({
                    IsLicensed: 'true',
                    SkuShortName: 'professional',
                }),
            },
            users: {
                currentUserId: 'user_id',
                profiles: {
                    user_id: TestHelper.getUserMock({id: 'user_id'}),
                },
            },
            teams: {
                currentTeamId: 'team_id',
                teams: {
                    team_id: TestHelper.getTeamMock({id: 'team_id'}),
                },
            },
        },
    };

    test('should label the menu button as opening the product menu', () => {
        renderWithContext(<SwitchProductMenu productId={null}/>, initialState);

        expect(screen.getByRole('button', {name: 'Open product menu'})).toBeInTheDocument();
    });

    test('should render the product name inside the menu button so clicking it opens the menu', () => {
        renderWithContext(<SwitchProductMenu productId={null}/>, initialState);

        const menuButton = screen.getByRole('button', {name: 'Open product menu'});

        expect(menuButton).toHaveTextContent('Channels');
    });

    test('should open the menu when the product name is clicked', async () => {
        renderWithContext(<SwitchProductMenu productId={null}/>, initialState);

        expect(screen.queryByRole('menu', {name: 'Product menu'})).not.toBeInTheDocument();

        await userEvent.click(screen.getByText('Channels'));

        expect(screen.getByRole('menu', {name: 'Product menu'})).toBeInTheDocument();
    });

    test('should run a menu item action when it is selected from the open menu', async () => {
        const {store} = renderWithContext(
            <SwitchProductMenu productId={null}/>,
            initialState,
            {useMockedStore: true},
        );

        await userEvent.click(screen.getByRole('button', {name: 'Open product menu'}));

        await userEvent.click(screen.getByText('About Mattermost'));

        // The menu defers item actions until its close animation finishes.
        await waitFor(() => {
            const openedAboutModal = (store as any).getActions().some((action: AnyAction) => {
                return action.type === ActionTypes.MODAL_OPEN && action.modalId === ModalIdentifiers.ABOUT;
            });

            expect(openedAboutModal).toBe(true);
        });
    });

    test('should leave Channels to the product rail while it shows', async () => {
        renderWithContext(
            <SwitchProductMenu productId={null}/>,
            {...initialState, entities: {...initialState.entities, general: {...initialState.entities!.general, config: {FeatureFlagProductRail: 'true'}}}},
        );

        await userEvent.click(screen.getByRole('button', {name: 'Open product menu'}));

        expect(screen.queryByRole('menuitem', {name: 'Channels'})).not.toBeInTheDocument();
    });

    test('should keep Channels when the product rail has no team to show', async () => {
        renderWithContext(
            <SwitchProductMenu productId={null}/>,
            {
                ...initialState,
                entities: {
                    ...initialState.entities,
                    general: {...initialState.entities!.general, config: {FeatureFlagProductRail: 'true'}},
                    teams: {currentTeamId: '', teams: {}},
                },
            },
        );

        await userEvent.click(screen.getByRole('button', {name: 'Open product menu'}));

        expect(screen.getByRole('menuitem', {name: 'Channels'})).toBeInTheDocument();
    });

    describe('with boards split from channels', () => {
        const board = TestHelper.getChannelMock({id: 'board_id', name: 'roadmap', team_id: 'team_id'});
        const withBoards = (section: 'channels' | 'boards', config: Record<string, string> = {}): DeepPartial<GlobalState> => ({
            ...initialState,
            entities: {
                ...initialState.entities,
                general: {...initialState.entities!.general, config},
                teams: {currentTeamId: 'team_id', teams: {team_id: TestHelper.getTeamMock({id: 'team_id', name: 'team'})}},
                channels: {channels: {board_id: board}, myMembers: {board_id: TestHelper.getChannelMembershipMock({channel_id: 'board_id'})}},
            },
            plugins: {components: {Product: [], ProductSwitcherMenuItem: [], ChannelKind: [{id: 'kind', pluginId: 'boards', kind: 'board', matcher: (_: unknown, channel: {id: string}) => channel.id === 'board_id'}]}} as unknown as DeepPartial<GlobalState['plugins']>,
            views: {productRail: {section, lastPathByTeam: {}, lastPathsLoaded: true}, browser: {windowSize: 'desktopView'}} as DeepPartial<GlobalState['views']>,
        });
        const isChecked = (name: string) => screen.getByRole('menuitem', {name}).querySelector('.trailing-elements') !== null;

        test('should list Boards after Channels, and check Channels while the sidebar shows channels', async () => {
            renderWithContext(<SwitchProductMenu productId={null}/>, withBoards('channels'));

            await userEvent.click(screen.getByRole('button', {name: 'Open product menu'}));

            const names = screen.getAllByRole('menuitem').map((item) => item.textContent);
            expect(names.slice(0, 2)).toEqual(['Channels', 'Boards']);
            expect(isChecked('Channels')).toBe(true);
            expect(isChecked('Boards')).toBe(false);
        });

        test('should check Boards, and not Channels, while the sidebar shows boards', async () => {
            renderWithContext(<SwitchProductMenu productId={null}/>, withBoards('boards'));

            await userEvent.click(screen.getByRole('button', {name: 'Open product menu'}));

            expect(isChecked('Boards')).toBe(true);
            expect(isChecked('Channels')).toBe(false);
        });

        test('should switch the sidebar to boards and open the first board when Boards is chosen', async () => {
            const {store} = renderWithContext(<SwitchProductMenu productId={null}/>, withBoards('channels'), {useMockedStore: true});

            await userEvent.click(screen.getByRole('button', {name: 'Open product menu'}));
            await userEvent.click(screen.getByRole('menuitem', {name: 'Boards'}));

            await waitFor(() => {
                expect((store as unknown as {getActions: () => AnyAction[]}).getActions()).toContainEqual({type: ActionTypes.SET_PRODUCT_RAIL_SECTION, data: {section: 'boards'}});
            });
        });

        test('should leave Boards to the product rail while it shows', async () => {
            renderWithContext(<SwitchProductMenu productId={null}/>, withBoards('channels', {FeatureFlagProductRail: 'true'}));

            await userEvent.click(screen.getByRole('button', {name: 'Open product menu'}));

            expect(screen.queryByRole('menuitem', {name: 'Boards'})).not.toBeInTheDocument();
        });

        test('should not list Boards when no plugin registers boards', async () => {
            renderWithContext(<SwitchProductMenu productId={null}/>, initialState);

            await userEvent.click(screen.getByRole('button', {name: 'Open product menu'}));

            expect(screen.queryByRole('menuitem', {name: 'Boards'})).not.toBeInTheDocument();
        });
    });
});
