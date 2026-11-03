// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import type {GlobalState} from 'types/store';
import type {ChannelViewRegistration} from 'types/store/plugins';

import {clearLoggedChannelViewErrors, getChannelViewPluginComponent} from './channel_view_plugin';

function makeChannel(partial: Partial<Channel> = {}): Channel {
    return {
        id: 'channel-1',
        type: 'O',
        delete_at: 0,
        ...partial,
    } as Channel;
}

function makeState(regs?: ChannelViewRegistration[]): GlobalState {
    return {
        plugins: {
            components: {
                ChannelView: regs,
            },
        },
    } as unknown as GlobalState;
}

function makeRegistration(partial: Partial<ChannelViewRegistration> = {}): ChannelViewRegistration {
    return {
        id: 'reg-1',
        pluginId: 'test-plugin',
        matcher: () => true,
        component: () => null,
        ...partial,
    };
}

function makeThrowingRegistration(pluginId = 'bad-plugin'): ChannelViewRegistration {
    return makeRegistration({
        pluginId,
        matcher: () => {
            throw new Error('boom');
        },
    });
}

describe('selectors/getChannelViewPluginComponent', () => {
    beforeEach(() => {
        clearLoggedChannelViewErrors();
    });

    it('returns null when there are no registrations', () => {
        expect(getChannelViewPluginComponent(makeState([]), makeChannel())).toBeNull();
        expect(getChannelViewPluginComponent(makeState(undefined), makeChannel())).toBeNull();
    });

    it('returns null when channel is undefined without calling matchers', () => {
        const matcher = jest.fn(() => true);
        expect(getChannelViewPluginComponent(makeState([makeRegistration({matcher})]), undefined)).toBeNull();
        expect(matcher).not.toHaveBeenCalled();
    });

    it('returns the registration when matcher returns exactly true', () => {
        const reg = makeRegistration();
        expect(getChannelViewPluginComponent(makeState([reg]), makeChannel())).toBe(reg);
    });

    it('returns null when matcher returns false or a truthy non-boolean', () => {
        const channel = makeChannel();
        expect(getChannelViewPluginComponent(makeState([makeRegistration({matcher: () => false})]), channel)).toBeNull();
        expect(getChannelViewPluginComponent(makeState([makeRegistration({matcher: () => 1 as unknown as boolean})]), channel)).toBeNull();
    });

    it('passes the full state and the channel to the matcher', () => {
        const channel = makeChannel();
        const matcher = jest.fn(() => true);
        const state = makeState([makeRegistration({matcher})]);
        getChannelViewPluginComponent(state, channel);
        expect(matcher).toHaveBeenCalledWith(state, channel);
    });

    it('returns the first matching registration in reducer order', () => {
        const alpha = makeRegistration({id: 'r1', pluginId: 'alpha'});
        const beta = makeRegistration({id: 'r2', pluginId: 'beta'});
        expect(getChannelViewPluginComponent(makeState([alpha, beta]), makeChannel())).toBe(alpha);
    });

    it('treats a throwing matcher as no-match and continues to later registrations', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const good = makeRegistration({id: 'good', pluginId: 'good-plugin'});
        const channel = makeChannel();

        expect(getChannelViewPluginComponent(makeState([makeThrowingRegistration()]), channel)).toBeNull();
        expect(getChannelViewPluginComponent(makeState([makeThrowingRegistration(), good]), channel)).toBe(good);
        consoleSpy.mockRestore();
    });

    it('logs a throwing matcher once per plugin until cleared', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const state = makeState([makeThrowingRegistration()]);
        const channel = makeChannel();

        getChannelViewPluginComponent(state, channel);
        getChannelViewPluginComponent(state, channel);
        expect(consoleSpy).toHaveBeenCalledTimes(1);

        clearLoggedChannelViewErrors('bad-plugin');
        getChannelViewPluginComponent(state, channel);
        expect(consoleSpy).toHaveBeenCalledTimes(2);

        consoleSpy.mockRestore();
    });
});
