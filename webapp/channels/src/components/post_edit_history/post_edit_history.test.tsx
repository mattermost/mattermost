// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps} from 'react';
import {shallow} from 'enzyme';

import {TestHelper} from 'utils/test_helper';

import PostEditHistory from './post_edit_history';

describe('components/post_edit_history', () => {
    const baseProps: ComponentProps<typeof PostEditHistory> = {
        channelDisplayName: 'channel_display_name',
        originalPost: TestHelper.getPostMock({
            id: 'post_id',
            message: 'post message',
        }),
        postEditHistory: [
            TestHelper.getPostMock({
                id: 'post_id_1',
                message: 'post message version 1',
            }),
            TestHelper.getPostMock({
                id: 'post_id_2',
                message: 'post message version 2',
            }),
        ],
        errors: false,
        dispatch: jest.fn(),
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<PostEditHistory {...baseProps}/>);

        expect(wrapper).toMatchSnapshot();
    });

    test('should display error screen if errors are present', () => {
        const propsWithError = {...baseProps, errors: true};
        const wrapper = shallow(<PostEditHistory {...propsWithError}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should display loading screen while postEditHistory is empty and no errors are present', () => {
        const propsWhileLoading = {...baseProps, postEditHistory: []};
        const wrapper = shallow(<PostEditHistory {...propsWhileLoading}/>);
        expect(wrapper).toMatchSnapshot();
    });
});
