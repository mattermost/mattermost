// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {makeInitialPagesState} from 'tests/helpers/pages_state';
import {renderWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import WikiNewCommentView from './wiki_new_comment_view';

jest.mock('actions/views/create_page_comment', () => ({
    submitPageComment: jest.fn(() => () => Promise.resolve({created: true})),
}));

describe('components/wiki_rhs/WikiNewCommentView', () => {
    const mockPageId = 'page-id-123';
    const mockChannelId = 'channel-id-789';
    const mockAnchor = {anchor_id: 'anchor-123', text: 'Selected text for comment'};

    const getInitialState = (): DeepPartial<GlobalState> => ({
        entities: {
            pages: makeInitialPagesState({
                byId: {
                    [mockPageId]: {
                        id: mockPageId,
                        channel_id: mockChannelId,
                        type: 'page',
                    } as any,
                },
            }),
        },
    });

    const getBaseProps = () => ({
        pageId: mockPageId,
        anchor: mockAnchor,
    });

    test('should render anchor text in blockquote', () => {
        renderWithContext(<WikiNewCommentView {...getBaseProps()}/>, getInitialState());

        expect(screen.getByText('Selected text for comment')).toBeInTheDocument();
    });

    test('should render comment-create container', () => {
        renderWithContext(<WikiNewCommentView {...getBaseProps()}/>, getInitialState());

        expect(screen.getByTestId('comment-create')).toBeInTheDocument();
    });

    test('should render placeholder text', () => {
        renderWithContext(<WikiNewCommentView {...getBaseProps()}/>, getInitialState());

        expect(screen.getByPlaceholderText('Add your comment...')).toBeInTheDocument();
    });

    test('should render fallback text when anchor text is empty', () => {
        const props = {
            ...getBaseProps(),
            anchor: {anchor_id: 'anchor-123', text: ''},
        };

        renderWithContext(<WikiNewCommentView {...props}/>, getInitialState());

        expect(screen.getByText('No text selected')).toBeInTheDocument();
    });

    test('should return null when page is not found', () => {
        const stateWithoutPage: DeepPartial<GlobalState> = {
            entities: {
                pages: makeInitialPagesState(),
            },
        };

        const {container} = renderWithContext(<WikiNewCommentView {...getBaseProps()}/>, stateWithoutPage);

        expect(container.firstChild).toBeNull();
    });
});
