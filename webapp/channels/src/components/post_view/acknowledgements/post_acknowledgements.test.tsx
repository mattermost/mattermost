// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {acknowledgePost} from 'mattermost-redux/actions/posts';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import PostAcknowledgements from './post_acknowledgements';

jest.mock('mattermost-redux/actions/posts', () => ({
    acknowledgePost: jest.fn(() => ({type: 'MOCK_ACKNOWLEDGE_POST'})),
    unacknowledgePost: jest.fn(() => ({type: 'MOCK_UNACKNOWLEDGE_POST'})),
}));

describe('components/post_view/acknowledgements/PostAcknowledgements', () => {
    const baseProps = {
        authorId: 'author_id',
        currentUserId: 'current_user_id',
        hasReactions: false,
        isDeleted: false,
        list: [],
        postId: 'post_id',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('acknowledges the post on click', async () => {
        renderWithContext(<PostAcknowledgements {...baseProps}/>);

        await userEvent.click(screen.getByRole('button', {name: 'Acknowledge'}));

        expect(acknowledgePost).toHaveBeenCalledWith('post_id');
    });

    // The server refuses an acknowledgement the channel's write rules deny, so the
    // button must not send one.
    test('does not acknowledge when channel write access is denied', async () => {
        renderWithContext(
            <PostAcknowledgements
                {...baseProps}
                isWriteDenied={true}
            />,
        );

        const button = screen.getByRole('button', {name: 'Acknowledge'});
        expect(button).toHaveClass('AcknowledgementButton--disabled');

        await userEvent.click(button);

        expect(acknowledgePost).not.toHaveBeenCalled();
    });
});
