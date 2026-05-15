// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

jest.mock('components/post_view/channel_intro_message', () => {
    return () => <div data-testid='channel-intro-message'/>;
});

jest.mock('components/channel_decorator_renderer/channel_decorator_renderer', () => {
    return ({registration}: {registration: {id: string}}) => (
        <div data-testid={`decorator-${registration.id}`}/>
    );
});

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelDecoratorIntroSlot from './channel_decorator_intro_slot';

const makeStateWithChannel = (channelId: string, decorators: any[] = []) => ({
    entities: {
        channels: {
            channels: {
                [channelId]: TestHelper.getChannelMock({id: channelId}),
            },
        },
    },
    plugins: {
        components: {
            ChannelDecorator: decorators,
        },
    },
} as any);

describe('components/post_view/ChannelDecoratorIntroSlot', () => {
    const channelId = 'channel_id';

    test('no intro decorator — renders ChannelIntroMessage', () => {
        renderWithContext(
            <ChannelDecoratorIntroSlot channelId={channelId}/>,
            makeStateWithChannel(channelId, []),
        );

        expect(screen.getByTestId('channel-intro-message')).toBeInTheDocument();
        expect(screen.queryByTestId(/^decorator-/)).not.toBeInTheDocument();
    });

    test('intro decorator, matcher returns true — renders plugin component, not ChannelIntroMessage', () => {
        const state = makeStateWithChannel(channelId, [{
            id: 'intro-dec',
            pluginId: 'test-plugin',
            slot: 'intro',
            matcher: () => true,
            component: () => null,
        }]);

        renderWithContext(
            <ChannelDecoratorIntroSlot channelId={channelId}/>,
            state,
        );

        expect(screen.getByTestId('decorator-intro-dec')).toBeInTheDocument();
        expect(screen.queryByTestId('channel-intro-message')).not.toBeInTheDocument();
    });

    test('intro decorator, matcher returns false — renders ChannelIntroMessage', () => {
        const state = makeStateWithChannel(channelId, [{
            id: 'intro-dec',
            pluginId: 'test-plugin',
            slot: 'intro',
            matcher: () => false,
            component: () => null,
        }]);

        renderWithContext(
            <ChannelDecoratorIntroSlot channelId={channelId}/>,
            state,
        );

        expect(screen.getByTestId('channel-intro-message')).toBeInTheDocument();
        expect(screen.queryByTestId('decorator-intro-dec')).not.toBeInTheDocument();
    });

    test('intro decorator match with missing channel entity — renders ChannelIntroMessage', () => {
        const state = makeStateWithChannel(channelId, [{
            id: 'intro-dec',
            pluginId: 'test-plugin',
            slot: 'intro',
            matcher: () => true,
            component: () => null,
        }]);

        // Remove the channel from state to simulate the stale-selector race window
        delete state.entities.channels.channels[channelId];

        renderWithContext(
            <ChannelDecoratorIntroSlot channelId={channelId}/>,
            state,
        );

        expect(screen.getByTestId('channel-intro-message')).toBeInTheDocument();
        expect(screen.queryByTestId('decorator-intro-dec')).not.toBeInTheDocument();
    });

    test('multiple intro decorators — only the first (array-order) renders', () => {
        // The selector enforces first-match-wins for the intro slot; the array is ordered
        // alphabetically by pluginId by the reducer. This test verifies the slot component
        // surfaces only one decorator and ignores subsequent registrations.
        const state = makeStateWithChannel(channelId, [
            {id: 'intro-alpha', pluginId: 'alpha-plugin', slot: 'intro', matcher: () => true, component: () => null},
            {id: 'intro-beta', pluginId: 'beta-plugin', slot: 'intro', matcher: () => true, component: () => null},
        ]);

        renderWithContext(
            <ChannelDecoratorIntroSlot channelId={channelId}/>,
            state,
        );

        expect(screen.getByTestId('decorator-intro-alpha')).toBeInTheDocument();
        expect(screen.queryByTestId('decorator-intro-beta')).not.toBeInTheDocument();
        expect(screen.queryByTestId('channel-intro-message')).not.toBeInTheDocument();
    });
});
