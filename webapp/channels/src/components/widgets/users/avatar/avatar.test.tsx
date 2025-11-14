// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Client4} from 'mattermost-redux/client';

import BotDefaultIcon from 'images/bot_default_icon.png';
import {withIntl} from 'tests/helpers/intl-test-helper';
import {fireEvent, render, screen} from 'tests/react_testing_utils';

import Avatar, {getAvatarWidth} from './avatar';

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

    test('should render avatar with custom alt text', () => {
        render(withIntl(
            <Avatar
                url='test-url'
                username='john'
                alt='Custom alt text'
            />,
        ));

        const avatar = screen.getByRole('img', {name: 'Custom alt text'});
        expect(avatar).toBeInTheDocument();
        expect(avatar).toHaveAttribute('alt', 'Custom alt text');
    });

    test('should render avatar with default username when username not provided', () => {
        render(withIntl(
            <Avatar url='test-url'/>,
        ));

        const avatar = screen.getByRole('img', {name: /user profile image/i});
        expect(avatar).toBeInTheDocument();
    });

    test('should handle image load error with user avatar fallback', () => {
        // Client4.getUsersRoute() returns the API route for user avatars (e.g., /api/v4/users)
        // This is used to distinguish user avatars from bot/plugin avatars for proper fallback handling
        const userAvatarUrl = `${Client4.getUsersRoute()}/userid123/image?_=123456`;

        render(withIntl(
            <Avatar url={userAvatarUrl}/>,
        ));

        const avatar = screen.getByRole('img') as HTMLImageElement;
        expect(avatar.src).toContain('userid123');

        // Simulate image load error
        fireEvent.error(avatar);

        // Should fall back to default user avatar (replace ?_= with /default)
        expect(avatar.src).toContain('/default');
    });

    test('should handle image load error with bot icon fallback', () => {
        const botAvatarUrl = 'https://example.com/bot-avatar.png';

        render(withIntl(
            <Avatar url={botAvatarUrl}/>,
        ));

        const avatar = screen.getByRole('img') as HTMLImageElement;
        const initialSrc = avatar.src;

        // Simulate image load error
        fireEvent.error(avatar);

        // Should change from the initial URL (bot icon set, even if empty in test environment)
        expect(avatar.src).not.toBe(initialSrc);

        // In production, this would be the bot default icon
        // In test environment, it may resolve to empty string or base URL
        expect(avatar.src === BotDefaultIcon || avatar.src === 'http://localhost:8065/').toBe(true);
    });

    test('should not change src if already using fallback image', () => {
        const userAvatarUrl = `${Client4.getUsersRoute()}/userid123/image/default`;

        render(withIntl(
            <Avatar url={userAvatarUrl}/>,
        ));

        const avatar = screen.getByRole('img') as HTMLImageElement;
        const initialSrc = avatar.src;

        // Simulate image load error
        fireEvent.error(avatar);

        // Should not change src if it's already the fallback
        expect(avatar.src).toBe(initialSrc);
    });

    describe('getAvatarWidth', () => {
        test('should return correct width for xxs size', () => {
            expect(getAvatarWidth('xxs')).toBe('16px');
        });

        test('should return correct width for xs size', () => {
            expect(getAvatarWidth('xs')).toBe('20px');
        });

        test('should return correct width for sm size', () => {
            expect(getAvatarWidth('sm')).toBe('24px');
        });

        test('should return correct width for md size', () => {
            expect(getAvatarWidth('md')).toBe('32px');
        });

        test('should return correct width for lg size', () => {
            expect(getAvatarWidth('lg')).toBe('36px');
        });

        test('should return correct width for xl size', () => {
            expect(getAvatarWidth('xl')).toBe('50px');
        });

        test('should return correct width for xl-custom-GM size', () => {
            expect(getAvatarWidth('xl-custom-GM')).toBe('72px');
        });

        test('should return correct width for xl-custom-DM size', () => {
            expect(getAvatarWidth('xl-custom-DM')).toBe('96px');
        });

        test('should return correct width for xxl size', () => {
            expect(getAvatarWidth('xxl')).toBe('128px');
        });

        test('should return inherit for inherit size', () => {
            expect(getAvatarWidth('inherit')).toBe('inherit');
        });
    });
});
