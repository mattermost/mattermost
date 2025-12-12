// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import FailedPostOptions from 'components/post_view/failed_post_options/failed_post_options';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/post_view/FailedPostOptions', () => {
    const baseProps = {
        post: TestHelper.getPostMock(),
        actions: {
            createPost: jest.fn(),
            removePost: jest.fn(),
        },
    };

    test('should match default component state', () => {
        renderWithContext(<FailedPostOptions {...baseProps}/>);

        const retryButton = screen.getByRole('button', {name: 'Retry'});
        const deleteButton = screen.getByRole('button', {name: 'Delete'});

        expect(retryButton).toBeInTheDocument();
        expect(retryButton).toHaveClass('pending-post-actions__button', 'pending-post-actions__button--retry', 'post-retry');

        expect(deleteButton).toBeInTheDocument();
        expect(deleteButton).toHaveClass('pending-post-actions__button', 'pending-post-actions__button--delete', 'post-delete');

        expect(screen.getAllByRole('button')).toHaveLength(2);
    });

    test('should create post on retry', async () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                createPost: jest.fn(),
            },
        };

        renderWithContext(<FailedPostOptions {...props}/>);

        const retryButton = screen.getByRole('button', {name: 'Retry'});

        await userEvent.click(retryButton);

        expect(props.actions.createPost.mock.calls.length).toBe(1);

        await userEvent.click(retryButton);

        expect(props.actions.createPost.mock.calls.length).toBe(2);
    });

    test('should remove post on cancel', async () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                removePost: jest.fn(),
            },
        };

        renderWithContext(<FailedPostOptions {...props}/>);

        const deleteButton = screen.getByRole('button', {name: 'Delete'});

        await userEvent.click(deleteButton);

        expect(props.actions.removePost.mock.calls.length).toBe(1);
    });
});
