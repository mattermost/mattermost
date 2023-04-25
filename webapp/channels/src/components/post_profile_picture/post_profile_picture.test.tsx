// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps} from 'react';
import {shallow} from 'enzyme';

import {TestHelper} from 'utils/test_helper';

import PostProfilePicture from './post_profile_picture';

type Props = ComponentProps<typeof PostProfilePicture>;

describe('components/PostProfilePicture', () => {
    const user = TestHelper.getUserMock({
        id: 'defaultuser',
    });
    const post = TestHelper.getPostMock({
        user_id: 'defaultuser',
    });

    const baseProps: Props = {
        availabilityStatusOnPosts: 'true',
        enablePostIconOverride: true,
        compactDisplay: true,
        hasImageProxy: true,
        isBusy: true,
        post,
        user,
        isBot: Boolean(user.is_bot),
    };

    test('should match snapshot, no status and post icon override specified, default props', () => {
        const props: Props = baseProps;
        const wrapper = shallow(
            <PostProfilePicture {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, status and post icon override specified, default props', () => {
        const props: Props = {
            ...baseProps,
            status: 'away',
            postIconOverrideURL: 'http://example.com/image.png',
        };
        const wrapper = shallow(
            <PostProfilePicture {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
