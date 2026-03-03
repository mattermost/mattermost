// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import AllWikiThreads from './all_wiki_threads';

describe('components/wiki_rhs/AllWikiThreads', () => {
    const mockWikiId = 'wiki-id-1';
    const mockUserId = 'user-id-1';
    const mockTeamId = 'team-id-1';
    const mockChannelId = 'channel-id-1';
    const pageId1 = 'page-id-1';
    const pageId2 = 'page-id-2';

    const getInitialState = (): DeepPartial<GlobalState> => ({
        entities: {
            users: {
                currentUserId: mockUserId,
            },
            teams: {
                currentTeamId: mockTeamId,
            },
            posts: {
                posts: {
                    [pageId1]: {
                        id: pageId1,
                        channel_id: mockChannelId,
                        type: 'custom_page',
                        props: {title: 'Page One'},
                    } as any,
                    [pageId2]: {
                        id: pageId2,
                        channel_id: mockChannelId,
                        type: 'custom_page',
                        props: {title: 'Page Two'},
                    } as any,
                },
            },
            wikiPages: {
                byWiki: {
                    [mockWikiId]: [pageId1, pageId2],
                },
            },
        },
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        test('should show empty state when no threads exist', async () => {
            const onThreadClick = jest.fn();

            renderWithContext(
                <AllWikiThreads
                    wikiId={mockWikiId}
                    onThreadClick={onThreadClick}
                />,
                getInitialState(),
            );

            await waitFor(() => {
                expect(screen.getByText('No comment threads in this wiki yet')).toBeInTheDocument();
            });
        });
    });
});
