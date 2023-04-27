// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import PostEmoji from './post_emoji';

describe('PostEmoji', () => {
    const baseProps = {
        imageUrl: '/api/v4/emoji/1234/image',
        name: 'emoji',
    };

    test('should render image when imageUrl is provided', () => {
        const wrapper = shallow(<PostEmoji {...baseProps}/>);

        expect(wrapper.find('span').prop('style')).toMatchObject({
            backgroundImage: `url(${baseProps.imageUrl})`,
        });
    });

    test('should render shortcode text within span when imageUrl is provided', () => {
        const wrapper = shallow(<PostEmoji {...baseProps}/>);

        expect(wrapper.find('span').text()).toBe(`:${baseProps.name}:`);
    });

    test('should render original text when imageUrl is empty', () => {
        const props = {
            ...baseProps,
            imageUrl: '',
        };

        const wrapper = shallow(<PostEmoji {...props}/>);

        expect(wrapper.find('span')).toHaveLength(0);
        expect(wrapper.text()).toBe(`:${props.name}:`);
    });
});
