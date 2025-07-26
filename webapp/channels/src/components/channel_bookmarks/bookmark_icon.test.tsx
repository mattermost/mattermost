// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import BookmarkIcon from './bookmark_icon';

describe('components/channel_bookmarks/bookmark_icon', () => {
    const baseProps = {
        type: 'link' as const,
        emoji: '',
        imageUrl: '',
        fileInfo: undefined,
        size: 16,
    };

    test('should match snapshot for link bookmark', () => {
        const wrapper = shallow(<BookmarkIcon {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for file bookmark', () => {
        const props = {
            ...baseProps,
            type: 'file' as const,
        };
        const wrapper = shallow(<BookmarkIcon {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });



    test('should match snapshot with emoji', () => {
        const props = {
            ...baseProps,
            emoji: 'smile',
        };
        const wrapper = shallow(<BookmarkIcon {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with image url', () => {
        const props = {
            ...baseProps,
            imageUrl: 'https://example.com/image.png',
        };
        const wrapper = shallow(<BookmarkIcon {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });
});