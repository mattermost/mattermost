// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import type {GlobalState} from 'types/store';
import type {ChannelIntroRegistration} from 'types/store/plugins';

import {clearLoggedChannelIntroErrors, getChannelIntroOverride} from './channel_intro';

function makeChannel(partial: Partial<Channel> = {}): Channel {
    return {
        id: 'channel-1',
        type: 'O',
        delete_at: 0,
        ...partial,
    } as Channel;
}

function makeState(
    regs: ChannelIntroRegistration[] = [],
    channels: Record<string, Channel> = {},
): GlobalState {
    return {
        plugins: {
            components: {
                ChannelIntro: regs,
            },
        },
        entities: {
            channels: {
                channels,
            },
        },
    } as unknown as GlobalState;
}

function makeRegistration(partial: Partial<ChannelIntroRegistration> = {}): ChannelIntroRegistration {
    return {
        id: 'reg-1',
        pluginId: 'test-plugin',
        matcher: () => true,
        component: () => null,
        ...partial,
    } as ChannelIntroRegistration;
}

describe('selectors/getChannelIntroOverride', () => {
    beforeEach(() => {
        clearLoggedChannelIntroErrors();
    });

    describe('empty / missing data', () => {
        it('returns null when ChannelIntro list is empty', () => {
            const channel = makeChannel();
            const state = makeState([], {[channel.id]: channel});
            expect(getChannelIntroOverride(state, channel.id)).toBeNull();
        });

        it('returns null when channelId is empty string', () => {
            const channel = makeChannel();
            const state = makeState([makeRegistration()], {[channel.id]: channel});
            expect(getChannelIntroOverride(state, '')).toBeNull();
        });

        it('returns null when channel is not in state', () => {
            const state = makeState([makeRegistration()], {});
            expect(getChannelIntroOverride(state, 'nonexistent')).toBeNull();
        });
    });

    describe('matcher semantics — strict boolean true', () => {
        it('returns the registration when matcher returns exactly true', () => {
            const channel = makeChannel();
            const reg = makeRegistration({matcher: () => true});
            const state = makeState([reg], {[channel.id]: channel});
            expect(getChannelIntroOverride(state, channel.id)).toBe(reg);
        });

        it('returns null when matcher returns false', () => {
            const channel = makeChannel();
            const reg = makeRegistration({matcher: () => false});
            const state = makeState([reg], {[channel.id]: channel});
            expect(getChannelIntroOverride(state, channel.id)).toBeNull();
        });

        it('returns null when matcher returns truthy non-boolean (channel object)', () => {
            const channel = makeChannel();
            const reg = makeRegistration({matcher: (_state, ch) => ch as unknown as boolean});
            const state = makeState([reg], {[channel.id]: channel});
            expect(getChannelIntroOverride(state, channel.id)).toBeNull();
        });

        it('returns null when matcher returns 1 (truthy non-boolean)', () => {
            const channel = makeChannel();
            const reg = makeRegistration({matcher: () => 1 as unknown as boolean});
            const state = makeState([reg], {[channel.id]: channel});
            expect(getChannelIntroOverride(state, channel.id)).toBeNull();
        });
    });

    describe('first-match-wins semantics', () => {
        it('returns the first matching registration when multiple registrations match', () => {
            const channel = makeChannel();
            const reg1 = makeRegistration({id: 'r1', pluginId: 'alpha'});
            const reg2 = makeRegistration({id: 'r2', pluginId: 'beta'});
            const state = makeState([reg1, reg2], {[channel.id]: channel});
            const result = getChannelIntroOverride(state, channel.id);
            expect(result).toBe(reg1);
        });

        it('returns the first alphabetical pluginId when reducer inserts them in order', () => {
            const channel = makeChannel();
            const regAlpha = makeRegistration({id: 'r1', pluginId: 'alpha'});
            const regBeta = makeRegistration({id: 'r2', pluginId: 'beta'});

            // Reducer inserts in alphabetical pluginId order, so alpha comes first
            const state = makeState([regAlpha, regBeta], {[channel.id]: channel});
            const result = getChannelIntroOverride(state, channel.id);
            expect(result?.pluginId).toBe('alpha');
        });

        it('returns null when no registrations match', () => {
            const channel = makeChannel();
            const reg = makeRegistration({matcher: () => false});
            const state = makeState([reg], {[channel.id]: channel});
            expect(getChannelIntroOverride(state, channel.id)).toBeNull();
        });
    });

    describe('matcher error handling', () => {
        it('treats a throwing matcher as no-match', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const channel = makeChannel();
            const reg = makeRegistration({
                pluginId: 'bad-plugin',
                matcher: () => {
                    throw new Error('boom');
                },
            });
            const state = makeState([reg], {[channel.id]: channel});
            expect(getChannelIntroOverride(state, channel.id)).toBeNull();
            consoleSpy.mockRestore();
        });

        it('logs the error exactly once for a given pluginId', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const channel = makeChannel();
            const reg = makeRegistration({
                pluginId: 'bad-plugin',
                matcher: () => {
                    throw new Error('boom');
                },
            });
            const state = makeState([reg], {[channel.id]: channel});

            getChannelIntroOverride(state, channel.id);
            getChannelIntroOverride(state, channel.id);
            getChannelIntroOverride(state, channel.id);

            expect(consoleSpy).toHaveBeenCalledTimes(1);
            consoleSpy.mockRestore();
        });
    });

    describe('clearLoggedChannelIntroErrors', () => {
        it('resets the error log so errors are logged again after clearing', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const channel = makeChannel();
            const reg = makeRegistration({
                pluginId: 'bad-plugin',
                matcher: () => {
                    throw new Error('boom');
                },
            });
            const state = makeState([reg], {[channel.id]: channel});

            getChannelIntroOverride(state, channel.id);
            expect(consoleSpy).toHaveBeenCalledTimes(1);

            clearLoggedChannelIntroErrors('bad-plugin');

            getChannelIntroOverride(state, channel.id);
            expect(consoleSpy).toHaveBeenCalledTimes(2);

            consoleSpy.mockRestore();
        });

        it('clears all entries when called with no argument', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const channel = makeChannel();
            const reg = makeRegistration({
                pluginId: 'bad-plugin',
                matcher: () => {
                    throw new Error('boom');
                },
            });
            const state = makeState([reg], {[channel.id]: channel});

            getChannelIntroOverride(state, channel.id);
            expect(consoleSpy).toHaveBeenCalledTimes(1);

            clearLoggedChannelIntroErrors();

            getChannelIntroOverride(state, channel.id);
            expect(consoleSpy).toHaveBeenCalledTimes(2);

            consoleSpy.mockRestore();
        });
    });

    describe('matcher receives full state', () => {
        it('passes full state to matcher so plugins can read their own slice', () => {
            const channel = makeChannel();
            const capturedStates: GlobalState[] = [];
            const reg = makeRegistration({
                matcher: (st) => {
                    capturedStates.push(st);
                    return true;
                },
            });
            const state = makeState([reg], {[channel.id]: channel});
            getChannelIntroOverride(state, channel.id);
            expect(capturedStates).toHaveLength(1);
            expect(capturedStates[0]).toBe(state);
        });
    });
});
