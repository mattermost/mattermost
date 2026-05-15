// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import type {GlobalState} from 'types/store';
import type {ChannelDecoratorRegistration, ChannelDecoratorSlot} from 'types/store/plugins';

import {clearLoggedDecoratorErrors, getChannelDecoratorsForSlot} from './channel_decorator';

function makeChannel(partial: Partial<Channel> = {}): Channel {
    return {
        id: 'channel-1',
        type: 'O',
        delete_at: 0,
        ...partial,
    } as Channel;
}

function makeState(
    decorators: ChannelDecoratorRegistration[] = [],
    channels: Record<string, Channel> = {},
): GlobalState {
    return {
        plugins: {
            components: {
                ChannelDecorator: decorators,
            },
        },
        entities: {
            channels: {
                channels,
            },
        },
    } as unknown as GlobalState;
}

function makeRegistration(partial: Partial<ChannelDecoratorRegistration> & {slot: ChannelDecoratorSlot}): ChannelDecoratorRegistration {
    return {
        id: 'reg-1',
        pluginId: 'test-plugin',
        matcher: () => true,
        component: () => null,
        ...partial,
    } as ChannelDecoratorRegistration;
}

describe('selectors/getChannelDecoratorsForSlot', () => {
    beforeEach(() => {
        clearLoggedDecoratorErrors();
    });

    describe('no registrations', () => {
        it('returns empty array when ChannelDecorator is empty', () => {
            const channel = makeChannel();
            const state = makeState([], {[channel.id]: channel});
            const result = getChannelDecoratorsForSlot(state, channel.id, 'left_of_channel_name');
            expect(result).toEqual([]);
        });

        it('returns same empty array reference on repeated calls (EMPTY_ARRAY sentinel)', () => {
            const channel = makeChannel();
            const state = makeState([], {[channel.id]: channel});
            const r1 = getChannelDecoratorsForSlot(state, channel.id, 'intro');
            const r2 = getChannelDecoratorsForSlot(state, channel.id, 'intro');
            expect(r1).toBe(r2);
        });
    });

    describe('missing channel', () => {
        it('returns empty array when channelId is not in state', () => {
            const state = makeState([makeRegistration({slot: 'intro'})], {});
            const result = getChannelDecoratorsForSlot(state, 'nonexistent', 'intro');
            expect(result).toEqual([]);
        });

        it('returns empty array when channelId is null', () => {
            const state = makeState([makeRegistration({slot: 'intro'})], {});

            // @ts-expect-error testing null channelId
            const result = getChannelDecoratorsForSlot(state, null, 'intro');
            expect(result).toEqual([]);
        });

        it('returns empty array when channelId is undefined', () => {
            const state = makeState([makeRegistration({slot: 'intro'})], {});

            // @ts-expect-error testing undefined channelId
            const result = getChannelDecoratorsForSlot(state, undefined, 'intro');
            expect(result).toEqual([]);
        });
    });

    describe('slot filtering', () => {
        it('ignores registrations for a different slot', () => {
            const channel = makeChannel();
            const state = makeState(
                [makeRegistration({slot: 'above_composer', pluginId: 'plugin-a'})],
                {[channel.id]: channel},
            );
            const result = getChannelDecoratorsForSlot(state, channel.id, 'intro');
            expect(result).toEqual([]);
        });

        it('returns registrations matching the requested slot', () => {
            const channel = makeChannel();
            const reg = makeRegistration({slot: 'left_of_channel_name'});
            const state = makeState([reg], {[channel.id]: channel});
            const result = getChannelDecoratorsForSlot(state, channel.id, 'left_of_channel_name');
            expect(result).toHaveLength(1);
            expect(result[0]).toBe(reg);
        });
    });

    describe('matcher semantics — strict boolean true', () => {
        it('includes registration when matcher returns exactly true', () => {
            const channel = makeChannel();
            const reg = makeRegistration({slot: 'mount_overlay', matcher: () => true});
            const state = makeState([reg], {[channel.id]: channel});
            const result = getChannelDecoratorsForSlot(state, channel.id, 'mount_overlay');
            expect(result).toHaveLength(1);
        });

        it('excludes registration when matcher returns false', () => {
            const channel = makeChannel();
            const reg = makeRegistration({slot: 'mount_overlay', matcher: () => false});
            const state = makeState([reg], {[channel.id]: channel});
            const result = getChannelDecoratorsForSlot(state, channel.id, 'mount_overlay');
            expect(result).toHaveLength(0);
        });

        it('excludes registration when matcher returns truthy non-boolean (channel object)', () => {
            const channel = makeChannel();

            // matcher returns the channel object (truthy but not === true)
            const reg = makeRegistration({slot: 'mount_overlay', matcher: (ch) => ch as unknown as boolean});
            const state = makeState([reg], {[channel.id]: channel});
            const result = getChannelDecoratorsForSlot(state, channel.id, 'mount_overlay');
            expect(result).toHaveLength(0);
        });

        it('excludes registration when matcher returns 1 (truthy non-boolean)', () => {
            const channel = makeChannel();
            const reg = makeRegistration({slot: 'above_composer', matcher: () => 1 as unknown as boolean});
            const state = makeState([reg], {[channel.id]: channel});
            const result = getChannelDecoratorsForSlot(state, channel.id, 'above_composer');
            expect(result).toHaveLength(0);
        });
    });

    describe('matcher error handling', () => {
        it('treats a throwing matcher as no-match', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const channel = makeChannel();
            const reg = makeRegistration({
                slot: 'intro',
                pluginId: 'bad-plugin',
                matcher: () => {
                    throw new Error('boom');
                },
            });
            const state = makeState([reg], {[channel.id]: channel});
            const result = getChannelDecoratorsForSlot(state, channel.id, 'intro');
            expect(result).toHaveLength(0);
            consoleSpy.mockRestore();
        });

        it('logs the error exactly once for a given pluginId+slot combination', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const channel = makeChannel();
            const reg = makeRegistration({
                slot: 'intro',
                pluginId: 'bad-plugin',
                matcher: () => {
                    throw new Error('boom');
                },
            });
            const state = makeState([reg], {[channel.id]: channel});

            getChannelDecoratorsForSlot(state, channel.id, 'intro');
            getChannelDecoratorsForSlot(state, channel.id, 'intro');
            getChannelDecoratorsForSlot(state, channel.id, 'intro');

            expect(consoleSpy).toHaveBeenCalledTimes(1);
            consoleSpy.mockRestore();
        });

        it('does not log errors for a different pluginId after one was logged', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const channel = makeChannel();
            const badReg1 = makeRegistration({
                id: 'r1',
                slot: 'intro',
                pluginId: 'plugin-a',
                matcher: () => {
                    throw new Error('boom');
                },
            });
            const badReg2 = makeRegistration({
                id: 'r2',
                slot: 'intro',
                pluginId: 'plugin-b',
                matcher: () => {
                    throw new Error('boom');
                },
            });
            const state = makeState([badReg1, badReg2], {[channel.id]: channel});

            getChannelDecoratorsForSlot(state, channel.id, 'intro');

            // plugin-a was first-match-wins so plugin-b would be skipped; but for above_composer both fire
            const state2 = makeState([badReg1, badReg2], {[channel.id]: channel});
            getChannelDecoratorsForSlot(state2, channel.id, 'above_composer');
            getChannelDecoratorsForSlot(state2, channel.id, 'above_composer');

            // Each pluginId logged once
            expect(consoleSpy).toHaveBeenCalledTimes(2);
            consoleSpy.mockRestore();
        });
    });

    describe('clearLoggedDecoratorErrors', () => {
        it('resets the error log so errors are logged again after clearing', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const channel = makeChannel();
            const reg = makeRegistration({
                slot: 'intro',
                pluginId: 'bad-plugin',
                matcher: () => {
                    throw new Error('boom');
                },
            });
            const state = makeState([reg], {[channel.id]: channel});

            getChannelDecoratorsForSlot(state, channel.id, 'intro');
            expect(consoleSpy).toHaveBeenCalledTimes(1);

            clearLoggedDecoratorErrors('bad-plugin');

            getChannelDecoratorsForSlot(state, channel.id, 'intro');
            expect(consoleSpy).toHaveBeenCalledTimes(2);

            consoleSpy.mockRestore();
        });

        it('clears all entries when called with no argument', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const channel = makeChannel();
            const reg = makeRegistration({
                slot: 'intro',
                pluginId: 'bad-plugin',
                matcher: () => {
                    throw new Error('boom');
                },
            });
            const state = makeState([reg], {[channel.id]: channel});

            getChannelDecoratorsForSlot(state, channel.id, 'intro');
            expect(consoleSpy).toHaveBeenCalledTimes(1);

            clearLoggedDecoratorErrors();

            getChannelDecoratorsForSlot(state, channel.id, 'intro');
            expect(consoleSpy).toHaveBeenCalledTimes(2);

            consoleSpy.mockRestore();
        });
    });

    describe('intro slot — first-match-wins semantics', () => {
        it('returns at most one entry for the intro slot', () => {
            const channel = makeChannel();
            const reg1 = makeRegistration({id: 'r1', slot: 'intro', pluginId: 'alpha'});
            const reg2 = makeRegistration({id: 'r2', slot: 'intro', pluginId: 'beta'});
            const state = makeState([reg1, reg2], {[channel.id]: channel});
            const result = getChannelDecoratorsForSlot(state, channel.id, 'intro');
            expect(result).toHaveLength(1);
            expect(result[0]).toBe(reg1);
        });

        it('returns the first alphabetical pluginId for intro when multiple plugins match', () => {
            const channel = makeChannel();
            const regBeta = makeRegistration({id: 'r1', slot: 'intro', pluginId: 'beta'});
            const regAlpha = makeRegistration({id: 'r2', slot: 'intro', pluginId: 'alpha'});

            // reducer inserts in alphabetical pluginId order, so alpha comes first in the array
            const state = makeState([regAlpha, regBeta], {[channel.id]: channel});
            const result = getChannelDecoratorsForSlot(state, channel.id, 'intro');
            expect(result).toHaveLength(1);
            expect(result[0].pluginId).toBe('alpha');
        });

        it('returns empty array for intro when no registrations match', () => {
            const channel = makeChannel();
            const reg = makeRegistration({slot: 'intro', matcher: () => false});
            const state = makeState([reg], {[channel.id]: channel});
            const result = getChannelDecoratorsForSlot(state, channel.id, 'intro');
            expect(result).toHaveLength(0);
        });
    });

    describe('additive slots — all matches returned', () => {
        it('returns all matching registrations for left_of_channel_name', () => {
            const channel = makeChannel();
            const reg1 = makeRegistration({id: 'r1', slot: 'left_of_channel_name', pluginId: 'plugin-a'});
            const reg2 = makeRegistration({id: 'r2', slot: 'left_of_channel_name', pluginId: 'plugin-b'});
            const state = makeState([reg1, reg2], {[channel.id]: channel});
            const result = getChannelDecoratorsForSlot(state, channel.id, 'left_of_channel_name');
            expect(result).toHaveLength(2);
        });

        it('returns all matching registrations for above_composer', () => {
            const channel = makeChannel();
            const reg1 = makeRegistration({id: 'r1', slot: 'above_composer', pluginId: 'plugin-a'});
            const reg2 = makeRegistration({id: 'r2', slot: 'above_composer', pluginId: 'plugin-b'});
            const state = makeState([reg1, reg2], {[channel.id]: channel});
            const result = getChannelDecoratorsForSlot(state, channel.id, 'above_composer');
            expect(result).toHaveLength(2);
        });

        it('returns all matching registrations for mount_overlay', () => {
            const channel = makeChannel();
            const reg1 = makeRegistration({id: 'r1', slot: 'mount_overlay', pluginId: 'plugin-a'});
            const reg2 = makeRegistration({id: 'r2', slot: 'mount_overlay', pluginId: 'plugin-b'});
            const state = makeState([reg1, reg2], {[channel.id]: channel});
            const result = getChannelDecoratorsForSlot(state, channel.id, 'mount_overlay');
            expect(result).toHaveLength(2);
        });
    });

    describe('matcher receives state argument', () => {
        it('passes full state to matcher so plugins can read their own slice', () => {
            const channel = makeChannel();
            const capturedStates: GlobalState[] = [];
            const reg = makeRegistration({
                slot: 'left_of_channel_name',
                matcher: (_ch, st) => {
                    capturedStates.push(st);
                    return true;
                },
            });
            const state = makeState([reg], {[channel.id]: channel});
            getChannelDecoratorsForSlot(state, channel.id, 'left_of_channel_name');
            expect(capturedStates).toHaveLength(1);
            expect(capturedStates[0]).toBe(state);
        });
    });
});
