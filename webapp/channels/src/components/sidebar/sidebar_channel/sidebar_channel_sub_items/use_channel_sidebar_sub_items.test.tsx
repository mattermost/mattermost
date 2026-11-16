// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';

import type {Channel} from '@mattermost/types/channels';

import {act, renderHookWithContext} from 'tests/react_testing_utils';

import {useChannelSidebarSubItems} from './use_channel_sidebar_sub_items';

// The global mock replaces useHistory, but these tests navigate a real memory history.
jest.mock('react-router-dom', () => jest.requireActual('react-router-dom'));

describe('useChannelSidebarSubItems', () => {
    const channel = {id: 'channel_id', name: 'town-square', type: 'O'} as Channel;

    const stateWithItems = (getItems = jest.fn(() => [
        {id: 'a', label: 'Board view', subpath: 'views/a'},
        {id: 'b', label: 'Table view', subpath: 'views/b'},
    ])) => ({
        plugins: {
            components: {
                ChannelSidebarSubItems: [{id: 'reg', pluginId: 'plugin', getItems}],
            },
        },
    });

    function renderSubItemsHook(state = {}, path = '/team/channels/town-square') {
        const history = createMemoryHistory({initialEntries: [path]});
        const renders = {count: 0};
        const result = renderHookWithContext(() => {
            renders.count++;
            return useChannelSidebarSubItems(channel, 'team');
        }, state, {history});
        return {...result, history, renders};
    }

    test('does not re-render on navigation when the channel has no sub-items', () => {
        const {history, renders, result} = renderSubItemsHook();
        const rendersBeforeNavigation = renders.count;

        act(() => {
            history.push('/team/channels/town-square/views/a');
            history.push('/team/channels/other');
        });

        expect(renders.count).toBe(rendersBeforeNavigation);
        expect(result.current.items).toHaveLength(0);
        expect(result.current.activeKey).toBeUndefined();
    });

    test('tracks navigation when the channel has sub-items', () => {
        const {history, result} = renderSubItemsHook(stateWithItems());
        expect(result.current.items).toHaveLength(2);
        expect(result.current.activeKey).toBeUndefined();

        act(() => {
            history.push('/team/channels/town-square/views/b');
        });
        expect(result.current.activeKey).toBe('plugin:b');

        act(() => {
            history.push('/team/channels/town-square');
        });
        expect(result.current.activeKey).toBeUndefined();
    });

    test('starts tracking navigation once sub-items appear', () => {
        const {history, replaceStoreState, result} = renderSubItemsHook(stateWithItems(jest.fn(() => [])), '/team/channels/town-square/views/a');
        expect(result.current.items).toHaveLength(0);
        expect(result.current.activeKey).toBeUndefined();

        replaceStoreState(stateWithItems(jest.fn(() => [{id: 'a', label: 'Board view', subpath: 'views/a'}])));
        expect(result.current.activeKey).toBe('plugin:a');

        act(() => {
            history.push('/team/channels/town-square');
        });
        expect(result.current.activeKey).toBeUndefined();
    });

    test('keeps the same items array when the state changes without changing the items', () => {
        const getItems = () => [{id: 'a', label: 'Board view', subpath: 'views/a'}];
        const {replaceStoreState, result} = renderSubItemsHook(stateWithItems(jest.fn(getItems)));
        const items = result.current.items;

        replaceStoreState(stateWithItems(jest.fn(getItems)));

        expect(result.current.items).toBe(items);
    });
});
