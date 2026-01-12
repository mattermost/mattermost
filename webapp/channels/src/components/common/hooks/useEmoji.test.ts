// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';
import * as ReactRedux from 'react-redux';

import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {renderHookWithContext, waitFor} from 'tests/react_testing_utils';
import {EmojiIndicesByAlias, Emojis} from 'utils/emoji';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import {useEmoji} from './useEmoji';

describe('useEmoji', () => {
    const emoji1 = TestHelper.getCustomEmojiMock({id: 'emojiId1', name: 'emoji1'});
    const emoji2 = TestHelper.getCustomEmojiMock({id: 'emojiId2', name: 'emoji2'});

    function makeTestState(override?: DeepPartial<GlobalState>) {
        const baseState = {
            entities: {
                general: {
                    config: {
                        EnableCustomEmoji: 'true',
                    },
                },
            },
        };

        return override ? mergeObjects(baseState, override) : baseState;
    }

    describe('useEmoji with fake dispatch', () => {
        const dispatchMock = jest.fn();

        beforeAll(() => {
            jest.spyOn(ReactRedux, 'useDispatch').mockImplementation(() => dispatchMock);
        });

        afterAll(() => {
            jest.restoreAllMocks();
        });

        test('should return a system emoji without attempting to fetch', () => {
            const {result} = renderHookWithContext(
                () => useEmoji('taco'),
                makeTestState(),
            );

            expect(result.current).toBe(Emojis[EmojiIndicesByAlias.get('taco') as number]);
            expect(dispatchMock).not.toHaveBeenCalled();
        });

        test('should return a loaded custom emoji without attempting to fetch', () => {
            const {result} = renderHookWithContext(
                () => useEmoji('emoji1'),
                makeTestState({
                    entities: {
                        emojis: {
                            customEmoji: {
                                [emoji1.id]: emoji1,
                            },
                        },
                    },
                }),
            );

            expect(result.current).toBe(emoji1);
            expect(dispatchMock).not.toHaveBeenCalled();
        });

        test("should fetch the emoji if it's not in the store", () => {
            const {result} = renderHookWithContext(
                () => useEmoji('emoji1'),
                makeTestState(),
            );

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);
        });

        test("should not fetch the emoji if we've already tried to fetch it", () => {
            const {result} = renderHookWithContext(
                () => useEmoji('emoji1'),
                makeTestState({
                    entities: {
                        emojis: {
                            nonExistentEmoji: new Set(['emoji1']),
                        },
                    },
                }),
            );

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(0);
        });

        test('should only attempt to fetch the emoji once regardless of how many times the hook is used', () => {
            const {result, rerender} = renderHookWithContext(
                () => useEmoji('emoji1'),
                makeTestState(),
            );

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);

            for (let i = 0; i < 10; i++) {
                rerender();
            }

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);
        });

        test('should attempt to fetch different emojis if the name changes', () => {
            let emojiName = 'emoji1';
            const {result, rerender} = renderHookWithContext(
                () => useEmoji(emojiName),
                makeTestState(),
            );

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);

            emojiName = 'emoji2';
            rerender();

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(2);
        });

        test("should only attempt to fetch each emoji once when it isn't loaded", () => {
            let emojiName = 'emoji1';
            const {result, replaceStoreState, rerender} = renderHookWithContext(
                () => useEmoji(emojiName),
                makeTestState(),
            );

            // Initial state without emoji1 loaded
            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);

            // Simulate the response to loading emoji1
            replaceStoreState(makeTestState({
                entities: {
                    emojis: {
                        customEmoji: {
                            [emoji1.id]: emoji1,
                        },
                    },
                },
            }));

            expect(result.current).toBe(emoji1);
            expect(dispatchMock).toHaveBeenCalledTimes(1);

            // Switch to emoji2
            emojiName = 'emoji2';

            rerender();

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(2);

            // Simulate the response to loading emoji2
            replaceStoreState(makeTestState({
                entities: {
                    emojis: {
                        customEmoji: {
                            [emoji1.id]: emoji1,
                            [emoji2.id]: emoji2,
                        },
                    },
                },
            }));

            expect(result.current).toBe(emoji2);
            expect(dispatchMock).toHaveBeenCalledTimes(2);

            // Switch back to emoji1 which has already been loaded
            emojiName = 'emoji1';

            rerender();

            expect(result.current).toBe(emoji1);
            expect(dispatchMock).toHaveBeenCalledTimes(2);
        });

        test("shouldn't attempt to load anything when given an empty emoji name", () => {
            const {result} = renderHookWithContext(
                () => useEmoji(''),
                makeTestState(),
            );

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(0);
        });
    });

    describe('with real dispatch', () => {
        beforeAll(() => {
            Client4.setUrl('http://localhost:8065');
        });

        test("should only attempt to fetch each emoji once when they aren't loaded", async () => {
            const emoji1Mock = nock(Client4.getBaseRoute()).
                post('/emoji/names', [emoji1.name]).
                once().
                reply(200, [emoji1]);
            const emoji2Mock = nock(Client4.getBaseRoute()).
                post('/emoji/names', [emoji2.name]).
                once().
                reply(200, [emoji2]);

            let userId = 'emoji1';
            const {result, rerender} = renderHookWithContext(
                () => useEmoji(userId),
                makeTestState(),
            );

            // Initial state without emoji1 loaded
            expect(result.current).toEqual(undefined);
            expect(emoji1Mock.isDone()).toBe(false);
            expect(emoji2Mock.isDone()).toBe(false);

            // Wait for the response with emoji1
            await waitFor(() => {
                expect(emoji1Mock.isDone()).toBe(true);
                expect(emoji2Mock.isDone()).toBe(false);
                expect(result.current).toEqual(emoji1);
            });

            // Switch to emoji2
            userId = 'emoji2';
            rerender();

            expect(result.current).toEqual(undefined);

            // Wait for the response with emoji2
            await waitFor(() => {
                expect(emoji1Mock.isDone()).toBe(true);
                expect(emoji2Mock.isDone()).toBe(true);
                expect(result.current).toEqual(emoji2);
            });

            // Switch back to emoji1 which has already been loaded
            userId = 'emoji1';
            rerender();

            expect(result.current).toEqual(emoji1);

            // We know there's no second call because nock is set to only mock the first request for each emoji
        });

        test('should batch multiple requests to fetch emojis', async () => {
            const mock = nock(Client4.getBaseRoute()).
                post('/emoji/names', [emoji1.name, emoji2.name]).
                once().
                reply(200, [emoji1, emoji2]);

            const {result} = renderHookWithContext(
                () => {
                    return [
                        useEmoji('emoji1'),
                        useEmoji('emoji2'),
                    ];
                },
                makeTestState(),
            );

            // Initial state without emoji1 loaded
            expect(result.current).toEqual([undefined, undefined]);
            expect(mock.isDone()).toBe(false);

            // Wait for the response
            await waitFor(() => {
                expect(result.current).toEqual([emoji1, emoji2]);
                expect(mock.isDone()).toBe(true);
            });
        });
    });
});
