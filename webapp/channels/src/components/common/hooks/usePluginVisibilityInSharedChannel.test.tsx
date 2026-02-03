// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook} from '@testing-library/react';
import React from 'react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';

import {usePluginVisibilityInSharedChannel} from './usePluginVisibilityInSharedChannel';

jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    getChannel: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/general', () => ({
    getFeatureFlagValue: jest.fn(),
}));

describe('usePluginVisibilityInSharedChannel', () => {
    const mockStore = configureStore();
    const mockGetChannel = getChannel as jest.MockedFunction<typeof getChannel>;
    const mockGetFeatureFlagValue = getFeatureFlagValue as jest.MockedFunction<typeof getFeatureFlagValue>;

    beforeEach(() => {
        mockGetFeatureFlagValue.mockReturnValue('false');
        mockGetChannel.mockReturnValue(undefined);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const renderHookWithChannelId = (channelId: string | undefined) => {
        const store = mockStore({});
        const wrapper = ({children}: {children: React.ReactNode}) => (
            <Provider store={store}>{children}</Provider>
        );

        return renderHook(() => usePluginVisibilityInSharedChannel(channelId), {wrapper});
    };

    test('should return true when channelId is undefined', () => {
        const {result} = renderHookWithChannelId(undefined);
        expect(result.current).toBe(true);
    });

    test('should return true when channel is not found', () => {
        mockGetChannel.mockReturnValue(undefined);
        const {result} = renderHookWithChannelId('channel-id-1');
        expect(result.current).toBe(true);
    });

    test('should return true for non-shared channels regardless of feature flag', () => {
        mockGetChannel.mockReturnValue({
            id: 'channel-id-1',
            shared: false,
        } as any);

        const {result} = renderHookWithChannelId('channel-id-1');
        expect(result.current).toBe(true);
    });

    test('should return false for shared channels when feature flag is disabled', () => {
        mockGetChannel.mockReturnValue({
            id: 'channel-id-1',
            shared: true,
        } as any);

        const {result} = renderHookWithChannelId('channel-id-1');
        expect(result.current).toBe(false);
    });

    test('should return true for shared channels when feature flag is enabled', () => {
        mockGetChannel.mockReturnValue({
            id: 'channel-id-1',
            shared: true,
        } as any);
        mockGetFeatureFlagValue.mockReturnValue('true');

        const {result} = renderHookWithChannelId('channel-id-1');
        expect(result.current).toBe(true);
    });

    test('should return true for non-shared channels when feature flag is enabled', () => {
        mockGetChannel.mockReturnValue({
            id: 'channel-id-1',
            shared: false,
        } as any);
        mockGetFeatureFlagValue.mockReturnValue('true');

        const {result} = renderHookWithChannelId('channel-id-1');
        expect(result.current).toBe(true);
    });

    test('should handle channels without shared property', () => {
        mockGetChannel.mockReturnValue({
            id: 'channel-id-1',

            // no shared property - should default to false
        } as any);

        const {result} = renderHookWithChannelId('channel-id-1');
        expect(result.current).toBe(true);
    });
});
