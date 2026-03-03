// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import WikiNewCommentView from './wiki_new_comment_view';

jest.mock('components/threading/virtualized_thread_viewer/create_comment', () => ({
    __esModule: true,
    default: ({placeholder}: {placeholder?: string}) => (
        <div data-testid='create-comment'>
            <input placeholder={placeholder}/>
        </div>
    ),
}));

describe('components/wiki_rhs/WikiNewCommentView', () => {
    const mockPageId = 'page-id-123';
    const mockChannelId = 'channel-id-789';
    const mockAnchor = {anchor_id: 'anchor-123', text: 'Selected text for comment'};

    const getInitialState = (): DeepPartial<GlobalState> => ({
        entities: {
            posts: {
                posts: {
                    [mockPageId]: {
                        id: mockPageId,
                        channel_id: mockChannelId,
                        type: 'page',
                    },
                },
            },
            channels: {
                channels: {
                    [mockChannelId]: {
                        id: mockChannelId,
                        name: 'test-channel',
                        type: 'O',
                        delete_at: 0,
                    },
                },
            },
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

    test('should render CreateComment component', () => {
        renderWithContext(<WikiNewCommentView {...getBaseProps()}/>, getInitialState());

        expect(screen.getByTestId('create-comment')).toBeInTheDocument();
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
                posts: {
                    posts: {},
                },
                channels: {
                    channels: {},
                },
            },
        };

        const {container} = renderWithContext(<WikiNewCommentView {...getBaseProps()}/>, stateWithoutPage);

        expect(container.firstChild).toBeNull();
    });

    test('should return null when channel is not found', () => {
        const stateWithoutChannel: DeepPartial<GlobalState> = {
            entities: {
                posts: {
                    posts: {
                        [mockPageId]: {
                            id: mockPageId,
                            channel_id: mockChannelId,
                            type: 'page',
                        },
                    },
                },
                channels: {
                    channels: {},
                },
            },
        };

        const {container} = renderWithContext(<WikiNewCommentView {...getBaseProps()}/>, stateWithoutChannel);

        expect(container.firstChild).toBeNull();
    });
});
