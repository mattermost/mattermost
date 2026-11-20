// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import type {GlobalState} from 'types/store';
import type {SidebarChannelChildrenRegistration} from 'types/store/plugins';

import {
    clearLoggedSidebarChannelChildrenErrors,
    getSidebarChannelChildrenRegistrations,
    logSidebarChannelChildrenRenderError,
} from './sidebar_channel_children';

function makeChannel(partial: Partial<Channel> = {}): Channel {
    return {
        id: 'channel-1',
        type: 'D',
        delete_at: 0,
        ...partial,
    } as Channel;
}

function makeState(registrations?: SidebarChannelChildrenRegistration[]): GlobalState {
    return {
        plugins: {
            components: {
                SidebarChannelChildren: registrations,
            },
        },
    } as unknown as GlobalState;
}

function makeRegistration(partial: Partial<SidebarChannelChildrenRegistration> = {}): SidebarChannelChildrenRegistration {
    return {
        id: 'reg-1',
        pluginId: 'test-plugin',
        matcher: () => true,
        component: () => null,
        ...partial,
    };
}

function makeThrowingRegistration(pluginId = 'bad-plugin'): SidebarChannelChildrenRegistration {
    return makeRegistration({
        id: `${pluginId}-reg`,
        pluginId,
        matcher: () => {
            throw new Error('boom');
        },
    });
}

describe('selectors/getSidebarChannelChildrenRegistrations', () => {
    beforeEach(() => {
        clearLoggedSidebarChannelChildrenErrors();
    });

    it('returns the same empty array when there is nothing to render', () => {
        const none = getSidebarChannelChildrenRegistrations(makeState([]), makeChannel());

        expect(none).toEqual([]);
        expect(getSidebarChannelChildrenRegistrations(makeState(undefined), makeChannel())).toBe(none);
        expect(getSidebarChannelChildrenRegistrations(makeState([makeRegistration({matcher: () => false})]), makeChannel())).toBe(none);
    });

    it('does not call matchers when the channel is undefined', () => {
        const matcher = jest.fn(() => true);

        expect(getSidebarChannelChildrenRegistrations(makeState([makeRegistration({matcher})]), undefined)).toEqual([]);
        expect(matcher).not.toHaveBeenCalled();
    });

    it('passes the full state and the channel to the matcher', () => {
        const channel = makeChannel();
        const matcher = jest.fn(() => true);
        const state = makeState([makeRegistration({matcher})]);

        getSidebarChannelChildrenRegistrations(state, channel);

        expect(matcher).toHaveBeenCalledWith(state, channel);
    });

    it('returns every registration whose matcher returns exactly true, in order', () => {
        const first = makeRegistration({id: 'r1', pluginId: 'alpha'});
        const skipped = makeRegistration({id: 'r2', pluginId: 'beta', matcher: () => false});
        const truthy = makeRegistration({id: 'r3', pluginId: 'gamma', matcher: () => 1 as unknown as boolean});
        const last = makeRegistration({id: 'r4', pluginId: 'delta'});

        expect(getSidebarChannelChildrenRegistrations(makeState([first, skipped, truthy, last]), makeChannel())).toEqual([first, last]);
    });

    it('treats a throwing matcher as no-match and keeps the other registrations', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const good = makeRegistration({id: 'good', pluginId: 'good-plugin'});

        expect(getSidebarChannelChildrenRegistrations(makeState([makeThrowingRegistration(), good]), makeChannel())).toEqual([good]);

        consoleSpy.mockRestore();
    });

    it('logs a throwing matcher once per plugin until cleared', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const state = makeState([makeThrowingRegistration()]);
        const channel = makeChannel();

        getSidebarChannelChildrenRegistrations(state, channel);
        getSidebarChannelChildrenRegistrations(state, channel);
        expect(consoleSpy).toHaveBeenCalledTimes(1);

        clearLoggedSidebarChannelChildrenErrors('bad-plugin');
        getSidebarChannelChildrenRegistrations(state, channel);
        expect(consoleSpy).toHaveBeenCalledTimes(2);

        consoleSpy.mockRestore();
    });

    it('logs a throwing component once per plugin until cleared', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        logSidebarChannelChildrenRenderError('bad-plugin', new Error('boom'));
        logSidebarChannelChildrenRenderError('bad-plugin', new Error('boom'));
        expect(consoleSpy).toHaveBeenCalledTimes(1);

        clearLoggedSidebarChannelChildrenErrors('bad-plugin');
        logSidebarChannelChildrenRenderError('bad-plugin', new Error('boom'));
        expect(consoleSpy).toHaveBeenCalledTimes(2);

        consoleSpy.mockRestore();
    });
});
