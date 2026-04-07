// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';
import * as ReactRedux from 'react-redux';

import {Client4} from 'mattermost-redux/client';

import {renderHookWithContext, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {useChannel} from './useChannel';

jest.mock('react-redux', () => ({
    __esModule: true,
    ...jest.requireActual('react-redux'),
}));

describe('useChannel', () => {
    const channel1 = TestHelper.getChannelMock({id: 'channel1'});
    const channel2 = TestHelper.getChannelMock({id: 'channel2'});

    describe('with fake dispatch', () => {
        const dispatchMock = jest.fn();

        beforeAll(() => {
            jest.spyOn(ReactRedux, 'useDispatch').mockImplementation(() => dispatchMock);
        });

        afterAll(() => {
            jest.restoreAllMocks();
        });

        test("should return the channel if it's already in the store", async () => {
            const {result} = await renderHookWithContext(
                () => useChannel('channel1'),
                {
                    entities: {
                        channels: {
                            channels: {
                                channel1,
                            },
                        },
                    },
                },
            );

            expect(result.current).toBe(channel1);
            expect(dispatchMock).not.toHaveBeenCalled();
        });

        test("should fetch the channel if it's not in the store", async () => {
            const {result} = await renderHookWithContext(
                () => useChannel('channel1'),
            );

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);
        });

        test('should only attempt to fetch the channel once regardless of how many times the hook is used', async () => {
            const {result, rerender} = await renderHookWithContext(
                () => useChannel('channel1'),
            );

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);

            for (let i = 0; i < 10; i++) {
                rerender();
            }

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);
        });

        test('should attempt to fetch different channels if the channel ID changes', async () => {
            let channelId = 'channel1';
            const {result, rerender} = await renderHookWithContext(
                () => useChannel(channelId),
            );

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);

            channelId = 'channel2';
            rerender();

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(2);
        });

        test("should only attempt to fetch each channel once when they aren't loaded", async () => {
            let channelId = 'channel1';
            const {result, replaceStoreState, rerender} = await renderHookWithContext(
                () => useChannel(channelId),
            );

            // Initial state without channel1 loaded
            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);

            // Simulate the response to loading channel1
            replaceStoreState({
                entities: {
                    channels: {
                        channels: {
                            channel1,
                        },
                    },
                },
            });

            expect(result.current).toBe(channel1);
            expect(dispatchMock).toHaveBeenCalledTimes(1);

            // Switch to channel2
            channelId = 'channel2';

            rerender();

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(2);

            // Simulate the response to loading channel2
            replaceStoreState({
                entities: {
                    channels: {
                        channels: {
                            channel1,
                            channel2,
                        },
                    },
                },
            });

            expect(result.current).toBe(channel2);
            expect(dispatchMock).toHaveBeenCalledTimes(2);

            // Switch back to channel1 which has already been loaded
            channelId = 'channel1';

            rerender();

            expect(result.current).toBe(channel1);
            expect(dispatchMock).toHaveBeenCalledTimes(2);
        });

        test("shouldn't attempt to load anything when given an empty channel ID", async () => {
            const {result} = await renderHookWithContext(
                () => useChannel(''),
            );

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(0);
        });
    });

    describe('with real dispatch', () => {
        beforeAll(() => {
            Client4.setUrl('http://localhost:8065');
        });

        test("should only attempt to fetch each channel once when they aren't loaded", async () => {
            const channel1Mock = nock(Client4.getBaseRoute()).
                get(`/channels/${channel1.id}`).
                once().
                reply(200, channel1);
            const channel2Mock = nock(Client4.getBaseRoute()).
                get(`/channels/${channel2.id}`).
                once().
                reply(200, channel2);

            let channelId = 'channel1';
            const {result, rerender} = await renderHookWithContext(
                () => useChannel(channelId),
            );

            // Initial state without channel1 loaded
            expect(result.current).toEqual(undefined);
            expect(channel1Mock.isDone()).toBe(false);
            expect(channel2Mock.isDone()).toBe(false);

            // Wait for the response with channel1
            await waitFor(() => {
                expect(channel1Mock.isDone()).toBe(true);
                expect(channel2Mock.isDone()).toBe(false);
                expect(result.current).toEqual(channel1);
            });

            // Switch to channel2
            channelId = 'channel2';
            rerender();

            expect(result.current).toEqual(undefined);

            // Wait for the response with channel2
            await waitFor(() => {
                expect(channel1Mock.isDone()).toBe(true);
                expect(channel2Mock.isDone()).toBe(true);
                expect(result.current).toEqual(channel2);
            });

            // Switch back to channel1 which has already been loaded
            channelId = 'channel1';
            rerender();

            expect(result.current).toEqual(channel1);
        });
    });
});
