// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {TestHelper} from 'utils/test_helper';

import FailedPostOptions from 'components/post_view/failed_post_options/failed_post_options';

describe('components/post_view/FailedPostOptions', () => {
    const baseProps = {
        post: TestHelper.getPostMock(),
        actions: {
            createPost: jest.fn(),
            removePost: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<FailedPostOptions {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should create post on retry', () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                createPost: jest.fn(),
            },
        };

        const wrapper = shallow(<FailedPostOptions {...props}/>);
        const e = {preventDefault: jest.fn()};

        wrapper.find('.post-retry').simulate('click', e);
        expect(props.actions.createPost.mock.calls.length).toBe(1);

        wrapper.find('.post-retry').simulate('click', e);
        expect(props.actions.createPost.mock.calls.length).toBe(2);
    });

    test('should remove post on cancel', () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                removePost: jest.fn(),
            },
        };

        const wrapper = shallow(<FailedPostOptions {...props}/>);
        const e = {preventDefault: jest.fn()};

        wrapper.find('.post-cancel').simulate('click', e);
        expect(props.actions.removePost.mock.calls.length).toBe(1);
    });
});
