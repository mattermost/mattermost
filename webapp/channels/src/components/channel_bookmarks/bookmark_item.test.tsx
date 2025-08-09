// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import BookmarkItem from './bookmark_item';

describe('components/channel_bookmarks/bookmark_item', () => {
    const baseProps = {
        bookmark: {
            id: 'bookmark_id',
            create_at: 1234,
            update_at: 1234,
            delete_at: 0,
            channel_id: 'channel_id',
            owner_id: 'owner_id',
            display_name: 'Test Bookmark',
            sort_order: 0,
            type: 'link' as const,
            link_url: 'https://mattermost.com',
        } as ChannelBookmark,
        onEdit: jest.fn(),
        onDelete: jest.fn(),
        onDragStart: jest.fn(),
        onDragEnd: jest.fn(),
        isDragging: false,
        isDropDisabled: false,
        provided: {
            draggableProps: {},
            dragHandleProps: {},
            innerRef: jest.fn(),
        },
    };

    test('should match snapshot for link bookmark', () => {
        const wrapper = shallow(<BookmarkItem {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for file bookmark', () => {
        const props = {
            ...baseProps,
            bookmark: {
                ...baseProps.bookmark,
                type: 'file' as const,
                file_id: 'file_id',
                link_url: '',
            },
        };
        const wrapper = shallow(<BookmarkItem {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for in-app link bookmark', () => {
        const props = {
            ...baseProps,
            bookmark: {
                ...baseProps.bookmark,
                type: 'link' as const,
                link_url: 'mattermost://channel/team-name/channel-name',
            },
        };
        const wrapper = shallow(<BookmarkItem {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should call onEdit when edit button is clicked', () => {
        const wrapper = shallow(<BookmarkItem {...baseProps}/>);
        wrapper.find('button.bookmark-menu-edit').simulate('click', {stopPropagation: jest.fn()});
        expect(baseProps.onEdit).toHaveBeenCalledWith(baseProps.bookmark);
    });

    test('should call onDelete when delete button is clicked', () => {
        const wrapper = shallow(<BookmarkItem {...baseProps}/>);
        wrapper.find('button.bookmark-menu-delete').simulate('click', {stopPropagation: jest.fn()});
        expect(baseProps.onDelete).toHaveBeenCalledWith(baseProps.bookmark);
    });
});