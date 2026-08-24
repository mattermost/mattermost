// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {Store} from 'redux';

import {toggleRHSPlugin} from 'actions/views/rhs';
import {getIsRhsOpen, getPluggableId, getRhsState} from 'selectors/rhs';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {RHSStates} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {AppBarAction, ChannelHeaderButtonAction} from 'types/store/plugins';

import AppBarPluginComponent from './app_bar_plugin_component';

describe('components/app_bar/app_bar_plugin_component', () => {
    const pluginId = 'com.mattermost.test-plugin';
    const rhsComponentId = 'the_rhs_component_id';

    const channel = TestHelper.getChannelMock({id: 'channel1'});
    const channelMember = TestHelper.getChannelMembershipMock({channel_id: 'channel1', user_id: 'user1'});

    // State while viewing a channel.
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
                RightHandSidebarComponent: [{
                    id: rhsComponentId,
                    pluginId,
                    component: () => null,
                    title: 'Test Plugin',
                }],
            },
        },
    };

    // The Threads and Drafts views clear the current channel, so nothing is in context there.
    const noChannelState = mergeObjects(inChannelState, {
        entities: {
            channels: {
                currentChannelId: '',
            },
        },
    });

    let store: Store;

    // Mirrors what plugins do in their action: toggle their own registered RHS component.
    const toggleRhs = jest.fn(() => {
        store.dispatch(toggleRHSPlugin(rhsComponentId));
    });

    const channelHeaderButton: ChannelHeaderButtonAction = {
        id: 'the_channel_header_button_id',
        pluginId,
        icon: <i className='icon icon-test'/>,
        dropdownText: 'Test Plugin',
        tooltipText: 'Test Plugin',
        action: toggleRhs,
    };

    const appBarActionWithRhs = {
        id: 'the_app_bar_action_id',
        pluginId,
        iconUrl: '',
        supportedProductIds: null,
        tooltipText: 'Test Plugin',
        rhsComponentId,
        action: toggleRhs,
    } as unknown as AppBarAction;

    const renderAppBarIcon = (component: ChannelHeaderButtonAction | AppBarAction, state: typeof inChannelState) => {
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
        toggleRhs.mockClear();
    });

    describe('plugin registered through registerChannelHeaderButtonAction', () => {
        test('should open the plugin RHS when clicked while viewing a channel', async () => {
            renderAppBarIcon(channelHeaderButton, inChannelState);

            await userEvent.click(screen.getByRole('button'));

            expectRhsToBeOpen();
            expect(toggleRhs).toHaveBeenCalledWith(channel, channelMember);
        });

        test('should open the plugin RHS when clicked with no channel in context', async () => {
            renderAppBarIcon(channelHeaderButton, noChannelState);

            await userEvent.click(screen.getByRole('button'));

            expectRhsToBeOpen();
            expect(toggleRhs).toHaveBeenCalledTimes(1);
        });

        test('should close the plugin RHS when clicked again with no channel in context', async () => {
            renderAppBarIcon(channelHeaderButton, noChannelState);

            await userEvent.click(screen.getByRole('button'));
            expectRhsToBeOpen();

            await userEvent.click(screen.getByRole('button'));

            expect(getIsRhsOpen(store.getState())).toBe(false);
            expect(getPluggableId(store.getState())).toBe('');
        });
    });

    describe('plugin registered through registerAppBarComponent', () => {
        test('should open the plugin RHS when clicked while viewing a channel', async () => {
            renderAppBarIcon(appBarActionWithRhs, inChannelState);

            await userEvent.click(screen.getByRole('button'));

            expectRhsToBeOpen();

            // The registry wires this action to a toggler which takes no channel context.
            expect(toggleRhs).toHaveBeenCalledWith();
        });

        test('should open the plugin RHS when clicked with no channel in context', async () => {
            renderAppBarIcon(appBarActionWithRhs, noChannelState);

            await userEvent.click(screen.getByRole('button'));

            expectRhsToBeOpen();
            expect(toggleRhs).toHaveBeenCalledWith();
        });
    });
});
