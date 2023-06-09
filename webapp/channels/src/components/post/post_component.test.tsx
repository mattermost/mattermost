// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import {DeepPartial} from '@mattermost/types/utilities';

import {renderWithFullContext} from 'tests/react_testing_utils';

import {GlobalState} from 'types/store';

import {Locations} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import PostComponent from './post_component';
import mergeObjects from 'packages/mattermost-redux/test/merge_objects';

describe('PostComponent', () => {
    const baseProps = {
        center: false,
        currentTeam: TestHelper.getTeamMock(),
        currentUserId: 'currentUserId',
        displayName: '',
        isBot: false,
        isFlagged: false,
        isMobileView: false,
        isPostAcknowledgementsEnabled: false,
        isPostPriorityEnabled: false,
        location: Locations.CENTER,
        post: TestHelper.getPostMock(),
        recentEmojis: [],
        actions: {
            markPostAsUnread: jest.fn(),
            emitShortcutReactToLastPostFrom: jest.fn(),
            setActionsMenuInitialisationState: jest.fn(),
            selectPost: jest.fn(),
            selectPostFromRightHandSideSearch: jest.fn(),
            removePost: jest.fn(),
            closeRightHandSide: jest.fn(),
            selectPostCard: jest.fn(),
            setRhsExpanded: jest.fn(),
        },
    };

    describe('reactions', () => {
        const baseState: DeepPartial<GlobalState> = {
            entities: {
                posts: {
                    reactions: {
                        [baseProps.post.id]: {
                            [`${baseProps.currentUserId}-taco`]: TestHelper.getReactionMock({emoji_name: 'taco'}),
                        },
                    },
                },
            },
        };

        test('should show reactions in the center channel', () => {
            renderWithFullContext(
                <PostComponent
                    {...baseProps}
                />,
                baseState,
            );

            expect(screen.getByLabelText('reactions')).toBeInTheDocument();
        });

        test('should show reactions in thread view', () => {
            const state = mergeObjects(baseState, {
                views: {
                    rhs: {
                        selectedPostId: baseProps.post.id,
                    },
                },
            });

            const {rerender} = renderWithFullContext(
                <PostComponent
                    {...baseProps}
                    location={Locations.RHS_ROOT}
                />,
                state,
            );

            expect(screen.getByLabelText('reactions')).toBeInTheDocument();

            rerender(
                <PostComponent
                    {...baseProps}
                    location={Locations.RHS_COMMENT}
                />,
            );

            expect(screen.getByLabelText('reactions')).toBeInTheDocument();
        });

        test('should show only show reactions in search results with pinned/saved posts visible', () => {
            const {rerender} = renderWithFullContext(
                <PostComponent
                    {...baseProps}
                    location={Locations.SEARCH}
                />,
                baseState,
            );

            expect(screen.queryByLabelText('reactions')).not.toBeInTheDocument();

            rerender(
                <PostComponent
                    {...baseProps}
                    location={Locations.SEARCH}
                    isPinnedPosts={true}
                />,
            );

            expect(screen.getByLabelText('reactions')).toBeInTheDocument();

            rerender(
                <PostComponent
                    {...baseProps}
                    location={Locations.SEARCH}
                    isFlaggedPosts={true}
                />,
            );

            expect(screen.getByLabelText('reactions')).toBeInTheDocument();
        });
    });
});
