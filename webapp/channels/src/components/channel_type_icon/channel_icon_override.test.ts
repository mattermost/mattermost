// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import type {GlobalState} from 'types/store';
import type {ChannelIconOverrideRegistration} from 'types/store/plugins';

import {clearLoggedMatcherErrors, getChannelIconClassNameForChannel, getChannelIconOverrideForChannel} from './channel_icon_override';

function makeState(overrides: ChannelIconOverrideRegistration[] = []): GlobalState {
    return {
        plugins: {
            components: {
                ChannelIconOverride: overrides,
            },
        },
    } as unknown as GlobalState;
}

function makeChannel(partial: Partial<Channel> = {}): Channel {
    return {
        id: 'channel-1',
        type: 'O',
        delete_at: 0,
        ...partial,
    } as Channel;
}

describe('selectors/getChannelIconClassNameForChannel', () => {
    beforeEach(() => {
        clearLoggedMatcherErrors();
    });

    describe('no overrides — fallback behavior', () => {
        it('returns icon-globe for an open channel', () => {
            const state = makeState();
            const channel = makeChannel({type: 'O'});
            expect(getChannelIconClassNameForChannel(state, channel)).toBe('icon-globe');
        });

        it('returns icon-lock-outline for a private channel', () => {
            const state = makeState();
            const channel = makeChannel({type: 'P'});
            expect(getChannelIconClassNameForChannel(state, channel)).toBe('icon-lock-outline');
        });

        it('returns icon-archive-outline for an archived open channel', () => {
            const state = makeState();
            const channel = makeChannel({type: 'O', delete_at: 1234});
            expect(getChannelIconClassNameForChannel(state, channel)).toBe('icon-archive-outline');
        });

        it('returns icon-archive-lock-outline for an archived private channel', () => {
            const state = makeState();
            const channel = makeChannel({type: 'P', delete_at: 1234});
            expect(getChannelIconClassNameForChannel(state, channel)).toBe('icon-archive-lock-outline');
        });

        it('returns icon-globe when channel is undefined', () => {
            const state = makeState();
            expect(getChannelIconClassNameForChannel(state, undefined)).toBe('icon-globe');
        });
    });

    describe('with overrides', () => {
        it('returns the first matching plugin icon class', () => {
            const matcher = jest.fn().mockReturnValue(true);
            const state = makeState([
                {id: '1', pluginId: 'mbe', matcher, iconName: 'shield-outline'},
            ]);
            const channel = makeChannel();
            expect(getChannelIconClassNameForChannel(state, channel)).toBe('icon-shield-outline');
            expect(matcher).toHaveBeenCalledWith(state, channel);
        });

        it('uses array order for first-match-wins when multiple match', () => {
            const state = makeState([
                {id: '1', pluginId: 'aaa', matcher: () => true, iconName: 'shield-outline'},
                {id: '2', pluginId: 'bbb', matcher: () => true, iconName: 'lock-outline'},
            ]);
            expect(getChannelIconClassNameForChannel(state, makeChannel())).toBe('icon-shield-outline');
        });

        it('falls through to second matcher when first returns false', () => {
            const state = makeState([
                {id: '1', pluginId: 'aaa', matcher: () => false, iconName: 'shield-outline'},
                {id: '2', pluginId: 'bbb', matcher: () => true, iconName: 'lock-outline'},
            ]);
            expect(getChannelIconClassNameForChannel(state, makeChannel())).toBe('icon-lock-outline');
        });

        it('falls back to core icon when no matcher returns true', () => {
            const state = makeState([
                {id: '1', pluginId: 'aaa', matcher: () => false, iconName: 'shield-outline'},
            ]);
            expect(getChannelIconClassNameForChannel(state, makeChannel({type: 'P'}))).toBe('icon-lock-outline');
        });

        it('skips matchers when channel is undefined, returning icon-globe', () => {
            const matcher = jest.fn().mockReturnValue(true);
            const state = makeState([
                {id: '1', pluginId: 'mbe', matcher, iconName: 'shield-outline'},
            ]);
            expect(getChannelIconClassNameForChannel(state, undefined)).toBe('icon-globe');
            expect(matcher).not.toHaveBeenCalled();
        });

        it("matcher receives plugin-scoped state (state['plugins-<id>']) so plugins can consult their own slice", () => {
            const stateWithPluginSlice = {
                plugins: {
                    components: {
                        ChannelIconOverride: [{
                            id: '1',
                            pluginId: 'mbe',
                            matcher: (state: GlobalState) =>
                                (state as any)['plugins-mbe']?.someValue === 42,
                            iconName: 'shield-outline',
                        }],
                    },
                },
                'plugins-mbe': {someValue: 42},
            } as unknown as GlobalState;

            expect(getChannelIconClassNameForChannel(stateWithPluginSlice, makeChannel())).toBe('icon-shield-outline');
        });

        it("matcher's plugin-scoped state read returns falsy when the plugin slice is absent", () => {
            const stateWithoutPluginSlice = {
                plugins: {
                    components: {
                        ChannelIconOverride: [{
                            id: '1',
                            pluginId: 'mbe',
                            matcher: (state: GlobalState) =>
                                (state as any)['plugins-mbe']?.someValue === 42,
                            iconName: 'shield-outline',
                        }],
                    },
                },
            } as unknown as GlobalState;

            expect(getChannelIconClassNameForChannel(stateWithoutPluginSlice, makeChannel())).toBe('icon-globe');
        });
    });

    describe('archive fallback vs override precedence', () => {
        it('override wins over archive fallback for an archived open channel', () => {
            const state = makeState([
                {id: '1', pluginId: 'mbe', matcher: () => true, iconName: 'shield-outline'},
            ]);
            const archivedOpen = makeChannel({type: 'O', delete_at: 1234});
            expect(getChannelIconClassNameForChannel(state, archivedOpen)).toBe('icon-shield-outline');
        });

        it('override wins over archive fallback for an archived private channel', () => {
            const state = makeState([
                {id: '1', pluginId: 'mbe', matcher: () => true, iconName: 'shield-outline'},
            ]);
            const archivedPrivate = makeChannel({type: 'P', delete_at: 1234});
            expect(getChannelIconClassNameForChannel(state, archivedPrivate)).toBe('icon-shield-outline');
        });
    });

    describe('matcher error isolation', () => {
        it('treats a throwing matcher as no-match and falls back', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const throwingMatcher = () => {
                throw new Error('boom');
            };
            const state = makeState([
                {id: '1', pluginId: 'bad-plugin-fallback', matcher: throwingMatcher, iconName: 'shield-outline'},
            ]);
            expect(getChannelIconClassNameForChannel(state, makeChannel())).toBe('icon-globe');
            consoleSpy.mockRestore();
        });

        it('logs once per pluginId on throw', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const throwingMatcher = () => {
                throw new Error('boom');
            };
            const state = makeState([
                {id: '1', pluginId: 'bad-plugin-log-once', matcher: throwingMatcher, iconName: 'shield-outline'},
            ]);
            const channel = makeChannel();
            getChannelIconClassNameForChannel(state, channel);
            getChannelIconClassNameForChannel(state, channel);

            // Only one log for the same pluginId, and it includes the thrown error
            expect(consoleSpy).toHaveBeenCalledTimes(1);
            expect(consoleSpy).toHaveBeenCalledWith(expect.any(String), expect.any(Error));
            consoleSpy.mockRestore();
        });

        it('clearLoggedMatcherErrors(pluginId) allows re-logging after reset', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const throwingMatcher = () => {
                throw new Error('boom');
            };
            const state = makeState([
                {id: '1', pluginId: 'reset-plugin', matcher: throwingMatcher, iconName: 'shield-outline'},
            ]);
            const channel = makeChannel();

            getChannelIconClassNameForChannel(state, channel);
            expect(consoleSpy).toHaveBeenCalledTimes(1);

            clearLoggedMatcherErrors('reset-plugin');

            getChannelIconClassNameForChannel(state, channel);
            expect(consoleSpy).toHaveBeenCalledTimes(2);
            consoleSpy.mockRestore();
        });

        it('a throwing matcher then a valid matching one still returns the valid match', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const throwingMatcher = () => {
                throw new Error('boom');
            };
            const state = makeState([
                {id: '1', pluginId: 'bad-plugin-chain', matcher: throwingMatcher, iconName: 'shield-outline'},
                {id: '2', pluginId: 'good-plugin', matcher: () => true, iconName: 'lock-outline'},
            ]);
            expect(getChannelIconClassNameForChannel(state, makeChannel())).toBe('icon-lock-outline');
            consoleSpy.mockRestore();
        });
    });
});

describe('selectors/getChannelIconOverrideForChannel', () => {
    beforeEach(() => {
        clearLoggedMatcherErrors();
    });

    describe('no overrides', () => {
        it('returns null for an open channel with no overrides', () => {
            const state = makeState();
            const channel = makeChannel({type: 'O'});
            expect(getChannelIconOverrideForChannel(state, channel)).toBeNull();
        });

        it('returns null when channel is undefined', () => {
            const state = makeState();
            expect(getChannelIconOverrideForChannel(state, undefined)).toBeNull();
        });
    });

    describe('with overrides', () => {
        it('returns the iconName of the first matching override', () => {
            const matcher = jest.fn().mockReturnValue(true);
            const state = makeState([
                {id: '1', pluginId: 'mbe', matcher, iconName: 'shield-outline'},
            ]);
            const channel = makeChannel();
            expect(getChannelIconOverrideForChannel(state, channel)).toBe('shield-outline');
            expect(matcher).toHaveBeenCalledWith(state, channel);
        });

        it('uses array order for first-match-wins when multiple match', () => {
            const state = makeState([
                {id: '1', pluginId: 'aaa', matcher: () => true, iconName: 'shield-outline'},
                {id: '2', pluginId: 'bbb', matcher: () => true, iconName: 'lock-outline'},
            ]);
            expect(getChannelIconOverrideForChannel(state, makeChannel())).toBe('shield-outline');
        });

        it('falls through to second matcher when first returns false', () => {
            const state = makeState([
                {id: '1', pluginId: 'aaa', matcher: () => false, iconName: 'shield-outline'},
                {id: '2', pluginId: 'bbb', matcher: () => true, iconName: 'globe'},
            ]);
            expect(getChannelIconOverrideForChannel(state, makeChannel())).toBe('globe');
        });

        it('returns null when no matcher returns true', () => {
            const state = makeState([
                {id: '1', pluginId: 'aaa', matcher: () => false, iconName: 'shield-outline'},
            ]);
            expect(getChannelIconOverrideForChannel(state, makeChannel())).toBeNull();
        });

        it('skips matchers when channel is undefined, returning null', () => {
            const matcher = jest.fn().mockReturnValue(true);
            const state = makeState([
                {id: '1', pluginId: 'mbe', matcher, iconName: 'shield-outline'},
            ]);
            expect(getChannelIconOverrideForChannel(state, undefined)).toBeNull();
            expect(matcher).not.toHaveBeenCalled();
        });
    });

    describe('matcher error isolation', () => {
        it('treats a throwing matcher as no-match and returns null', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const throwingMatcher = () => {
                throw new Error('boom');
            };
            const state = makeState([
                {id: '1', pluginId: 'override-bad-fallback', matcher: throwingMatcher, iconName: 'shield-outline'},
            ]);
            expect(getChannelIconOverrideForChannel(state, makeChannel())).toBeNull();
            consoleSpy.mockRestore();
        });

        it('a throwing matcher then a valid matching one still returns the valid match', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const throwingMatcher = () => {
                throw new Error('boom');
            };
            const state = makeState([
                {id: '1', pluginId: 'override-bad-chain', matcher: throwingMatcher, iconName: 'shield-outline'},
                {id: '2', pluginId: 'good-plugin-override', matcher: () => true, iconName: 'globe'},
            ]);
            expect(getChannelIconOverrideForChannel(state, makeChannel())).toBe('globe');
            consoleSpy.mockRestore();
        });

        it('returns null when matcher is async (returns a Promise, not a boolean)', () => {
            // async functions always return a Promise, which is truthy — must not match
            const asyncMatcher = async () => true;
            const state = makeState([
                {id: '1', pluginId: 'async-plugin', matcher: asyncMatcher as any, iconName: 'shield-outline'},
            ]);
            expect(getChannelIconOverrideForChannel(state, makeChannel())).toBeNull();
        });

        it('returns null when matcher returns a non-boolean truthy value', () => {
            const truthyMatcher = () => ({some: 'object'} as any);
            const state = makeState([
                {id: '1', pluginId: 'truthy-plugin', matcher: truthyMatcher, iconName: 'shield-outline'},
            ]);
            expect(getChannelIconOverrideForChannel(state, makeChannel())).toBeNull();
        });
    });
});

