// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {setupWikiTestContext, createTestPage, type WikiTestContext} from 'tests/api_test_helpers';
import {renderWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import AllWikiThreads from './all_wiki_threads';

describe('components/wiki_rhs/AllWikiThreads', () => {
    let testContext: WikiTestContext;
    let pageId1: string;
    let pageId2: string;

    beforeAll(async () => {
        testContext = await setupWikiTestContext();
        pageId1 = await createTestPage(testContext.wikiId, 'Page One');
        pageId2 = await createTestPage(testContext.wikiId, 'Page Two');
        testContext.pageIds.push(pageId1, pageId2);
    }, 30000);

    afterAll(async () => {
        await testContext.cleanup();
    }, 30000);

    const getInitialState = (): DeepPartial<GlobalState> => ({
        entities: {
            users: {
                currentUserId: testContext.user.id,
            },
            teams: {
                currentTeamId: testContext.team.id,
            },
            posts: {
                posts: {
                    [pageId1]: {
                        id: pageId1,
                        channel_id: testContext.channel.id,
                        type: 'custom_page',
                        props: {title: 'Page One'},
                    } as any,
                    [pageId2]: {
                        id: pageId2,
                        channel_id: testContext.channel.id,
                        type: 'custom_page',
                        props: {title: 'Page Two'},
                    } as any,
                },
            },
            wikiPages: {
                byWiki: {
                    [testContext.wikiId]: [pageId1, pageId2],
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
                    wikiId={testContext.wikiId}
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
