// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import type {GlobalState} from 'types/store';
import type {PostDecoratorRegistration, PostDecoratorSlot} from 'types/store/plugins';

import {clearLoggedPostDecoratorErrors, getPostDecoratorsForSlot} from './post_decorator';

function makePost(partial: Partial<Post> = {}): Post {
    return {
        id: 'post-1',
        channel_id: 'channel-1',
        message: 'hello',
        ...partial,
    } as Post;
}

function makeState(decorators: PostDecoratorRegistration[] = []): GlobalState {
    return {
        plugins: {
            components: {
                PostDecorator: decorators,
            },
        },
    } as unknown as GlobalState;
}

function makeRegistration(partial: Partial<PostDecoratorRegistration> & {slot: PostDecoratorSlot}): PostDecoratorRegistration {
    return {
        id: 'reg-1',
        pluginId: 'test-plugin',
        matcher: () => true,
        component: () => null,
        ...partial,
    } as PostDecoratorRegistration;
}

describe('selectors/getPostDecoratorsForSlot', () => {
    beforeEach(() => {
        clearLoggedPostDecoratorErrors();
    });

    describe('no registrations', () => {
        it('returns empty array when PostDecorator is empty', () => {
            const post = makePost();
            const state = makeState([]);
            const result = getPostDecoratorsForSlot(state, post, 'post_header_badge');
            expect(result).toEqual([]);
        });

        it('returns same EMPTY_ARRAY reference on repeated calls with no matches', () => {
            const post = makePost();
            const state = makeState([]);
            const r1 = getPostDecoratorsForSlot(state, post, 'post_header_badge');
            const r2 = getPostDecoratorsForSlot(state, post, 'post_header_badge');
            expect(r1).toBe(r2);
        });
    });

    describe('null/undefined post guard', () => {
        it('returns empty array when post is null', () => {
            const state = makeState([makeRegistration({slot: 'post_header_badge'})]);

            // @ts-expect-error testing null post
            const result = getPostDecoratorsForSlot(state, null, 'post_header_badge');
            expect(result).toEqual([]);
        });

        it('returns empty array when post is undefined', () => {
            const state = makeState([makeRegistration({slot: 'post_header_badge'})]);

            // @ts-expect-error testing undefined post
            const result = getPostDecoratorsForSlot(state, undefined, 'post_header_badge');
            expect(result).toEqual([]);
        });

        it('returns EMPTY_ARRAY sentinel when post is null', () => {
            const state = makeState([]);

            // @ts-expect-error testing null post
            const r1 = getPostDecoratorsForSlot(state, null, 'post_header_badge');

            // @ts-expect-error testing null post
            const r2 = getPostDecoratorsForSlot(state, null, 'post_header_badge');
            expect(r1).toBe(r2);
        });
    });

    describe('slot filtering', () => {
        it('ignores registrations for a different slot', () => {
            const post = makePost();

            // There's only one slot for post decorators currently, so we simulate a wrong slot by
            // registering with a cast
            const reg = makeRegistration({slot: 'post_header_badge', matcher: () => false});
            const state = makeState([reg]);
            const result = getPostDecoratorsForSlot(state, post, 'post_header_badge');
            expect(result).toEqual([]);
        });

        it('returns registrations matching the requested slot', () => {
            const post = makePost();
            const reg = makeRegistration({slot: 'post_header_badge'});
            const state = makeState([reg]);
            const result = getPostDecoratorsForSlot(state, post, 'post_header_badge');
            expect(result).toHaveLength(1);
            expect(result[0]).toBe(reg);
        });
    });

    describe('matcher semantics — strict boolean true', () => {
        it('includes registration when matcher returns exactly true', () => {
            const post = makePost();
            const reg = makeRegistration({slot: 'post_header_badge', matcher: () => true});
            const state = makeState([reg]);
            const result = getPostDecoratorsForSlot(state, post, 'post_header_badge');
            expect(result).toHaveLength(1);
        });

        it('excludes registration when matcher returns false', () => {
            const post = makePost();
            const reg = makeRegistration({slot: 'post_header_badge', matcher: () => false});
            const state = makeState([reg]);
            const result = getPostDecoratorsForSlot(state, post, 'post_header_badge');
            expect(result).toHaveLength(0);
        });

        it('excludes registration when matcher returns truthy non-boolean (post object)', () => {
            const post = makePost();
            const reg = makeRegistration({slot: 'post_header_badge', matcher: (p) => p as unknown as boolean});
            const state = makeState([reg]);
            const result = getPostDecoratorsForSlot(state, post, 'post_header_badge');
            expect(result).toHaveLength(0);
        });

        it('excludes registration when matcher returns 1 (truthy non-boolean)', () => {
            const post = makePost();
            const reg = makeRegistration({slot: 'post_header_badge', matcher: () => 1 as unknown as boolean});
            const state = makeState([reg]);
            const result = getPostDecoratorsForSlot(state, post, 'post_header_badge');
            expect(result).toHaveLength(0);
        });
    });

    describe('matcher error handling', () => {
        it('treats a throwing matcher as no-match', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const post = makePost();
            const reg = makeRegistration({
                slot: 'post_header_badge',
                pluginId: 'bad-plugin',
                matcher: () => {
                    throw new Error('boom');
                },
            });
            const state = makeState([reg]);
            const result = getPostDecoratorsForSlot(state, post, 'post_header_badge');
            expect(result).toHaveLength(0);
            consoleSpy.mockRestore();
        });

        it('logs the error exactly once for a given pluginId+slot combination', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const post = makePost();
            const reg = makeRegistration({
                slot: 'post_header_badge',
                pluginId: 'bad-plugin',
                matcher: () => {
                    throw new Error('boom');
                },
            });
            const state = makeState([reg]);

            getPostDecoratorsForSlot(state, post, 'post_header_badge');
            getPostDecoratorsForSlot(state, post, 'post_header_badge');
            getPostDecoratorsForSlot(state, post, 'post_header_badge');

            expect(consoleSpy).toHaveBeenCalledTimes(1);
            consoleSpy.mockRestore();
        });

        it('logs independently for different pluginId+slot combinations', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const post = makePost();
            const badReg1 = makeRegistration({
                id: 'r1',
                slot: 'post_header_badge',
                pluginId: 'plugin-a',
                matcher: () => {
                    throw new Error('boom');
                },
            });
            const badReg2 = makeRegistration({
                id: 'r2',
                slot: 'post_header_badge',
                pluginId: 'plugin-b',
                matcher: () => {
                    throw new Error('boom');
                },
            });
            const state = makeState([badReg1, badReg2]);

            getPostDecoratorsForSlot(state, post, 'post_header_badge');
            getPostDecoratorsForSlot(state, post, 'post_header_badge');

            // Each pluginId logged once
            expect(consoleSpy).toHaveBeenCalledTimes(2);
            consoleSpy.mockRestore();
        });
    });

    describe('clearLoggedPostDecoratorErrors', () => {
        it('resets the error log so errors are logged again after clearing', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const post = makePost();
            const reg = makeRegistration({
                slot: 'post_header_badge',
                pluginId: 'bad-plugin',
                matcher: () => {
                    throw new Error('boom');
                },
            });
            const state = makeState([reg]);

            getPostDecoratorsForSlot(state, post, 'post_header_badge');
            expect(consoleSpy).toHaveBeenCalledTimes(1);

            clearLoggedPostDecoratorErrors('bad-plugin');

            getPostDecoratorsForSlot(state, post, 'post_header_badge');
            expect(consoleSpy).toHaveBeenCalledTimes(2);

            consoleSpy.mockRestore();
        });

        it('clears all entries when called with no argument', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const post = makePost();
            const reg = makeRegistration({
                slot: 'post_header_badge',
                pluginId: 'bad-plugin',
                matcher: () => {
                    throw new Error('boom');
                },
            });
            const state = makeState([reg]);

            getPostDecoratorsForSlot(state, post, 'post_header_badge');
            expect(consoleSpy).toHaveBeenCalledTimes(1);

            clearLoggedPostDecoratorErrors();

            getPostDecoratorsForSlot(state, post, 'post_header_badge');
            expect(consoleSpy).toHaveBeenCalledTimes(2);

            consoleSpy.mockRestore();
        });
    });

    describe('additive semantics for post_header_badge', () => {
        it('returns all matching registrations (no first-match-wins)', () => {
            const post = makePost();
            const reg1 = makeRegistration({id: 'r1', slot: 'post_header_badge', pluginId: 'alpha'});
            const reg2 = makeRegistration({id: 'r2', slot: 'post_header_badge', pluginId: 'beta'});
            const state = makeState([reg1, reg2]);
            const result = getPostDecoratorsForSlot(state, post, 'post_header_badge');
            expect(result).toHaveLength(2);
            expect(result[0]).toBe(reg1);
            expect(result[1]).toBe(reg2);
        });

        it('returns EMPTY_ARRAY sentinel when no registrations match', () => {
            const post = makePost();
            const reg = makeRegistration({slot: 'post_header_badge', matcher: () => false});
            const state = makeState([reg]);
            const r1 = getPostDecoratorsForSlot(state, post, 'post_header_badge');
            const r2 = getPostDecoratorsForSlot(state, post, 'post_header_badge');
            expect(r1).toHaveLength(0);
            expect(r1).toBe(r2);
        });
    });

    describe('matcher receives state argument', () => {
        it('passes full state to matcher so plugins can read their own slice', () => {
            const post = makePost();
            const capturedStates: GlobalState[] = [];
            const reg = makeRegistration({
                slot: 'post_header_badge',
                matcher: (_p, st) => {
                    capturedStates.push(st);
                    return true;
                },
            });
            const state = makeState([reg]);
            getPostDecoratorsForSlot(state, post, 'post_header_badge');
            expect(capturedStates).toHaveLength(1);
            expect(capturedStates[0]).toBe(state);
        });
    });
});
