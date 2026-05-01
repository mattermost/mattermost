// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MovementMode, DropResult} from 'react-beautiful-dnd';

import {CategorySorting} from '@mattermost/types/channel_categories';
import type {ChannelType} from '@mattermost/types/channels';
import type {TeamType} from '@mattermost/types/teams';

import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';

import {act, renderWithContext, screen} from 'tests/react_testing_utils';
import {DraggingStates, DraggingStateTypes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import {SidebarList as SidebarListComponent} from './sidebar_list';

jest.mock('components/async_load', () => ({
    makeAsyncComponent: (displayName: string) => {
        const Component = (props: {children?: React.ReactNode}) => (
            <div data-testid={displayName}>{props.children}</div>
        );
        Component.displayName = displayName;
        return Component;
    },
}));

jest.mock('components/common/scrollbars', () => {
    const React = require('react');

    return React.forwardRef(({children, onScroll}: {children?: React.ReactNode; onScroll?: () => void}, ref: any) => {
        const setRef = (node: HTMLDivElement | null) => {
            if (!node) {
                return;
            }
            if (!node.scrollTo) {
                node.scrollTo = jest.fn();
            }
            if (typeof ref === 'function') {
                ref(node);
            } else if (ref) {
                ref.current = node;
            }
        };

        return (
            <div
                ref={setRef}
                onScroll={onScroll}
            >
                {children}
            </div>
        );
    });
});

jest.mock('components/sidebar/sidebar_category', () => () => <div data-testid='sidebar-category'/>);

describe('SidebarList', () => {
    const intl = {
        formatMessage: ({defaultMessage}: {defaultMessage: string}) => defaultMessage,
    } as any;

    const currentChannel = TestHelper.getChannelMock({
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
    });

    const unreadChannel = {
        id: 'channel_id_2',
        display_name: 'channel_display_name_2',
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
    };

    const baseProps = {
        currentTeam: TestHelper.getTeamMock({
            id: 'kemjcpu9bi877yegqjs18ndp4r',
            invite_id: 'ojsnudhqzbfzpk6e4n6ip1hwae',
            name: 'test',
            create_at: 123,
            update_at: 123,
            delete_at: 123,
            display_name: 'test',
            description: 'test',
            email: 'test',
            type: 'O' as TeamType,
            company_name: 'test',
            allowed_domains: 'test',
            allow_open_invite: false,
            scheme_id: 'test',
            group_constrained: false,
        }),
        currentChannelId: currentChannel.id,
        categories: [
            {
                id: 'category1',
                team_id: 'team1',
                user_id: '',
                type: CategoryTypes.CUSTOM,
                display_name: 'custom_category_1',
                sorting: CategorySorting.Alphabetical,
                channel_ids: ['channel_id', 'channel_id_2'],
                muted: false,
                collapsed: false,
            },
        ],
        unreadChannelIds: ['channel_id_2'],
        displayedChannels: [currentChannel, unreadChannel],
        newCategoryIds: [],
        multiSelectedChannelIds: [],
        isUnreadFilterEnabled: false,
        draggingState: {},
        categoryCollapsedState: {},
        handleOpenMoreDirectChannelsModal: jest.fn(),
        onDragStart: jest.fn(),
        onDragEnd: jest.fn(),
        showUnreadsCategory: false,
        collapsedThreads: true,
        hasUnreadThreads: false,
        currentStaticPageId: '',
        staticPages: [],
        actions: {
            switchToChannelById: jest.fn(),
            switchToLhsStaticPage: jest.fn(),
            close: jest.fn(),
            moveChannelsInSidebar: jest.fn(),
            moveCategory: jest.fn(),
            removeFromCategory: jest.fn(),
            setDraggingState: jest.fn(),
            stopDragging: jest.fn(),
            clearChannelSelection: jest.fn(),
            multiSelectChannelAdd: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <SidebarListComponent
                {...baseProps}
                intl={intl}
            />,
        );

        expect(container).toMatchSnapshot();

        const sidebarRegion = screen.getByRole('application', {name: /channel sidebar region/i});
        const droppable = sidebarRegion.querySelector('#sidebar-droppable-categories');
        expect(droppable).toBeInTheDocument();
        expect(droppable).toMatchSnapshot();
    });

    test('should close sidebar on mobile when channel is selected (ie. changed)', () => {
        const {rerender} = renderWithContext(
            <SidebarListComponent
                {...baseProps}
                intl={intl}
            />,
        );

        rerender(
            <SidebarListComponent
                {...baseProps}
                intl={intl}
                currentChannelId='new_channel_id'
            />,
        );
        expect(baseProps.actions.close).toHaveBeenCalled();
    });

    test('should scroll to top when team changes', () => {
        const sidebarListRef = React.createRef<SidebarListComponent>();
        const {rerender} = renderWithContext(
            <SidebarListComponent
                {...baseProps}
                intl={intl}
                ref={sidebarListRef}
            />,
        );
        const instance = sidebarListRef.current!;

        instance.scrollbar = {
            current: {
                scrollTo: jest.fn(),
            } as any,
        };

        const newCurrentTeam = {
            ...baseProps.currentTeam,
            id: 'new_team',
        };

        rerender(
            <SidebarListComponent
                {...baseProps}
                intl={intl}
                ref={sidebarListRef}
                currentTeam={newCurrentTeam}
            />,
        );
        expect(instance.scrollbar.current!.scrollTo).toHaveBeenCalledWith({top: 0});
    });

    test('should display unread scroll indicator when channels appear outside visible area', () => {
        const sidebarListRef = React.createRef<SidebarListComponent>();
        renderWithContext(
            <SidebarListComponent
                {...baseProps}
                intl={intl}
                ref={sidebarListRef}
            />,
        );
        const instance = sidebarListRef.current!;

        instance.scrollbar = {
            current: {
                scrollTop: 0,
                clientHeight: 500,
            } as any,
        };

        instance.channelRefs.set(unreadChannel.id, {
            offsetTop: 1,
            offsetHeight: 0,
        } as any);

        act(() => {
            instance.updateUnreadIndicators();
        });
        expect(instance.state.showTopUnread).toBe(true);

        instance.channelRefs.set(unreadChannel.id, {
            offsetTop: 501,
            offsetHeight: 0,
        } as any);

        act(() => {
            instance.updateUnreadIndicators();
        });
        expect(instance.state.showBottomUnread).toBe(true);
    });

    test('should scroll to correct position when scrolling to channel', () => {
        const sidebarListRef = React.createRef<SidebarListComponent>();
        renderWithContext(
            <SidebarListComponent
                {...baseProps}
                intl={intl}
                ref={sidebarListRef}
            />,
        );
        const instance = sidebarListRef.current!;

        instance.scrollToPosition = jest.fn();

        instance.scrollbar = {
            current: {
                scrollTo: jest.fn(),
                scrollTop: 100,
                clientHeight: 500,
            } as any,
        };

        instance.channelRefs.set(unreadChannel.id, {
            offsetTop: 50,
            offsetHeight: 20,
        } as any);

        instance.scrollToChannel(unreadChannel.id);
        expect(instance.scrollToPosition).toHaveBeenCalledWith(8); // includes margin and category header height
    });

    test('should set the dragging state based on type', () => {
        const querySpy = jest.spyOn(document, 'querySelectorAll').mockReturnValue([{
            style: {},
        }] as any);

        const sidebarListRef = React.createRef<SidebarListComponent>();
        renderWithContext(
            <SidebarListComponent
                {...baseProps}
                intl={intl}
                ref={sidebarListRef}
            />,
        );

        const categoryBefore = {
            draggableId: baseProps.categories[0].id,
            mode: 'SNAP' as MovementMode,
        };
        const expectedCategoryBefore = {
            state: DraggingStates.CAPTURE,
            id: categoryBefore.draggableId,
            type: DraggingStateTypes.CATEGORY,
        };

        const instance = sidebarListRef.current!;

        instance.onBeforeCapture(categoryBefore);
        expect(baseProps.actions.setDraggingState).toHaveBeenCalledWith(expectedCategoryBefore);

        const channelBefore = {
            draggableId: currentChannel.id,
            mode: 'SNAP' as MovementMode,
        };
        const expectedChannelBefore = {
            state: DraggingStates.CAPTURE,
            id: channelBefore.draggableId,
            type: DraggingStateTypes.CHANNEL,
        };

        instance.onBeforeCapture(channelBefore);
        expect(baseProps.actions.setDraggingState).toHaveBeenCalledWith(expectedChannelBefore);

        querySpy.mockRestore();
    });

    test('should call correct action on dropping item', () => {
        const sidebarListRef = React.createRef<SidebarListComponent>();
        renderWithContext(
            <SidebarListComponent
                {...baseProps}
                intl={intl}
                ref={sidebarListRef}
            />,
        );
        const instance = sidebarListRef.current!;

        const categoryResult: DropResult = {
            reason: 'DROP',
            type: 'SIDEBAR_CATEGORY',
            source: {
                droppableId: 'droppable-categories',
                index: 0,
            },
            destination: {
                droppableId: 'droppable-categories',
                index: 5,
            },
            draggableId: baseProps.categories[0].id,
            mode: 'SNAP' as MovementMode,
        };

        instance.onDragEnd(categoryResult);
        expect(baseProps.actions.moveCategory).toHaveBeenCalledWith(baseProps.currentTeam.id, categoryResult.draggableId, categoryResult.destination!.index);

        const channelResult: DropResult = {
            reason: 'DROP',
            type: 'SIDEBAR_CHANNEL',
            source: {
                droppableId: baseProps.categories[0].id,
                index: 0,
            },
            destination: {
                droppableId: baseProps.categories[0].id,
                index: 5,
            },
            draggableId: baseProps.categories[0].id,
            mode: 'SNAP' as MovementMode,
        };

        instance.onDragEnd(channelResult);
        expect(baseProps.actions.moveChannelsInSidebar).toHaveBeenCalledWith(channelResult.destination!.droppableId, channelResult.destination!.index, channelResult.draggableId);
    });
});
