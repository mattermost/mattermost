// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import PostPreHeader from 'components/post_view/post_pre_header/post_pre_header';

import {renderWithContext, screen, userEvent} from 'tests/vitest_react_testing_utils';

describe('components/PostPreHeader', () => {
    const baseProps = {
        channelId: 'channel_id',
        actions: {
            showFlaggedPosts: vi.fn(),
            showPinnedPosts: vi.fn(),
        },
    };

    test('should not render anything if the post is neither flagged nor pinned', () => {
        const props = {
            ...baseProps,
            isFlagged: false,
            isPinned: false,
        };

        const {container} = renderWithContext(
            <PostPreHeader {...props}/>,
        );

        expect(container.querySelector('div.post-pre-header')).toBeNull();
        expect(container).toMatchSnapshot();
    });

    test('should not render anything if both skipFlagged and skipPinned are true', () => {
        const props = {
            ...baseProps,
            isFlagged: true,
            isPinned: true,
            skipFlagged: true,
            skipPinned: true,
        };

        const {container} = renderWithContext(
            <PostPreHeader {...props}/>,
        );

        expect(container.querySelector('div.post-pre-header')).toBeNull();
        expect(container).toMatchSnapshot();
    });

    test('should properly handle flagged posts (and not pinned)', () => {
        const props = {
            ...baseProps,
            isFlagged: true,
            isPinned: false,
        };

        const {container, rerender} = renderWithContext(
            <PostPreHeader {...props}/>,
        );

        expect(container.querySelector('.icon-pin')).toBeNull();
        expect(screen.getByRole('img', {name: 'Saved Icon'})).toBeInTheDocument();
        expect(screen.getByText('Saved')).toBeInTheDocument();
        expect(container).toMatchSnapshot();

        // case of skipFlagged is true
        rerender(
            <PostPreHeader
                {...props}
                skipFlagged={true}
            />,
        );

        expect(screen.queryByRole('img', {name: 'Saved Icon'})).not.toBeInTheDocument();
        expect(screen.queryByText('Saved')).not.toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should properly handle pinned posts (and not flagged)', () => {
        const props = {
            ...baseProps,
            isFlagged: false,
            isPinned: true,
        };

        const {container, rerender} = renderWithContext(
            <PostPreHeader {...props}/>,
        );

        expect(screen.queryByRole('img', {name: 'Saved Icon'})).not.toBeInTheDocument();
        expect(container.querySelector('.icon-pin')).toBeInTheDocument();
        expect(screen.getByText('Pinned')).toBeInTheDocument();
        expect(container).toMatchSnapshot();

        // case of skipPinned is true
        rerender(
            <PostPreHeader
                {...props}
                skipPinned={true}
            />,
        );

        expect(container.querySelector('.icon-pin')).toBeNull();
        expect(screen.queryByText('Pinned')).not.toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    describe('should properly handle posts that are flagged and pinned', () => {
        test('both skipFlagged and skipPinned are not true', () => {
            const props = {
                ...baseProps,
                isFlagged: true,
                isPinned: true,
            };

            const {container} = renderWithContext(
                <PostPreHeader {...props}/>,
            );

            expect(screen.getByRole('img', {name: 'Saved Icon'})).toBeInTheDocument();
            expect(container.querySelector('.icon-pin')).toBeInTheDocument();
            expect(screen.getByText('Pinned')).toBeInTheDocument();
            expect(screen.getByText('Saved')).toBeInTheDocument();
            expect(container).toMatchSnapshot();
        });

        test('skipFlagged is true', () => {
            const props = {
                ...baseProps,
                isFlagged: true,
                isPinned: true,
                skipFlagged: true,
            };

            const {container} = renderWithContext(
                <PostPreHeader {...props}/>,
            );

            expect(screen.queryByRole('img', {name: 'Saved Icon'})).not.toBeInTheDocument();
            expect(container.querySelector('.icon-pin')).toBeInTheDocument();
            expect(screen.getByText('Pinned')).toBeInTheDocument();
            expect(container).toMatchSnapshot();
        });

        test('skipPinned is true', () => {
            const props = {
                ...baseProps,
                isFlagged: true,
                isPinned: true,
                skipPinned: true,
            };

            const {container} = renderWithContext(
                <PostPreHeader {...props}/>,
            );

            expect(container.querySelector('.icon-pin')).toBeNull();
            expect(screen.getByRole('img', {name: 'Saved Icon'})).toBeInTheDocument();
            expect(screen.getByText('Saved')).toBeInTheDocument();
            expect(container).toMatchSnapshot();
        });
    });

    test('should properly handle link clicks', async () => {
        const props = {
            ...baseProps,
            isFlagged: true,
            isPinned: true,
        };

        const {container} = renderWithContext(
            <PostPreHeader {...props}/>,
        );

        expect(screen.getByRole('img', {name: 'Saved Icon'})).toBeInTheDocument();
        expect(container.querySelector('.icon-pin')).toBeInTheDocument();
        expect(container).toMatchSnapshot();

        // Get all anchor links in the component
        const links = container.querySelectorAll('a');
        await userEvent.click(links[0]); // First link is "Pinned"
        expect(baseProps.actions.showPinnedPosts).toHaveBeenNthCalledWith(1, baseProps.channelId);

        await userEvent.click(links[1]); // Second link is "Saved"
        expect(baseProps.actions.showFlaggedPosts).toHaveBeenNthCalledWith(1);
    });
});
