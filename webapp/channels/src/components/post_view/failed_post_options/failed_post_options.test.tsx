// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import FailedPostOptions from 'components/post_view/failed_post_options/failed_post_options';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/post_view/FailedPostOptions', () => {
    const baseProps = {
        post: TestHelper.getPostMock(),
        location: 'CENTER' as const,
        actions: {
            createPost: jest.fn(),
            removePost: jest.fn(),
        },
    };

    test('should match default component state', () => {
        renderWithContext(<FailedPostOptions {...baseProps}/>);

        const retryButton = screen.getByRole('button', { name: 'Retry' });
        const cancelButton = screen.getByRole('button', { name: 'Cancel' });

        expect(retryButton).toBeInTheDocument();
        expect(retryButton).toHaveClass('post-retry-button');

        expect(cancelButton).toBeInTheDocument();
        expect(cancelButton).toHaveClass('post-cancel-button');

        expect(screen.getAllByRole('button')).toHaveLength(2);
    });

    test('should create post on retry', () => {
        const props = {
            ...baseProps,
            location: 'CENTER' as const,
            actions: {
                ...baseProps.actions,
                createPost: jest.fn(),
            },
        };

        renderWithContext(<FailedPostOptions {...props}/>);

        const retryButton = screen.getByRole('button', { name: 'Retry' });

        userEvent.click(retryButton);

        expect(props.actions.createPost.mock.calls.length).toBe(1);

        userEvent.click(retryButton);

        expect(props.actions.createPost.mock.calls.length).toBe(2);
    });

    test('should remove post on cancel', () => {
        const props = {
            ...baseProps,
            location: 'CENTER' as const,
            actions: {
                ...baseProps.actions,
                removePost: jest.fn(),
            },
        };

        renderWithContext(<FailedPostOptions {...props}/>);

        const cancelButton = screen.getByRole('button', { name: 'Cancel' });

        userEvent.click(cancelButton);

        expect(props.actions.removePost.mock.calls.length).toBe(1);
    });
});
