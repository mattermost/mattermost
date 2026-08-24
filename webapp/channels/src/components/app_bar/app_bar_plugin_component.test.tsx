// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {Store} from 'redux';

import type {DeepPartial} from '@mattermost/types/utilities';

import {toggleRHSPlugin} from 'actions/views/rhs';
import {getIsRhsOpen, getPluggableId, getRhsState} from 'selectors/rhs';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {RHSStates} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';
import type {AppBarAction, ChannelHeaderButtonAction, RightHandSidebarComponent} from 'types/store/plugins';

import AppBarPluginComponent from './app_bar_plugin_component';

describe('components/app_bar/app_bar_plugin_component', () => {
    const pluginId = 'com.mattermost.test-plugin';
    const rhsComponentId = 'the_rhs_component_id';

    const channel = TestHelper.getChannelMock({id: 'channel1'});
    const channelMember = TestHelper.getChannelMembershipMock({channel_id: 'channel1', user_id: 'user1'});

    const rhsComponents: RightHandSidebarComponent[] = [{
        id: rhsComponentId,
        pluginId,
        component: () => null,
        title: 'Test Plugin',
    }];

    const inChannelState = {
        entities: {
            channels: {
                currentChannelId: channel.id,
                channels: {[channel.id]: channel},
                myMembers: {[channel.id]: channelMember},
            },
            users: {
                currentUserId: 'user1',
            },
        },
        views: {
            rhs: {
                pluggableId: '',
            },
        },
        plugins: {
            components: {
                RightHandSidebarComponent: rhsComponents,
            },
        },
    };

    // The Threads and Drafts views clear the current channel.
    const noChannelState = mergeObjects(inChannelState, {
        entities: {
            channels: {
                currentChannelId: '',
            },
        },
    });

    // Arriving in the Threads view from a channel showing pinned posts leaves the RHS suppressed.
    const suppressedRhsState = mergeObjects(noChannelState, {
        views: {
            rhs: {
                isSidebarOpen: true,
                rhsState: RHSStates.PIN,
            },
            rhsSuppressed: true,
        },
    });

    let store: Store;

    const channelHeaderButton: ChannelHeaderButtonAction = {
        id: 'the_channel_header_button_id',
        pluginId,
        icon: <i className='icon icon-test'/>,
        dropdownText: 'Test Plugin',
        tooltipText: 'Test Plugin',
        action: jest.fn(() => {
            store.dispatch(toggleRHSPlugin(rhsComponentId));
        }),
    };

    const appBarActionWithRhs: AppBarAction = {
        id: 'the_app_bar_action_id',
        pluginId,
        iconUrl: 'http://localhost:8065/plugins/com.mattermost.test-plugin/public/icon.svg',
        supportedProductIds: null,
        tooltipText: 'Test Plugin',
        rhsComponentId,
        action: jest.fn(() => {
            store.dispatch(toggleRHSPlugin(rhsComponentId));
            return {data: true};
        }),
    };

    const renderAppBarIcon = (component: ChannelHeaderButtonAction | AppBarAction, state: DeepPartial<GlobalState>) => {
        const rendered = renderWithContext(
            <AppBarPluginComponent component={component}/>,
            state,
        );
        store = rendered.store;
        return rendered;
    };

    const expectRhsToBeOpen = () => {
        expect(getIsRhsOpen(store.getState())).toBe(true);
        expect(getRhsState(store.getState())).toBe(RHSStates.PLUGIN);
        expect(getPluggableId(store.getState())).toBe(rhsComponentId);
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('plugin registered through registerChannelHeaderButtonAction', () => {
        test('should open the plugin RHS when clicked while viewing a channel', async () => {
            renderAppBarIcon(channelHeaderButton, inChannelState);

            await userEvent.click(screen.getByRole('button'));

            expectRhsToBeOpen();
            expect(channelHeaderButton.action).toHaveBeenCalledWith(channel, channelMember);
        });

        test('should open the plugin RHS when clicked with no channel in context', async () => {
            renderAppBarIcon(channelHeaderButton, noChannelState);

            await userEvent.click(screen.getByRole('button'));

            expectRhsToBeOpen();
            expect(channelHeaderButton.action).toHaveBeenCalledWith(undefined, undefined);
        });

        test('should open the plugin RHS when clicked while the RHS is suppressed', async () => {
            renderAppBarIcon(channelHeaderButton, suppressedRhsState);

            expect(getIsRhsOpen(store.getState())).toBe(false);

            await userEvent.click(screen.getByRole('button'));

            expectRhsToBeOpen();
        });

        test('should highlight the icon while its RHS is open and stop highlighting it once closed', async () => {
            renderAppBarIcon(channelHeaderButton, noChannelState);

            expect(screen.getByRole('button')).not.toHaveClass('app-bar__old-icon--active');

            await userEvent.click(screen.getByRole('button'));

            expectRhsToBeOpen();
            expect(screen.getByRole('button')).toHaveClass('app-bar__old-icon--active');

            await userEvent.click(screen.getByRole('button'));

            expect(getIsRhsOpen(store.getState())).toBe(false);
            expect(getPluggableId(store.getState())).toBe('');
            expect(screen.getByRole('button')).not.toHaveClass('app-bar__old-icon--active');
        });
    });

    describe('plugin registered through registerAppBarComponent', () => {
        test('should open the plugin RHS when clicked while viewing a channel', async () => {
            renderAppBarIcon(appBarActionWithRhs, inChannelState);

            await userEvent.click(screen.getByRole('button'));

            expectRhsToBeOpen();
            expect(screen.getByRole('button').closest('.app-bar__icon')).toHaveClass('app-bar__icon--active');

            // An action with an rhsComponentId is called without any channel context.
            expect(appBarActionWithRhs.action).toHaveBeenCalledWith();
        });

        test('should open the plugin RHS when clicked with no channel in context', async () => {
            renderAppBarIcon(appBarActionWithRhs, noChannelState);

            await userEvent.click(screen.getByRole('button'));

            expectRhsToBeOpen();
            expect(appBarActionWithRhs.action).toHaveBeenCalledWith();
        });
    });
});
