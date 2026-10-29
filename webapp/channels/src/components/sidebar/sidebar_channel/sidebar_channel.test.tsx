// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DragDropContext, Droppable} from '@hello-pangea/dnd';
import {createMemoryHistory} from 'history';
import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import SidebarChannel from 'components/sidebar/sidebar_channel/sidebar_channel';

import {act, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {StoragePrefixes} from 'utils/constants';

jest.mock('components/tours/onboarding_tour', () => ({
    ChannelsAndDirectMessagesTour: () => null,
}));

jest.mock('components/sidebar/sidebar_channel/sidebar_direct_channel', () => () => <div>{'Direct Channel'}</div>);
jest.mock('components/sidebar/sidebar_channel/sidebar_group_channel', () => () => <div>{'Group Channel'}</div>);

describe('components/sidebar/sidebar_channel', () => {
    const baseProps = {
        channel: {
            id: 'channel_id',
            display_name: 'channel_display_name',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            team_id: '',
            type: 'O' as ChannelType,
            name: '',
            header: '',
            purpose: '',
            last_post_at: 0,
            last_root_post_at: 0,
            creator_id: '',
            scheme_id: '',
            group_constrained: false,
        },
        channelId: 'channel_id',
        isDraggable: false,
        channelIndex: 0,
        currentTeamName: 'team_name',
        unreadMentions: 0,
        isUnread: false,
        setChannelRef: jest.fn(),
        isCategoryCollapsed: false,
        isCurrentChannel: false,
        isAutoSortedCategory: false,
        isCategoryDragged: false,
        isDropDisabled: false,
        draggingState: {},
        multiSelectedChannelIds: [],
        autoSortedCategoryIds: new Set<string>(),
        isChannelSelected: false,
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <SidebarChannel {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when collapsed', () => {
        const props = {
            ...baseProps,
            isCategoryCollapsed: true,
        };

        const {container} = renderWithContext(
            <SidebarChannel {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when unread', () => {
        const props = {
            ...baseProps,
            isUnread: true,
            unreadMentions: 1,
        };

        const {container} = renderWithContext(
            <SidebarChannel {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when active', () => {
        const props = {
            ...baseProps,
            isCurrentChannel: true,
        };

        const {container} = renderWithContext(
            <SidebarChannel {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when DM channel', () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                type: 'D' as ChannelType,
            },
        };

        const {container} = renderWithContext(
            <SidebarChannel {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when GM channel', () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                type: 'G' as ChannelType,
            },
        };

        const {container} = renderWithContext(
            <SidebarChannel {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should not be collapsed when there are unread messages', () => {
        const props = {
            ...baseProps,
            isCategoryCollapsed: true,
            isUnread: true,
        };

        renderWithContext(
            <SidebarChannel {...props}/>,
        );

        expect(screen.getByRole('listitem')).toHaveClass('expanded');
    });

    test('should not be collapsed if channel is current channel', () => {
        const props = {
            ...baseProps,
            isCategoryCollapsed: true,
            isCurrentChannel: true,
        };

        renderWithContext(
            <SidebarChannel {...props}/>,
        );

        expect(screen.getByRole('listitem')).toHaveClass('expanded');
    });

    describe('plugin sub-items', () => {
        const channel = {...baseProps.channel, name: 'town-square'};
        const storageKey = `${StoragePrefixes.CHANNEL_SIDEBAR_SUB_ITEMS_EXPANDED}user_id_team_id_channel_id`;

        const items = [
            {id: 'a', label: 'Board view', subpath: 'views/a', iconName: 'view-grid-plus-outline'},
            {id: 'b', label: 'Table view', subpath: 'views/b'},
        ];

        const makeState = (extra: Record<string, unknown> = {}, subItems: unknown[] = items) => ({
            entities: {
                users: {currentUserId: 'user_id'},
                teams: {currentTeamId: 'team_id'},
            },
            plugins: {
                components: {
                    ChannelSidebarSubItems: [{id: 'reg', pluginId: 'plugin', getItems: () => subItems}],
                },
            },
            ...extra,
        });

        const storedExpanded = (expanded: boolean) => ({
            storage: {storage: {[storageKey]: {value: expanded, timestamp: new Date()}}},
        });

        const renderChannel = (
            props: Record<string, unknown> = {},
            state: Record<string, unknown> = makeState(),
            path = '/team_name/channels/town-square',
        ) => {
            const history = createMemoryHistory({initialEntries: [path]});
            const sidebarChannel = (
                <SidebarChannel
                    {...baseProps}
                    channel={channel}
                    {...props}
                />
            );
            const result = renderWithContext(
                props.isDraggable ? (
                    <DragDropContext onDragEnd={jest.fn()}>
                        <Droppable droppableId='category'>
                            {(provided) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                >
                                    {sidebarChannel}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                ) : sidebarChannel,
                state,
                {history},
            );
            return {...result, history};
        };

        const getToggle = () => screen.getByRole('button', {name: /^(Expand|Collapse) channel_display_name$/});

        test('should not render a toggle or list when there are no sub-items', () => {
            renderChannel({}, makeState({}, []));

            expect(screen.queryByRole('button', {name: /^(Expand|Collapse)/})).not.toBeInTheDocument();
            expect(screen.queryByRole('list')).not.toBeInTheDocument();
            expect(screen.getByRole('listitem')).not.toHaveClass('hasSubItems');
        });

        test('should not render sub-items for DM channels', () => {
            renderChannel({channel: {...channel, type: 'D' as ChannelType}});

            expect(screen.queryByRole('button', {name: /^(Expand|Collapse)/})).not.toBeInTheDocument();
            expect(screen.queryByRole('list')).not.toBeInTheDocument();
        });

        test('should be collapsed by default', () => {
            renderChannel();

            expect(screen.getAllByRole('listitem')[0]).toHaveClass('hasSubItems');
            expect(getToggle()).toHaveAccessibleName('Expand channel_display_name');
            expect(getToggle()).toHaveAttribute('aria-expanded', 'false');
            expect(getToggle()).toHaveAttribute('aria-controls', 'sidebarSubItems_channel_id');
            expect(getToggle().querySelector('i')).toHaveClass('icon-chevron-right');
            expect(screen.queryByRole('list')).not.toBeInTheDocument();
        });

        test('should show and hide the list with the toggle and persist the choice', async () => {
            const {store, history} = renderChannel();

            await userEvent.click(getToggle());

            expect(getToggle()).toHaveAccessibleName('Collapse channel_display_name');
            expect(getToggle()).toHaveAttribute('aria-expanded', 'true');
            expect(getToggle().querySelector('i')).toHaveClass('icon-chevron-down');
            expect(screen.getByRole('list')).toHaveAttribute('id', 'sidebarSubItems_channel_id');
            expect(screen.getByRole('link', {name: 'Board view'})).toHaveAttribute('href', '/team_name/channels/town-square/views/a');
            expect(screen.getByRole('link', {name: 'Table view'})).toHaveAttribute('href', '/team_name/channels/town-square/views/b');
            expect(store.getState().storage.storage[storageKey].value).toBe(true);
            expect(history.location.pathname).toBe('/team_name/channels/town-square');

            await userEvent.click(getToggle());

            expect(getToggle()).toHaveAttribute('aria-expanded', 'false');
            expect(screen.queryByRole('list')).not.toBeInTheDocument();
            expect(store.getState().storage.storage[storageKey].value).toBe(false);
        });

        test('should start expanded from the persisted state', () => {
            renderChannel({}, makeState(storedExpanded(true)));

            expect(getToggle()).toHaveAttribute('aria-expanded', 'true');
            expect(screen.getByRole('list')).toBeInTheDocument();
        });

        test('should keep separate state per channel', () => {
            renderChannel({}, makeState({storage: {storage: {[`${StoragePrefixes.CHANNEL_SIDEBAR_SUB_ITEMS_EXPANDED}user_id_team_id_other_channel`]: {value: true, timestamp: new Date()}}}}));

            expect(getToggle()).toHaveAttribute('aria-expanded', 'false');
        });

        test('should expand and mark the active item when the path matches a sub-item', () => {
            renderChannel({isCurrentChannel: true}, makeState(), '/team_name/channels/town-square/views/b');

            expect(getToggle()).toHaveAttribute('aria-expanded', 'true');
            expect(screen.getByRole('link', {name: 'Table view'})).toHaveAttribute('aria-current', 'page');
            expect(screen.getByRole('link', {name: 'Board view'})).not.toHaveAttribute('aria-current');

            const channelItem = screen.getAllByRole('listitem')[0];
            expect(channelItem).toHaveClass('active', 'hasSubItems', 'hasActiveSubItem');
        });

        test('should not mark a sub-item active when on the channel root', () => {
            renderChannel({isCurrentChannel: true}, makeState(storedExpanded(true)));

            expect(screen.queryByRole('link', {current: 'page'})).not.toBeInTheDocument();
            expect(screen.getAllByRole('listitem')[0]).not.toHaveClass('hasActiveSubItem');
        });

        test('should not mark a sub-item active when the path is in another channel', () => {
            renderChannel({isCurrentChannel: true}, makeState(), '/team_name/channels/off-topic/views/b');

            expect(getToggle()).toHaveAttribute('aria-expanded', 'false');
            expect(screen.queryByRole('list')).not.toBeInTheDocument();
        });

        test('should persist the expanded state when the path matches a sub-item', () => {
            const {store} = renderChannel({isCurrentChannel: true}, makeState(), '/team_name/channels/town-square/views/b');

            expect(store.getState().storage.storage[storageKey].value).toBe(true);
        });

        test('should not persist anything when the path matches no sub-item', () => {
            const {store} = renderChannel({isCurrentChannel: true});

            expect(store.getState().storage.storage[storageKey]).toBeUndefined();
        });

        test('should allow collapsing while a sub-item is active and restore the channel active styling', async () => {
            const {store} = renderChannel({isCurrentChannel: true}, makeState(), '/team_name/channels/town-square/views/b');

            const channelItem = screen.getAllByRole('listitem')[0];
            expect(channelItem).toHaveClass('active', 'hasActiveSubItem');

            await userEvent.click(getToggle());

            expect(getToggle()).toHaveAttribute('aria-expanded', 'false');
            expect(getToggle()).toHaveAccessibleName('Expand channel_display_name');
            expect(screen.queryByRole('list')).not.toBeInTheDocument();
            expect(channelItem).toHaveClass('active', 'hasSubItems');
            expect(channelItem).not.toHaveClass('hasActiveSubItem');
            expect(store.getState().storage.storage[storageKey].value).toBe(false);
        });

        test('should expand again when navigating to a different sub-item after collapsing', async () => {
            const {store, history} = renderChannel({isCurrentChannel: true}, makeState(), '/team_name/channels/town-square/views/b');

            await userEvent.click(getToggle());
            expect(screen.queryByRole('list')).not.toBeInTheDocument();

            act(() => {
                history.push('/team_name/channels/town-square/views/a');
            });

            expect(getToggle()).toHaveAttribute('aria-expanded', 'true');
            expect(screen.getByRole('link', {name: 'Board view'})).toHaveAttribute('aria-current', 'page');
            expect(screen.getAllByRole('listitem')[0]).toHaveClass('hasActiveSubItem');
            expect(store.getState().storage.storage[storageKey].value).toBe(true);
        });

        test('should stay collapsed when navigating within the same active sub-item', async () => {
            const {history} = renderChannel({isCurrentChannel: true}, makeState(), '/team_name/channels/town-square/views/b');

            await userEvent.click(getToggle());

            act(() => {
                history.push('/team_name/channels/town-square/views/b/details');
            });

            expect(getToggle()).toHaveAttribute('aria-expanded', 'false');
            expect(screen.queryByRole('list')).not.toBeInTheDocument();
        });

        test('should not suppress the channel active styling when the list is hidden because the category is dragged', () => {
            renderChannel({isCurrentChannel: true, isCategoryDragged: true}, makeState(), '/team_name/channels/town-square/views/b');

            const channelItem = screen.getByRole('listitem');
            expect(channelItem).toHaveClass('active', 'collapsed');
            expect(channelItem).not.toHaveClass('hasActiveSubItem');
        });

        test('should hide the list when the category is collapsed', () => {
            renderChannel({isCategoryCollapsed: true}, makeState(storedExpanded(true)));

            expect(screen.getByRole('listitem')).toHaveClass('collapsed');
            expect(screen.queryByRole('list')).not.toBeInTheDocument();
        });

        test('should hide the list when the category is being dragged', () => {
            renderChannel({isCategoryDragged: true}, makeState(storedExpanded(true)));

            expect(screen.queryByRole('list')).not.toBeInTheDocument();
        });

        test('should show the list in a collapsed category when the channel is current', () => {
            renderChannel({isCategoryCollapsed: true, isCurrentChannel: true}, makeState(storedExpanded(true)));

            expect(screen.getAllByRole('listitem')[0]).toHaveClass('expanded');
            expect(screen.getByRole('list')).toBeInTheDocument();
        });

        test('should show the list in a collapsed category when the channel is unread', () => {
            renderChannel({isCategoryCollapsed: true, isUnread: true}, makeState(storedExpanded(true)));

            expect(screen.getByRole('list')).toBeInTheDocument();
        });

        test('should render the list inside the draggable channel item', () => {
            renderChannel({isDraggable: true}, makeState(storedExpanded(true)));

            const channelItem = screen.getAllByRole('listitem')[0];
            expect(channelItem).toHaveClass('SidebarChannel', 'hasSubItems');
            expect(channelItem).toContainElement(screen.getByRole('list'));
            expect(channelItem).toContainElement(getToggle());
        });

        test('should put the drag handle on the channel row and not on the list item or sub-items', () => {
            const {container} = renderChannel({isDraggable: true}, makeState(storedExpanded(true)));

            const channelItem = screen.getAllByRole('listitem')[0];
            const handle = container.querySelector('[data-rfd-drag-handle-draggable-id="channel_id"]')!;

            expect(handle).toBeInTheDocument();
            expect(handle).toHaveClass('SidebarChannel__dragHandle');
            expect(handle).not.toBe(channelItem);
            expect(channelItem).not.toHaveAttribute('data-rfd-drag-handle-draggable-id');
            expect(channelItem).toHaveAttribute('data-rfd-draggable-id', 'channel_id');
            expect(channelItem).not.toHaveAttribute('tabindex');
            expect(handle).toHaveAttribute('tabindex', '-1');
            expect(handle).not.toHaveAttribute('role', 'button');
            expect(handle).toContainElement(screen.getByRole('link', {name: /channel_display_name/}));
            expect(handle).toContainElement(getToggle());
            expect(handle).not.toContainElement(screen.getByRole('list'));
            expect(handle).not.toContainElement(screen.getByRole('link', {name: 'Board view'}));
        });

        test('should keep a single tab stop for the channel row', () => {
            const {container} = renderChannel({isDraggable: true}, makeState(storedExpanded(true)));

            const tabbable = Array.from(container.querySelectorAll('[tabindex="0"]'));
            expect(tabbable).toHaveLength(1);
            expect(tabbable[0]).toHaveAttribute('id', 'sidebarItem_town-square');
        });

        test('should not render a drag handle when the channel is not draggable', () => {
            const {container} = renderChannel({isDraggable: false}, makeState(storedExpanded(true)));

            expect(container.querySelector('[data-rfd-drag-handle-draggable-id]')).not.toBeInTheDocument();
            expect(container.querySelector('.SidebarChannel__dragHandle')).not.toBeInTheDocument();
        });

        test('should hide the list while the channel is part of a multi-select drag', () => {
            renderChannel({
                isChannelSelected: true,
                draggingState: {state: 'dragging', id: 'other_channel'},
                multiSelectedChannelIds: ['channel_id', 'other_channel'],
            }, makeState(storedExpanded(true)));

            expect(screen.queryByRole('list')).not.toBeInTheDocument();
        });
    });
});
