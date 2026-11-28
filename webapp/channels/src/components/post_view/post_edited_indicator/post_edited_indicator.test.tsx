// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import PostEditedIndicator from './post_edited_indicator';

describe('PostEditedIndicator', () => {
    const post = TestHelper.getPostMock({id: 'post1', edit_at: 1000});
    const baseProps = {
        postId: post.id,
        editedAt: 1000,
        post,
        isMilitaryTime: false,
        canEdit: true,
        postOwner: true,
        testId: 'center.post_list.post.edited' as const,
        actions: {openShowEditHistory: jest.fn()},
    };

    test('the label that opens the edit history is a button with its testid', () => {
        renderWithContext(<PostEditedIndicator {...baseProps}/>);
        expect(screen.getByTestId('center.post_list.post.edited_history--button')).toHaveTextContent('Edited');
        expect(screen.queryByTestId('center.post_list.post.edited--text')).not.toBeInTheDocument();
    });

    test('a label the user can\'t open is text with its testid', () => {
        renderWithContext(
            <PostEditedIndicator
                {...baseProps}
                postOwner={false}
            />,
        );
        expect(screen.getByTestId('center.post_list.post.edited--text')).toHaveTextContent('Edited');
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    test('without a testId, no testid is rendered', () => {
        const {container} = renderWithContext(
            <PostEditedIndicator
                {...baseProps}
                testId={undefined}
            />,
        );
        expect(container.querySelector('[data-testid]')).toBeNull();
    });
});
