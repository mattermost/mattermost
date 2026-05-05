// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {TimerMessage} from './timer_message';

describe('components/post_view/timer_message/TimerMessage', () => {
    const basePost = TestHelper.getPostMock({
        props: {
            expire_at: Date.now() + 60000, // 1 minute from now
        },
    });

    test('should render countdown when timer is active', () => {
        renderWithContext(
            <TimerMessage post={basePost}/>,
        );

        const timer = screen.getByText(/\d{2}:\d{2}/);
        expect(timer).toBeInTheDocument();
    });

    test('should render with TimerMessage class', () => {
        const {container} = renderWithContext(
            <TimerMessage post={basePost}/>,
        );

        expect(container.querySelector('.TimerMessage')).toBeInTheDocument();
    });

    test('should render expired state when timer target is in the past', () => {
        const expiredPost = TestHelper.getPostMock({
            props: {
                expire_at: Date.now() - 1000,
            },
        });

        const {container} = renderWithContext(
            <TimerMessage post={expiredPost}/>,
        );

        expect(container.querySelector('.TimerMessage.expired')).toBeInTheDocument();
        expect(screen.getByText('00:00')).toBeInTheDocument();
    });

    test('should return null when post has no expire_at prop', () => {
        const noTimerPost = TestHelper.getPostMock({
            props: {},
        });

        const {container} = renderWithContext(
            <TimerMessage post={noTimerPost}/>,
        );

        expect(container.innerHTML).toBe('');
    });

    test('should return null when post is deleted', () => {
        const deletedPost = TestHelper.getPostMock({
            delete_at: Date.now(),
            props: {
                expire_at: Date.now() + 60000,
            },
        });

        const {container} = renderWithContext(
            <TimerMessage post={deletedPost}/>,
        );

        expect(container.innerHTML).toBe('');
    });

    test('should add rhs class when isRHS is true', () => {
        const {container} = renderWithContext(
            <TimerMessage
                post={basePost}
                isRHS={true}
            />,
        );

        expect(container.querySelector('.TimerMessage.rhs')).toBeInTheDocument();
    });
});
