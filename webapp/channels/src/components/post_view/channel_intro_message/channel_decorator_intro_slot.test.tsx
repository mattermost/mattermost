// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

jest.mock('components/post_view/channel_intro_message', () => {
    return () => <div data-testid='channel-intro-message'/>;
});

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {ChannelIntroOverrideComponent} from 'types/store/plugins';

import ChannelDecoratorIntroSlot, {clearLoggedDecoratorErrors, getMatchingChannelIntroOverrideComponent} from './channel_decorator_intro_slot';

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
            ChannelIntroOverride: decorators,
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
        expect(screen.queryByTestId(/^decorator-content-/)).not.toBeInTheDocument();
    });

    test('intro decorator, matcher returns true — renders plugin component, not ChannelIntroMessage', () => {
        const state = makeStateWithChannel(channelId, [{
            id: 'intro-dec',
            pluginId: 'test-plugin',
            slot: 'intro',
            matcher: () => true,
            component: () => <div data-testid='decorator-content-intro'/>,
        }]);

        renderWithContext(
            <ChannelDecoratorIntroSlot channelId={channelId}/>,
            state,
        );

        expect(screen.getByTestId('decorator-content-intro')).toBeInTheDocument();
        expect(screen.queryByTestId('channel-intro-message')).not.toBeInTheDocument();
    });

    test('intro decorator, matcher returns false — renders ChannelIntroMessage', () => {
        const state = makeStateWithChannel(channelId, [{
            id: 'intro-dec',
            pluginId: 'test-plugin',
            slot: 'intro',
            matcher: () => false,
            component: () => <div data-testid='decorator-content-intro'/>,
        }]);

        renderWithContext(
            <ChannelDecoratorIntroSlot channelId={channelId}/>,
            state,
        );

        expect(screen.getByTestId('channel-intro-message')).toBeInTheDocument();
        expect(screen.queryByTestId('decorator-content-intro')).not.toBeInTheDocument();
    });

    test('intro decorator match with missing channel entity — renders ChannelIntroMessage', () => {
        const state = makeStateWithChannel(channelId, [{
            id: 'intro-dec',
            pluginId: 'test-plugin',
            slot: 'intro',
            matcher: () => true,
            component: () => <div data-testid='decorator-content-intro'/>,
        }]);

        // Remove the channel from state to simulate the stale-selector race window
        delete state.entities.channels.channels[channelId];

        renderWithContext(
            <ChannelDecoratorIntroSlot channelId={channelId}/>,
            state,
        );

        expect(screen.getByTestId('channel-intro-message')).toBeInTheDocument();
        expect(screen.queryByTestId('decorator-content-intro')).not.toBeInTheDocument();
    });

    test('multiple intro decorators — only the first (array-order) renders', () => {
        // The selector enforces first-match-wins for the intro slot; the array is ordered
        // alphabetically by pluginId by the reducer. This test verifies the slot component
        // surfaces only one decorator and ignores subsequent registrations.
        const state = makeStateWithChannel(channelId, [
            {
                id: 'intro-alpha',
                pluginId: 'alpha-plugin',
                slot: 'intro',
                matcher: () => true,
                component: () => <div data-testid='decorator-content-alpha'/>,
            },
            {
                id: 'intro-beta',
                pluginId: 'beta-plugin',
                slot: 'intro',
                matcher: () => true,
                component: () => <div data-testid='decorator-content-beta'/>,
            },
        ]);

        renderWithContext(
            <ChannelDecoratorIntroSlot channelId={channelId}/>,
            state,
        );

        expect(screen.getByTestId('decorator-content-alpha')).toBeInTheDocument();
        expect(screen.queryByTestId('decorator-content-beta')).not.toBeInTheDocument();
        expect(screen.queryByTestId('channel-intro-message')).not.toBeInTheDocument();
    });
});

function makeRegistration(partial: Partial<ChannelIntroOverrideComponent> = {}): ChannelIntroOverrideComponent {
    return {
        id: 'reg-1',
        pluginId: 'test-plugin',
        slot: 'after_channel_name',
        matcher: () => true,
        component: () => null,
        ...partial,
    } as ChannelIntroOverrideComponent;
}

describe('getMatchingChannelIntroOverrideComponent', () => {
    beforeEach(() => {
        clearLoggedDecoratorErrors();
    });

    it('returns undefined when channelId is empty', () => {
        const result = getMatchingChannelIntroOverrideComponent(
            {plugins: {components: {ChannelIntroOverride: []}}} as any,
            '',
        );
        expect(result).toEqual(undefined);
    });

    it('returns undefined when no decorators are registered', () => {
        const channel = TestHelper.getChannelMock();
        const result = getMatchingChannelIntroOverrideComponent(
            {
                plugins: {components: {ChannelIntroOverride: []}},
                entities: {channels: {channels: {[channel.id]: channel}}},
            } as any,
            channel.id,
        );
        expect(result).toEqual(undefined);
    });

    it('returns at most one entry for intro slot (first-match-wins)', () => {
        const channel = TestHelper.getChannelMock();
        const reg1 = makeRegistration({id: 'r1', pluginId: 'alpha'});
        const reg2 = makeRegistration({id: 'r2', pluginId: 'beta'});
        const result = getMatchingChannelIntroOverrideComponent(
            {
                plugins: {components: {ChannelIntroOverride: [reg1, reg2]}},
                entities: {channels: {channels: {[channel.id]: channel}}},
            } as any,
            channel.id,
        );
        expect(result).toBe(reg1.id);
    });
});
