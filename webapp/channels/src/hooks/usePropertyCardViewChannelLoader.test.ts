// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHookWithContext, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {usePropertyCardViewChannelLoader} from './usePropertyCardViewChannelLoader';

describe('usePropertyCardViewChannelLoader', () => {
    const channel1 = TestHelper.getChannelMock({id: 'channel1'});
    const channel2 = TestHelper.getChannelMock({id: 'channel2'});

    describe('with store channel loading', () => {
        test('should return the channel from store when available and no getChannel provided', () => {
            const {result} = renderHookWithContext(
                () => usePropertyCardViewChannelLoader('channel1'),
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
        });

        test('should return undefined when channel not in store and no getChannel provided', () => {
            const {result} = renderHookWithContext(
                () => usePropertyCardViewChannelLoader('channel1'),
            );

            expect(result.current).toBe(undefined);
        });

        test('should return undefined when no channelId provided', () => {
            const {result} = renderHookWithContext(
                () => usePropertyCardViewChannelLoader(),
            );

            expect(result.current).toBe(undefined);
        });
    });

    describe('with custom getChannel function', () => {
        test('should use getChannel when provided and channel not in store', async () => {
            const getChannelMock = jest.fn().mockResolvedValue(channel1);

            const {result} = renderHookWithContext(
                () => usePropertyCardViewChannelLoader('channel1', getChannelMock),
            );

            expect(result.current).toBe(undefined);
            expect(getChannelMock).toHaveBeenCalledWith('channel1');

            await waitFor(() => {
                expect(result.current).toBe(channel1);
            });
        });

        test('should prefer getChannel over store channel when both available', async () => {
            const mockedChannel1 = TestHelper.getChannelMock({id: 'channel1', display_name: 'Mocked Channel'});
            const getChannelMock = jest.fn().mockResolvedValue(mockedChannel1);

            const {result} = renderHookWithContext(
                () => usePropertyCardViewChannelLoader('channel1', getChannelMock),
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

            await waitFor(() => {
                expect(result.current).toBe(mockedChannel1);
            });

            expect(getChannelMock).toHaveBeenCalledTimes(1);
        });

        test('should handle getChannel errors gracefully', async () => {
            const getChannelMock = jest.fn().mockRejectedValue(new Error('Network error'));
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            const {result} = renderHookWithContext(
                () => usePropertyCardViewChannelLoader('channel1', getChannelMock),
            );

            expect(result.current).toBe(undefined);

            await waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith(
                    'Error occurred while fetching channel for post preview property renderer',
                    expect.any(Error),
                );
            });

            expect(result.current).toBe(undefined);
            consoleSpy.mockRestore();
        });

        test('should only call getChannel once per channelId', async () => {
            const getChannelMock = jest.fn().mockResolvedValue(channel1);

            const {result, rerender} = renderHookWithContext(
                () => usePropertyCardViewChannelLoader('channel1', getChannelMock),
            );

            expect(getChannelMock).toHaveBeenCalledTimes(1);

            await waitFor(() => {
                expect(result.current).toBe(channel1);
            });

            // Rerender multiple times
            for (let i = 0; i < 5; i++) {
                rerender();
            }

            expect(getChannelMock).toHaveBeenCalledTimes(1);
        });

        test('should call getChannel again when channelId changes', async () => {
            const getChannelMock = jest.fn().
                mockResolvedValueOnce(channel1).
                mockResolvedValueOnce(channel2);

            let channelId = 'channel1';
            const {result, rerender} = renderHookWithContext(
                () => usePropertyCardViewChannelLoader(channelId, getChannelMock),
            );

            expect(getChannelMock).toHaveBeenCalledWith('channel1');

            await waitFor(() => {
                expect(result.current).toBe(channel1);
            });

            // Change channelId
            channelId = 'channel2';
            rerender();

            // expect(getChannelMock).toHaveBeenCalledWith('channel2');

            await waitFor(() => {
                expect(result.current).toBe(channel2);
            });

            expect(getChannelMock).toHaveBeenCalledTimes(2);
        });

        test('should not call getChannel when channelId is empty', () => {
            const getChannelMock = jest.fn();

            const {result} = renderHookWithContext(
                () => usePropertyCardViewChannelLoader('', getChannelMock),
            );

            expect(result.current).toBe(undefined);
            expect(getChannelMock).not.toHaveBeenCalled();
        });
    });
});
