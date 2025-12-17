// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import PostFlagIcon from 'components/post_view/post_flag_icon/post_flag_icon';

describe('components/post_view/PostFlagIcon', () => {
    const baseProps = {
        postId: 'post_id',
        isFlagged: false,
        actions: {
            flagPost: jest.fn(),
            unflagPost: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<PostFlagIcon {...baseProps}/>);

        // for unflagged icon
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('button').hasClass('post-menu__item')).toBe(true);
        wrapper.find('button').simulate('click', {preventDefault: jest.fn});
        expect(baseProps.actions.flagPost).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.flagPost).toHaveBeenCalledWith('post_id');
        expect(baseProps.actions.unflagPost).not.toHaveBeenCalled();

        // for flagged icon
        wrapper.setProps({isFlagged: true});
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('button').hasClass('post-menu__item')).toBe(true);
        wrapper.find('button').simulate('click', {preventDefault: jest.fn});
        expect(baseProps.actions.flagPost).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.unflagPost).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.unflagPost).toHaveBeenCalledWith('post_id');
    });
});
