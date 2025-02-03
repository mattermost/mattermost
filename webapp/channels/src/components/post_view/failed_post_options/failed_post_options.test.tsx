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

        const retryLink = screen.getByText('Retry');
        const cancelLink = screen.getByText('Cancel');

        expect(retryLink).toBeInTheDocument();
        expect(retryLink).toHaveClass('post-retry');
        expect(retryLink).toHaveAttribute('href', '#');

        expect(cancelLink).toBeInTheDocument();
        expect(cancelLink).toHaveClass('post-cancel');
        expect(cancelLink).toHaveAttribute('href', '#');

        expect(screen.getAllByRole('link')).toHaveLength(2);
    });

    test('should create post on retry', () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                createPost: jest.fn(),
            },
        };

        renderWithContext(<FailedPostOptions {...props}/>);

        const retryLink = screen.getByText('Retry');

        userEvent.click(retryLink);

        expect(props.actions.createPost.mock.calls.length).toBe(1);

        userEvent.click(retryLink);

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

        renderWithContext(<FailedPostOptions {...props}/>);

        const cancelLink = screen.getByText('Cancel');

        userEvent.click(cancelLink);

        expect(props.actions.removePost.mock.calls.length).toBe(1);
    });
});
