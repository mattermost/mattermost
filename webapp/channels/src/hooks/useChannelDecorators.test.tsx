// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import {clearLoggedDecoratorErrors} from 'selectors/channel_decorator';

import {renderHookWithContext} from 'tests/react_testing_utils';

import type {ChannelDecoratorRegistration} from 'types/store/plugins';

import {useChannelDecorators} from './useChannelDecorators';

function makeChannel(partial: Partial<Channel> = {}): Channel {
    return {
        id: 'channel-1',
        type: 'O',
        delete_at: 0,
        ...partial,
    } as Channel;
}

function makeRegistration(partial: Partial<ChannelDecoratorRegistration> = {}): ChannelDecoratorRegistration {
    return {
        id: 'reg-1',
        pluginId: 'test-plugin',
        slot: 'left_of_channel_name',
        matcher: () => true,
        component: () => null,
        ...partial,
    } as ChannelDecoratorRegistration;
}

describe('hooks/useChannelDecorators', () => {
    beforeEach(() => {
        clearLoggedDecoratorErrors();
    });

    it('returns empty array when channelId is null', () => {
        const {result} = renderHookWithContext(
            () => useChannelDecorators(null, 'left_of_channel_name'),
            {plugins: {components: {ChannelDecorator: []}}} as any,
        );
        expect(result.current).toEqual([]);
    });

    it('returns empty array when channelId is undefined', () => {
        const {result} = renderHookWithContext(
            () => useChannelDecorators(undefined, 'intro'),
            {plugins: {components: {ChannelDecorator: []}}} as any,
        );
        expect(result.current).toEqual([]);
    });

    it('returns empty array when no decorators are registered', () => {
        const channel = makeChannel();
        const {result} = renderHookWithContext(
            () => useChannelDecorators(channel.id, 'above_composer'),
            {
                plugins: {components: {ChannelDecorator: []}},
                entities: {channels: {channels: {[channel.id]: channel}}},
            } as any,
        );
        expect(result.current).toEqual([]);
    });

    it('returns selector output for a matching registration', () => {
        const channel = makeChannel();
        const reg = makeRegistration({slot: 'left_of_channel_name'});
        const {result} = renderHookWithContext(
            () => useChannelDecorators(channel.id, 'left_of_channel_name'),
            {
                plugins: {components: {ChannelDecorator: [reg]}},
                entities: {channels: {channels: {[channel.id]: channel}}},
            } as any,
        );
        expect(result.current).toHaveLength(1);
        expect(result.current[0]).toBe(reg);
    });

    it('returns at most one entry for intro slot (first-match-wins)', () => {
        const channel = makeChannel();
        const reg1 = makeRegistration({id: 'r1', slot: 'intro', pluginId: 'alpha'});
        const reg2 = makeRegistration({id: 'r2', slot: 'intro', pluginId: 'beta'});
        const {result} = renderHookWithContext(
            () => useChannelDecorators(channel.id, 'intro'),
            {
                plugins: {components: {ChannelDecorator: [reg1, reg2]}},
                entities: {channels: {channels: {[channel.id]: channel}}},
            } as any,
        );
        expect(result.current).toHaveLength(1);
        expect(result.current[0]).toBe(reg1);
    });

    it('returns all matching registrations for additive slots', () => {
        const channel = makeChannel();
        const reg1 = makeRegistration({id: 'r1', slot: 'mount_overlay', pluginId: 'plugin-a'});
        const reg2 = makeRegistration({id: 'r2', slot: 'mount_overlay', pluginId: 'plugin-b'});
        const {result} = renderHookWithContext(
            () => useChannelDecorators(channel.id, 'mount_overlay'),
            {
                plugins: {components: {ChannelDecorator: [reg1, reg2]}},
                entities: {channels: {channels: {[channel.id]: channel}}},
            } as any,
        );
        expect(result.current).toHaveLength(2);
    });
});
