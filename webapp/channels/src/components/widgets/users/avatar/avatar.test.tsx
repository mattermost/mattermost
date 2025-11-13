// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {withIntl} from 'tests/helpers/intl-test-helper';
import {render, screen} from 'tests/react_testing_utils';

import Avatar from './avatar';

describe('components/widgets/users/Avatar', () => {
    test('should render avatar image with url, username, and size', () => {
        render(withIntl(
            <Avatar
                url='test-url'
                username='test-username'
                size='xl'
            />,
        ));

        const avatar = screen.getByRole('img', {name: /test-username profile image/i});
        expect(avatar).toBeInTheDocument();
        expect(avatar).toHaveClass('Avatar', 'Avatar-xl');
        expect(avatar).toHaveAttribute('src', 'test-url');
        expect(avatar).toHaveAttribute('loading', 'lazy');
    });

    test('should render avatar image with only url', () => {
        render(withIntl(
            <Avatar url='test-url'/>,
        ));

        const avatar = screen.getByRole('img');
        expect(avatar).toBeInTheDocument();
        expect(avatar).toHaveClass('Avatar', 'Avatar-md');
        expect(avatar).toHaveAttribute('src', 'test-url');
    });

    test('should render plain text avatar without image', () => {
        const {container} = render(withIntl(
            <Avatar text='SA'/>,
        ));

        expect(screen.queryByRole('img')).not.toBeInTheDocument();
        const avatarDiv = container.querySelector('.Avatar');
        expect(avatarDiv).toBeInTheDocument();
        expect(avatarDiv).toHaveClass('Avatar', 'Avatar-md', 'Avatar-plain');
        expect(avatarDiv).toHaveAttribute('data-content', 'SA');
    });
});
