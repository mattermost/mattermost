// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {render, screen} from 'tests/react_testing_utils';
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

    test('no status and post icon override specified, default props', () => {
        const props: Props = baseProps;
        render(
            <PostProfilePicture {...props}/>,
        );

        expect(screen.queryByLabelText('Online Icon')).not.toBeInTheDocument();

        // no status is given, 'Offline Icon' should be in the dom as a fallback
        expect(screen.getByLabelText('Offline Icon')).toBeInTheDocument();
    });

    test('status and post icon override specified, default props', () => {
        const props: Props = {
            ...baseProps,
            status: 'away',
            postIconOverrideURL: 'http://example.com/image.png',
        };
        render(
            <PostProfilePicture {...props}/>,
        );

        // status is given, 'Away Icon' should be in the dom
        expect(screen.getByLabelText('Away Icon')).toBeInTheDocument();

        expect(screen.queryByLabelText('Online Icon')).not.toBeInTheDocument();

        expect(screen.queryByLabelText('Offline Icon')).not.toBeInTheDocument();

        expect(screen.getAllByRole('img')).toHaveLength(2);
    });
});
