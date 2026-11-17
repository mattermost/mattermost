// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DragDropContext, Droppable} from '@hello-pangea/dnd';
import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import SidebarChannel from 'components/sidebar/sidebar_channel/sidebar_channel';

import {fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import type {SidebarChannelChildrenRegistration} from 'types/store/plugins';

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
        collapseCategoryWithUnreads: false,
    };

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

    describe('collapse category with unread channels', () => {
        const mutedMentionProps = {
            isUnread: true,
            unreadMentions: 2,
        };

        test('with the setting off, should keep unread and current channels in a collapsed category', () => {
            const {rerender} = renderWithContext(
                <SidebarChannel
                    {...baseProps}
                    isCategoryCollapsed={true}
                    isUnread={true}
                />,
            );
            expect(screen.getByRole('listitem')).toHaveClass('expanded');

            rerender(
                <SidebarChannel
                    {...baseProps}
                    isCategoryCollapsed={true}
                    isCurrentChannel={true}
                />,
            );
            expect(screen.getByRole('listitem')).toHaveClass('expanded');
        });

        test('with the setting on, should hide an unread channel in a collapsed category', () => {
            renderWithContext(
                <SidebarChannel
                    {...baseProps}
                    collapseCategoryWithUnreads={true}
                    isCategoryCollapsed={true}
                    isUnread={true}
                />,
            );

            expect(screen.getByRole('listitem')).toHaveClass('collapsed');
        });

        test('with the setting on, should hide a muted channel with a mention count in a collapsed category', () => {
            renderWithContext(
                <SidebarChannel
                    {...baseProps}
                    {...mutedMentionProps}
                    collapseCategoryWithUnreads={true}
                    isCategoryCollapsed={true}
                />,
            );

            expect(screen.getByRole('listitem')).toHaveClass('collapsed');
        });

        test('with the setting on, should keep the current channel in a collapsed category', () => {
            renderWithContext(
                <SidebarChannel
                    {...baseProps}
                    collapseCategoryWithUnreads={true}
                    isCategoryCollapsed={true}
                    isCurrentChannel={true}
                    isUnread={true}
                />,
            );

            expect(screen.getByRole('listitem')).toHaveClass('expanded');
        });

        test('with the setting on, should keep every channel in an open category', () => {
            const {rerender} = renderWithContext(
                <SidebarChannel
                    {...baseProps}
                    collapseCategoryWithUnreads={true}
                />,
            );
            expect(screen.getByRole('listitem')).toHaveClass('expanded');

            rerender(
                <SidebarChannel
                    {...baseProps}
                    collapseCategoryWithUnreads={true}
                    isUnread={true}
                />,
            );
            expect(screen.getByRole('listitem')).toHaveClass('expanded');

            rerender(
                <SidebarChannel
                    {...baseProps}
                    {...mutedMentionProps}
                    collapseCategoryWithUnreads={true}
                />,
            );
            expect(screen.getByRole('listitem')).toHaveClass('expanded');
        });
    });

    describe('children registered by plugins', () => {
        const stateWithChildren = (registrations: SidebarChannelChildrenRegistration[]) => ({
            plugins: {
                components: {
                    SidebarChannelChildren: registrations,
                },
            },
        });

        const registration = (partial: Partial<SidebarChannelChildrenRegistration> = {}): SidebarChannelChildrenRegistration => ({
            id: 'reg1',
            pluginId: 'test-plugin',
            matcher: (state, channel) => channel.id === 'channel_id',
            component: ({channel, currentTeamName, isCurrentChannel}) => (
                <div data-testid='plugin-children'>{`children of ${channel.id} on ${currentTeamName} ${isCurrentChannel}`}</div>
            ),
            ...partial,
        });

        test('should not render anything extra without registrations', () => {
            renderWithContext(<SidebarChannel {...baseProps}/>);

            expect(screen.getByRole('listitem')).not.toHaveClass('hasChildren');
            expect(document.querySelector('.SidebarChannel__children')).not.toBeInTheDocument();
        });

        test('should render the children of a matching registration inside the item', () => {
            renderWithContext(
                <SidebarChannel
                    {...baseProps}
                    isCurrentChannel={true}
                />,
                stateWithChildren([registration()]),
            );

            const item = screen.getByRole('listitem');
            expect(item).toHaveClass('hasChildren');
            expect(item).toContainElement(screen.getByTestId('plugin-children'));
            expect(screen.getByTestId('plugin-children')).toHaveTextContent('children of channel_id on team_name true');
        });

        test('should not render registrations whose matcher does not select the channel', () => {
            renderWithContext(
                <SidebarChannel {...baseProps}/>,
                stateWithChildren([registration({matcher: () => false})]),
            );

            expect(screen.queryByTestId('plugin-children')).not.toBeInTheDocument();
            expect(screen.getByRole('listitem')).not.toHaveClass('hasChildren');
        });

        test('should keep the item when a plugin component throws', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const Broken = () => {
                throw new Error('boom');
            };

            renderWithContext(
                <SidebarChannel {...baseProps}/>,
                stateWithChildren([registration({component: Broken})]),
            );

            expect(screen.getByRole('listitem')).toBeInTheDocument();
            expect(screen.queryByTestId('plugin-children')).not.toBeInTheDocument();

            consoleSpy.mockRestore();
        });

        test('should stay inside a collapsed category with the item', () => {
            renderWithContext(
                <SidebarChannel
                    {...baseProps}
                    isCategoryCollapsed={true}
                />,
                stateWithChildren([registration()]),
            );

            expect(screen.getByRole('listitem')).toHaveClass('collapsed');
            expect(screen.getByRole('listitem')).toContainElement(screen.getByTestId('plugin-children'));
        });

        describe('when draggable', () => {
            const renderDraggable = (onDragStart: jest.Mock, onClick: jest.Mock) => {
                const Children = () => (
                    <div>
                        <button onClick={onClick}>{'Show more'}</button>
                        <span>{'Plain text'}</span>
                    </div>
                );

                renderWithContext(
                    <DragDropContext
                        onDragStart={onDragStart}
                        onDragEnd={jest.fn()}
                    >
                        <Droppable droppableId='category'>
                            {(provided) => (
                                <ul
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                >
                                    <SidebarChannel
                                        {...baseProps}
                                        isDraggable={true}
                                    />
                                    {provided.placeholder}
                                </ul>
                            )}
                        </Droppable>
                    </DragDropContext>,
                    stateWithChildren([registration({component: Children})]),
                );
            };

            const dragFrom = (element: HTMLElement) => {
                fireEvent.mouseDown(element, {button: 0, clientX: 10, clientY: 10});
                fireEvent.mouseMove(window, {button: 0, clientX: 40, clientY: 40});
            };

            test('should render the children inside the draggable item', () => {
                renderDraggable(jest.fn(), jest.fn());

                expect(screen.getByRole('listitem')).toContainElement(screen.getByRole('button', {name: 'Show more'}));
            });

            test('should not start a drag from an interactive element of the children', async () => {
                const onDragStart = jest.fn();
                const onClick = jest.fn();
                renderDraggable(onDragStart, onClick);

                dragFrom(screen.getByRole('button', {name: 'Show more'}));
                await new Promise((resolve) => setTimeout(resolve, 100));
                expect(onDragStart).not.toHaveBeenCalled();

                await userEvent.click(screen.getByRole('button', {name: 'Show more'}));
                expect(onClick).toHaveBeenCalledTimes(1);
            });

            test('should still drag the item from the rest of its children', async () => {
                const onDragStart = jest.fn();
                renderDraggable(onDragStart, jest.fn());

                dragFrom(screen.getByText('Plain text'));

                await waitFor(() => expect(onDragStart).toHaveBeenCalledTimes(1));
            });
        });
    });
});
