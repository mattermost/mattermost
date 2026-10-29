// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import type {ResolvedChannelSidebarSubItem} from 'selectors/channel_sidebar_sub_items';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {RHSStates} from 'utils/constants';

import SidebarChannelSubItems from './sidebar_channel_sub_items';
import {getActiveChannelSidebarSubItemKey} from './use_channel_sidebar_sub_items';

describe('components/sidebar/sidebar_channel/sidebar_channel_sub_items', () => {
    const channel = {id: 'channel_id', name: 'town-square', type: 'O'} as Channel;

    const items: ResolvedChannelSidebarSubItem[] = [
        {key: 'plugin:a', pluginId: 'plugin', id: 'a', label: 'Board view', subpath: 'views/a', iconName: 'view-grid-plus-outline'},
        {key: 'plugin:b', pluginId: 'plugin', id: 'b', label: 'Table view', subpath: 'views/a/table'},
        {key: 'plugin:c', pluginId: 'plugin', id: 'c', label: 'Calendar', subpath: 'calendar'},
    ];

    const baseProps = {
        id: 'sidebarSubItems_channel_id',
        channel,
        currentTeamName: 'team',
        items,
    };

    const renderItems = (props: Partial<React.ComponentProps<typeof SidebarChannelSubItems>> = {}, state = {}, path = '/team/channels/town-square') => {
        const history = createMemoryHistory({initialEntries: [path]});
        const result = renderWithContext(
            <SidebarChannelSubItems
                {...baseProps}
                {...props}
            />,
            state,
            {history},
        );
        return {...result, history};
    };

    test('renders a list with a link per item', () => {
        renderItems();

        const list = screen.getByRole('list');
        expect(list).toHaveAttribute('id', 'sidebarSubItems_channel_id');

        expect(screen.getAllByRole('listitem')).toHaveLength(3);
        expect(screen.getByRole('link', {name: 'Board view'})).toHaveAttribute('href', '/team/channels/town-square/views/a');
        expect(screen.getByRole('link', {name: 'Table view'})).toHaveAttribute('href', '/team/channels/town-square/views/a/table');
        expect(screen.getByRole('link', {name: 'Calendar'})).toHaveAttribute('href', '/team/channels/town-square/calendar');
    });

    test('renders the icon only for items with an icon name', () => {
        renderItems();

        const icon = screen.getByRole('link', {name: 'Board view'}).querySelector('i');
        expect(icon).toHaveClass('icon', 'icon-view-grid-plus-outline', 'SidebarChannelSubItem__icon');
        expect(icon).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByRole('link', {name: 'Table view'}).querySelector('i')).not.toBeInTheDocument();
    });

    test('does not use the channel link class so channel active styles do not apply', () => {
        const {container} = renderItems();

        expect(container.querySelector('.SidebarLink')).not.toBeInTheDocument();
        expect(container.querySelectorAll('.SidebarChannelSubItem__link')).toHaveLength(3);
        expect(container.querySelectorAll('.SidebarChannelSubItem__label')).toHaveLength(3);
    });

    test('marks only the active item as the current page', () => {
        renderItems({activeKey: 'plugin:b'});

        expect(screen.getByRole('link', {name: 'Table view'})).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('link', {name: 'Board view'})).not.toHaveAttribute('aria-current');
        expect(screen.getByRole('link', {name: 'Calendar'})).not.toHaveAttribute('aria-current');
        expect(screen.getByRole('link', {name: 'Table view'}).closest('li')).toHaveClass('active');
    });

    test('has no current page when no item is active', () => {
        renderItems();

        expect(screen.queryByRole('link', {current: 'page'})).not.toBeInTheDocument();
    });

    test('navigates to the sub-item when clicked', async () => {
        const {history} = renderItems();

        await userEvent.click(screen.getByRole('link', {name: 'Calendar'}));

        expect(history.location.pathname).toBe('/team/channels/town-square/calendar');
    });

    test('clears the multi-selection when clicked', async () => {
        const {store} = renderItems({}, {
            views: {channelSidebar: {multiSelectedChannelIds: ['channel_id', 'other']}},
        });

        await userEvent.click(screen.getByRole('link', {name: 'Calendar'}));

        expect(store.getState().views.channelSidebar.multiSelectedChannelIds).toEqual([]);
    });

    test('closes the edit history sidebar when clicked', async () => {
        const {store} = renderItems({}, {
            views: {rhs: {isSidebarOpen: true, rhsState: RHSStates.EDIT_HISTORY}},
        });

        await userEvent.click(screen.getByRole('link', {name: 'Calendar'}));

        expect(store.getState().views.rhs.rhsState).toBeNull();
    });

    test('leaves other sidebar states open when clicked', async () => {
        const {store} = renderItems({}, {
            views: {rhs: {isSidebarOpen: true, rhsState: RHSStates.PIN}},
        });

        await userEvent.click(screen.getByRole('link', {name: 'Calendar'}));

        expect(store.getState().views.rhs.rhsState).toBe(RHSStates.PIN);
    });

    describe('getActiveChannelSidebarSubItemKey', () => {
        const active = (pathname: string) => getActiveChannelSidebarSubItemKey(items, pathname, 'team', 'town-square');

        test('matches the exact link', () => {
            expect(active('/team/channels/town-square/calendar')).toBe('plugin:c');
        });

        test('matches paths nested below the link', () => {
            expect(active('/team/channels/town-square/calendar/2026/10')).toBe('plugin:c');
        });

        test('prefers the longest matching link', () => {
            expect(active('/team/channels/town-square/views/a/table')).toBe('plugin:b');
            expect(active('/team/channels/town-square/views/a/table/row/1')).toBe('plugin:b');
            expect(active('/team/channels/town-square/views/a')).toBe('plugin:a');
            expect(active('/team/channels/town-square/views/a/other')).toBe('plugin:a');
        });

        test('does not match on a partial path segment', () => {
            expect(active('/team/channels/town-square/calendars')).toBeUndefined();
        });

        test('does not match the channel root, other channels or other teams', () => {
            expect(active('/team/channels/town-square')).toBeUndefined();
            expect(active('/team/channels/off-topic/calendar')).toBeUndefined();
            expect(active('/other/channels/town-square/calendar')).toBeUndefined();
        });
    });
});
