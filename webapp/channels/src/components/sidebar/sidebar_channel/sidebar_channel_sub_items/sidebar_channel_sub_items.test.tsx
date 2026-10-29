// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import type {ResolvedChannelSidebarSubItem} from 'selectors/channel_sidebar_sub_items';

import {renderWithContext, screen, userEvent, within} from 'tests/react_testing_utils';
import {RHSStates, StoragePrefixes} from 'utils/constants';

import SidebarChannelSubItems from './sidebar_channel_sub_items';
import {getActiveChannelSidebarSubItemKey} from './use_channel_sidebar_sub_items';

describe('components/sidebar/sidebar_channel/sidebar_channel_sub_items', () => {
    const channel = {id: 'channel_id', name: 'town-square', type: 'O'} as Channel;

    const items: ResolvedChannelSidebarSubItem[] = [
        {key: 'plugin:a', pluginId: 'plugin', registrationId: 'reg', id: 'a', label: 'Board view', subpath: 'views/a', iconName: 'view-grid-plus-outline', depth: 0, hasChildren: false, draggable: false},
        {key: 'plugin:b', pluginId: 'plugin', registrationId: 'reg', id: 'b', label: 'Table view', subpath: 'views/a/table', depth: 0, hasChildren: false, draggable: false},
        {key: 'plugin:c', pluginId: 'plugin', registrationId: 'reg', id: 'c', label: 'Calendar', subpath: 'calendar', depth: 0, hasChildren: false, draggable: false},
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

    describe('nesting', () => {
        const makeItem = (id: string, label: string, depth: number, parentKey?: string, hasChildren = false): ResolvedChannelSidebarSubItem => ({
            key: `plugin:${id}`,
            pluginId: 'plugin',
            registrationId: 'reg',
            id,
            label,
            subpath: `pages/${id}`,
            parentKey,
            depth,
            hasChildren,
            draggable: false,
        });

        // Root > (Child > Grandchild, Sibling), Other root
        const tree: ResolvedChannelSidebarSubItem[] = [
            makeItem('root', 'Root', 0, undefined, true),
            makeItem('child', 'Child', 1, 'plugin:root', true),
            makeItem('grandchild', 'Grandchild', 2, 'plugin:child'),
            makeItem('sibling', 'Sibling', 1, 'plugin:root'),
            makeItem('other', 'Other root', 0),
        ];

        const expandedKey = (itemKey: string) => `${StoragePrefixes.CHANNEL_SIDEBAR_SUB_ITEM_EXPANDED}user_id_team_id_channel_id_${itemKey}`;
        const stored = (...itemKeys: string[]) => ({
            entities: {
                users: {currentUserId: 'user_id'},
                teams: {currentTeamId: 'team_id'},
            },
            storage: {storage: Object.fromEntries(itemKeys.map((key) => [expandedKey(key), {value: true, timestamp: new Date()}]))},
        });

        const toggleFor = (label: string) => screen.getByRole('button', {name: new RegExp(`^(Expand|Collapse) ${label}$`)});

        test('shows only root items and collapsed chevrons by default', () => {
            renderItems({items: tree}, stored());

            expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Root', 'Other root']);
            expect(toggleFor('Root')).toHaveAccessibleName('Expand Root');
            expect(toggleFor('Root')).toHaveAttribute('aria-expanded', 'false');
            expect(toggleFor('Root')).toHaveAttribute('aria-controls', 'sidebarSubItems_channel_id_plugin:root');
            expect(toggleFor('Root').querySelector('i')).toHaveClass('icon-chevron-right');
            expect(screen.getAllByRole('button')).toHaveLength(1);
        });

        test('renders children in a nested list inside the parent item', async () => {
            const {container} = renderItems({items: tree}, stored());

            await userEvent.click(toggleFor('Root'));

            expect(toggleFor('Root')).toHaveAccessibleName('Collapse Root');
            expect(toggleFor('Root')).toHaveAttribute('aria-expanded', 'true');
            expect(toggleFor('Root').querySelector('i')).toHaveClass('icon-chevron-down');

            const nested = container.querySelector('#sidebarSubItems_channel_id_plugin\\:root')!;
            expect(nested).toBeInTheDocument();
            expect(nested.tagName).toBe('UL');
            expect(nested.closest('li')).toBe(screen.getByRole('link', {name: 'Root'}).closest('li'));
            expect(within(nested as HTMLElement).getAllByRole('link').map((link) => link.textContent)).toEqual(['Child', 'Sibling']);
            expect(screen.queryByRole('link', {name: 'Grandchild'})).not.toBeInTheDocument();
        });

        test('persists the expanded state per item key', async () => {
            const {store} = renderItems({items: tree}, stored());

            await userEvent.click(toggleFor('Root'));
            await userEvent.click(toggleFor('Child'));

            expect(store.getState().storage.storage[expandedKey('plugin:root')].value).toBe(true);
            expect(store.getState().storage.storage[expandedKey('plugin:child')].value).toBe(true);
            expect(screen.getByRole('link', {name: 'Grandchild'})).toBeInTheDocument();

            await userEvent.click(toggleFor('Root'));

            expect(store.getState().storage.storage[expandedKey('plugin:root')].value).toBe(false);
            expect(store.getState().storage.storage[expandedKey('plugin:child')].value).toBe(true);
            expect(screen.queryByRole('link', {name: 'Child'})).not.toBeInTheDocument();
            expect(screen.queryByRole('link', {name: 'Grandchild'})).not.toBeInTheDocument();
        });

        test('starts expanded from the persisted state', () => {
            renderItems({items: tree}, stored('plugin:root', 'plugin:child'));

            expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Root', 'Child', 'Grandchild', 'Sibling', 'Other root']);
            expect(toggleFor('Root')).toHaveAttribute('aria-expanded', 'true');
            expect(toggleFor('Child')).toHaveAttribute('aria-expanded', 'true');
        });

        test('keeps a descendant expanded state while its ancestor is collapsed', () => {
            renderItems({items: tree}, stored('plugin:child'));

            expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Root', 'Other root']);
        });

        test('uses the depth for indentation', () => {
            const {container} = renderItems({items: tree}, stored('plugin:root', 'plugin:child'));

            const depths = Array.from(container.querySelectorAll<HTMLElement>('.SidebarChannelSubItem__row')).map((row) => row.style.getPropertyValue('--sub-item-depth'));
            expect(depths).toEqual(['0', '1', '2', '1', '0']);
        });

        test('does not render a chevron for items without children', () => {
            renderItems({items: tree}, stored('plugin:root', 'plugin:child'));

            expect(screen.queryByRole('button', {name: /Grandchild|Sibling|Other root/})).not.toBeInTheDocument();
        });

        test('toggling does not navigate', async () => {
            const {history} = renderItems({items: tree}, stored());

            await userEvent.click(toggleFor('Root'));

            expect(history.location.pathname).toBe('/team/channels/town-square');
        });

        test('marks the active nested item', () => {
            renderItems({items: tree, activeKey: 'plugin:grandchild'}, stored('plugin:root', 'plugin:child'), '/team/channels/town-square/pages/grandchild');

            expect(screen.getByRole('link', {name: 'Grandchild'})).toHaveAttribute('aria-current', 'page');
            expect(screen.getByRole('link', {name: 'Grandchild'}).closest('li')).toHaveClass('active');
            expect(screen.getByRole('link', {name: 'Child'}).closest('li')).not.toHaveClass('active');
        });

        test('marks the nearest collapsed ancestor of the active item', () => {
            renderItems({items: tree, activeKey: 'plugin:grandchild'}, stored('plugin:root'));

            expect(screen.getByRole('link', {name: 'Child'}).closest('li')).toHaveClass('containsActive');
            expect(screen.getByRole('link', {name: 'Root'}).closest('li')).not.toHaveClass('containsActive');
            expect(screen.getByRole('link', {name: 'Sibling'}).closest('li')).not.toHaveClass('containsActive');
        });

        test('does not mark expanded ancestors of the active item', () => {
            renderItems({items: tree, activeKey: 'plugin:grandchild'}, stored('plugin:root', 'plugin:child'));

            expect(document.querySelector('.containsActive')).not.toBeInTheDocument();
        });
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
