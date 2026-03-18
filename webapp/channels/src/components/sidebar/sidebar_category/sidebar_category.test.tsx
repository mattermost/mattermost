// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {DragDropContext, Droppable} from 'react-beautiful-dnd';

import {CategorySorting} from '@mattermost/types/channel_categories';

import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import SidebarCategory from './sidebar_category';

// Mock child components
jest.mock('./sidebar_category_menu', () => () => <div id='mock-category-menu'/>);
jest.mock('./sidebar_category_sorting_menu', () => () => <div id='mock-sorting-menu'/>);
jest.mock('../sidebar_channel', () => () => <li id='mock-sidebar-channel'/>);
jest.mock('../add_channels_cta_button', () => () => <div id='mock-add-channels-button'/>);
jest.mock('../invite_members_button', () => () => <div id='mock-invite-members-button'/>);

// Suppress react-beautiful-dnd console errors in tests
beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('components/sidebar/sidebar_category', () => {
    const baseProps = {
        category: {
            id: 'category1',
            team_id: 'team1',
            user_id: '',
            type: CategoryTypes.CUSTOM,
            display_name: 'custom_category_1',
            channel_ids: ['channel_id'],
            sorting: CategorySorting.Alphabetical,
            muted: false,
            collapsed: false,
        },
        channelIds: ['channel_id'],
        categoryIndex: 0,
        draggingState: {},
        setChannelRef: jest.fn(),
        handleOpenMoreDirectChannelsModal: jest.fn(),
        isNewCategory: false,
        isDisabled: false,
        limitVisibleDMsGMs: 10000,
        touchedInviteMembersButton: false,
        currentUserId: '',
        isAdmin: false,
        actions: {
            setCategoryCollapsed: jest.fn(),
            setCategorySorting: jest.fn(),
            savePreferences: jest.fn(),
        },
    };

    // Wrapper component to provide DragDropContext and Droppable
    const renderWithDnd = (component: React.ReactElement) => {
        const onDragEnd = () => {};
        return renderWithContext(
            <DragDropContext onDragEnd={onDragEnd}>
                <Droppable
                    droppableId='sidebar-categories'
                    type='SIDEBAR_CATEGORY'
                >
                    {(provided) => (
                        <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                        >
                            {component}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>,
        );
    };

    beforeEach(() => {
        baseProps.actions.setCategoryCollapsed.mockClear();
    });

    test('should match snapshot', () => {
        const {container} = renderWithDnd(<SidebarCategory {...baseProps}/>);

        expect(screen.getByText('custom_category_1')).toBeInTheDocument();
        expect(document.querySelector('#mock-category-menu')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when isNewCategory', () => {
        const props = {
            ...baseProps,
            isNewCategory: true,
            category: {
                ...baseProps.category,
                channel_ids: [],
            },
            channelIds: [],
        };

        const {container} = renderWithDnd(<SidebarCategory {...props}/>);

        expect(screen.getByText('new')).toBeInTheDocument();
        expect(screen.getByText('Drag channels here...')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when collapsed', () => {
        const props = {
            ...baseProps,
            category: {
                ...baseProps.category,
                collapsed: true,
            },
        };

        const {container} = renderWithDnd(<SidebarCategory {...props}/>);

        expect(screen.getByText('custom_category_1')).toBeInTheDocument();
        expect(document.querySelector('.isCollapsed')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when the category is DM and there are no DMs to display', () => {
        const props = {
            ...baseProps,
            category: {
                ...baseProps.category,
                type: CategoryTypes.DIRECT_MESSAGES,
                sorting: CategorySorting.Recency,
            },
            channelIds: [],
        };

        const {container} = renderWithDnd(<SidebarCategory {...props}/>);

        expect(document.querySelector('#mock-sorting-menu')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when there are no channels to display', () => {
        const props = {
            ...baseProps,
            category: {
                ...baseProps.category,
                type: CategoryTypes.FAVORITES,
                display_name: 'Favorites',
            },
            channelIds: [],
        };

        const {container} = renderWithDnd(<SidebarCategory {...props}/>);

        // Favorites category with no channels should not render
        expect(screen.queryByText('Favorites')).not.toBeInTheDocument();
        expect(document.querySelector('.SidebarChannelGroup')).not.toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when sorting is set to by recency', () => {
        const props = {
            ...baseProps,
            category: {
                ...baseProps.category,
                type: CategoryTypes.DIRECT_MESSAGES,
                sorting: CategorySorting.Recency,
            },
        };

        const {container} = renderWithDnd(<SidebarCategory {...props}/>);

        expect(document.querySelector('#mock-sorting-menu')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should collapse the channel on toggle when it is not collapsed', async () => {
        renderWithDnd(<SidebarCategory {...baseProps}/>);

        await userEvent.click(screen.getByText('custom_category_1'));

        expect(baseProps.actions.setCategoryCollapsed).toHaveBeenCalledWith('category1', true);
    });

    test('should un-collapse the channel on toggle when it is collapsed', async () => {
        const props = {
            ...baseProps,
            category: {
                ...baseProps.category,
                collapsed: true,
            },
        };

        renderWithDnd(<SidebarCategory {...props}/>);

        await userEvent.click(screen.getByText('custom_category_1'));

        expect(baseProps.actions.setCategoryCollapsed).toHaveBeenCalledWith('category1', false);
    });
});
