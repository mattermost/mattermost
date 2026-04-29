// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook, act, waitFor} from '@testing-library/react';
import React from 'react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';
import {thunk} from 'redux-thunk';

import {invalidateAccessControlAttributesCache, useAccessControlAttributes, EntityType} from './useAccessControlAttributes';

// Mock the getChannelAccessControlAttributes action
jest.mock('mattermost-redux/actions/channels', () => {
    const mockFn = jest.fn();

    // Default implementation
    mockFn.mockImplementation((channelId) => {
        if (channelId === 'error-channel') {
            return () => Promise.resolve({error: new Error('Failed to fetch attributes')});
        }

        if (channelId === 'unsupported') {
            throw new Error('Unsupported entity type: unsupported');
        }

        return () => Promise.resolve({
            data: {
                department: ['engineering', 'marketing'],
                location: ['remote'],
            },
        });
    });

    return {
        getChannelAccessControlAttributes: mockFn,
    };
});

describe('useAccessControlAttributes', () => {
    const mockStore = configureStore([thunk]);
    const initialState = {
        entities: {
            channels: {
                channels: {
                    'channel-1': {
                        id: 'channel-1',
                        policy_enforced: true,
                    },
                },
            },
        },
    };
    const store = mockStore(initialState);

    // Helper function to wrap the hook with the Redux provider
    const wrapper = ({children}: {children: React.ReactNode}) => (
        <Provider store={store}>
            {children}
        </Provider>
    );

    test('should return initial state', () => {
        const {result} = renderHook(() => useAccessControlAttributes(EntityType.Channel, undefined, undefined), {wrapper});

        expect(result.current.attributeTags).toEqual([]);
        expect(result.current.structuredAttributes).toEqual([]);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe(null);
    });

    test('should not fetch attributes if entityId is undefined', async () => {
        const {result} = renderHook(() => useAccessControlAttributes(EntityType.Channel, undefined, true), {wrapper});

        await act(async () => {
            await result.current.fetchAttributes();
        });

        expect(result.current.attributeTags).toEqual([]);
        expect(result.current.structuredAttributes).toEqual([]);
        expect(result.current.loading).toBe(false);
    });

    test('should not fetch attributes if hasAccessControl is false', async () => {
        const {result} = renderHook(() => useAccessControlAttributes(EntityType.Channel, 'channel-1', false), {wrapper});

        await act(async () => {
            await result.current.fetchAttributes();
        });

        expect(result.current.attributeTags).toEqual([]);
        expect(result.current.structuredAttributes).toEqual([]);
        expect(result.current.loading).toBe(false);
    });

    test('clears attribute state when hasAccessControl becomes false after data was loaded', async () => {
        const {result, rerender, unmount} = renderHook(
            ({hasAC}: {hasAC: boolean}) => useAccessControlAttributes(EntityType.Channel, 'channel-1', hasAC),
            {initialProps: {hasAC: true}, wrapper},
        );

        await waitFor(() => {
            expect(result.current.attributeTags).toEqual(['engineering', 'marketing', 'remote']);
        });

        rerender({hasAC: false});
        await act(async () => {
            await result.current.fetchAttributes();
        });

        expect(result.current.attributeTags).toEqual([]);
        expect(result.current.structuredAttributes).toEqual([]);

        unmount();
        invalidateAccessControlAttributesCache(EntityType.Channel, 'channel-1');
    });

    test('should fetch and process attributes successfully', async () => {
        const {result} = renderHook(() => useAccessControlAttributes(EntityType.Channel, 'channel-1', true), {wrapper});

        // Initial state
        expect(result.current.loading).toBe(true);

        // Wait for the hook to finish fetching and check the final state
        await waitFor(() => {
            expect(result.current.attributeTags).toEqual(['engineering', 'marketing', 'remote']);
            expect(result.current.structuredAttributes).toEqual([
                {name: 'department', values: ['engineering', 'marketing']},
                {name: 'location', values: ['remote']},
            ]);
            expect(result.current.loading).toBe(false);
            expect(result.current.error).toBe(null);
        });
    });

    test('should handle errors when fetching attributes', async () => {
        const {result} = renderHook(() => useAccessControlAttributes(EntityType.Channel, 'error-channel', true), {wrapper});

        // Initial state
        expect(result.current.loading).toBe(true);

        // Wait for the hook to finish fetching and check the final state
        await waitFor(() => {
            expect(result.current.attributeTags).toEqual([]);
            expect(result.current.structuredAttributes).toEqual([]);
            expect(result.current.loading).toBe(false);
            expect(result.current.error).toBeInstanceOf(Error);
            expect(result.current.error?.message).toBe('Failed to fetch attributes');
        });
    });

    test('should handle unsupported entity types', async () => {
        // @ts-expect-error - Testing invalid entity type
        const {result} = renderHook(() => useAccessControlAttributes('unsupported', 'channel-1', true), {wrapper});

        // Manually call fetchAttributes to trigger the error
        await act(async () => {
            // Set loading to true manually for the test
            result.current.loading = true;
            try {
                await result.current.fetchAttributes();
            } catch (error) {
                // Ignore the error
            }
        });

        // Check the final state
        expect(result.current.attributeTags).toEqual([]);
        expect(result.current.structuredAttributes).toEqual([]);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.error?.message).toBe('Unsupported entity type: unsupported');
    });

    test('should use cached data if available and not expired', async () => {
        // First call to populate the cache
        const {result: result1} = renderHook(() => useAccessControlAttributes(EntityType.Channel, 'channel-1', true), {wrapper});

        // Wait for the initial fetch to complete
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
        });

        // Verify the data was loaded
        expect(result1.current.attributeTags).toEqual(['engineering', 'marketing', 'remote']);
        expect(result1.current.loading).toBe(false);

        // Reset the mock to track new calls
        const getChannelAccessControlAttributes = require('mattermost-redux/actions/channels').getChannelAccessControlAttributes;
        getChannelAccessControlAttributes.mockClear();

        // Second call should use the cache
        const {result: result2} = renderHook(() => useAccessControlAttributes(EntityType.Channel, 'channel-1', true), {wrapper});

        // Wait for any async operations to complete
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
        });

        // Check that the data is the same
        expect(result2.current.attributeTags).toEqual(result1.current.attributeTags);
        expect(result2.current.structuredAttributes).toEqual(result1.current.structuredAttributes);

        // The action should not have been called again
        expect(getChannelAccessControlAttributes).not.toHaveBeenCalled();
    });

    test('should manually fetch attributes when fetchAttributes is called', async () => {
        const {result} = renderHook(() => useAccessControlAttributes(EntityType.Channel, 'channel-1', true), {wrapper});

        // Wait for the initial fetch to complete
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        // Reset the mock to track new calls
        const getChannelAccessControlAttributes = require('mattermost-redux/actions/channels').getChannelAccessControlAttributes;
        getChannelAccessControlAttributes.mockClear();

        // Manually fetch attributes with forceRefresh=true to bypass cache
        await act(async () => {
            await result.current.fetchAttributes(true);
        });

        // The action should have been called again
        expect(getChannelAccessControlAttributes).toHaveBeenCalledWith('channel-1');
    });

    test('invalidateAccessControlAttributesCache forces a refresh on next read', async () => {
        // Prime the cache with a first fetch.
        const {result: result1, unmount} = renderHook(() => useAccessControlAttributes(EntityType.Channel, 'channel-1', true), {wrapper});

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
        });
        expect(result1.current.structuredAttributes).toEqual([
            {name: 'department', values: ['engineering', 'marketing']},
            {name: 'location', values: ['remote']},
        ]);

        // Unmount the first hook so its listener subscription doesn't trigger
        // an extra fetch when we invalidate below — this test specifically
        // verifies that the *next* mount sees fresh data after invalidation.
        unmount();

        const getChannelAccessControlAttributes = require('mattermost-redux/actions/channels').getChannelAccessControlAttributes;
        getChannelAccessControlAttributes.mockClear();

        // After invalidating the cache the next mount should hit the action again.
        invalidateAccessControlAttributesCache(EntityType.Channel, 'channel-1');

        const {result: result2} = renderHook(() => useAccessControlAttributes(EntityType.Channel, 'channel-1', true), {wrapper});
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
        });

        expect(getChannelAccessControlAttributes).toHaveBeenCalledWith('channel-1');
        expect(result2.current.structuredAttributes).toEqual(result1.current.structuredAttributes);
    });

    test('should re-fetch when the cache is invalidated for the entity', async () => {
        renderHook(() => useAccessControlAttributes(EntityType.Channel, 'channel-1', true), {wrapper});

        // Wait for the initial fetch to complete and prime the cache
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        const getChannelAccessControlAttributes = require('mattermost-redux/actions/channels').getChannelAccessControlAttributes;
        getChannelAccessControlAttributes.mockClear();

        await act(async () => {
            invalidateAccessControlAttributesCache(EntityType.Channel, 'channel-1');
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(getChannelAccessControlAttributes).toHaveBeenCalledWith('channel-1');
    });

    test('should not re-fetch when the cache is invalidated for a different entity', async () => {
        renderHook(() => useAccessControlAttributes(EntityType.Channel, 'channel-1', true), {wrapper});

        // Wait for the initial fetch to complete and prime the cache
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        const getChannelAccessControlAttributes = require('mattermost-redux/actions/channels').getChannelAccessControlAttributes;
        getChannelAccessControlAttributes.mockClear();

        await act(async () => {
            invalidateAccessControlAttributesCache(EntityType.Channel, 'channel-2');
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(getChannelAccessControlAttributes).not.toHaveBeenCalled();
    });

    test('should re-fetch all mounted hooks when cache is fully cleared', async () => {
        renderHook(() => useAccessControlAttributes(EntityType.Channel, 'channel-1', true), {wrapper});

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        const getChannelAccessControlAttributes = require('mattermost-redux/actions/channels').getChannelAccessControlAttributes;
        getChannelAccessControlAttributes.mockClear();

        await act(async () => {
            invalidateAccessControlAttributesCache();
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(getChannelAccessControlAttributes).toHaveBeenCalledWith('channel-1');
    });
});
