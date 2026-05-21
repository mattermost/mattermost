// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

// Isolate the two handlers under test from the rest of websocket_actions
// module graph by mocking the redux store and post selector they depend on.
// A heavier full-store test would pull in the entire websocket_actions graph,
// which is out of scope — this test targets the bug-prone Props patching.

const mockDispatch = jest.fn();
const mockGetState = jest.fn();

jest.mock('stores/redux_store', () => ({
    dispatch: (...args: unknown[]) => mockDispatch(...args),
    getState: () => mockGetState(),
}));

const mockGetPageCommentById = jest.fn();
jest.mock('mattermost-redux/selectors/entities/pages', () => {
    const original = jest.requireActual('mattermost-redux/selectors/entities/pages');
    return {
        ...original,
        getPageCommentById: (...args: unknown[]) => mockGetPageCommentById(...args),
    };
});

import {handlePageCommentResolvedEvent, handlePageCommentUnresolvedEvent} from './websocket_actions';

type WSMessage = Parameters<typeof handlePageCommentResolvedEvent>[0];

const makeMessage = (data: Record<string, unknown>): WSMessage =>
    ({data, broadcast: {} as any, seq: 0, event: 'page_comment_resolved'} as unknown as WSMessage);

describe('page comment websocket handlers', () => {
    beforeEach(() => {
        mockDispatch.mockClear();
        mockGetState.mockClear();
        mockGetPageCommentById.mockClear();
    });

    describe('handlePageCommentResolvedEvent', () => {
        it('patches resolved_at / resolved_by into post props before dispatching', () => {
            const comment = {
                id: 'c1',
                props: {existing: 'value'},
            } as unknown as Post;
            mockGetPageCommentById.mockReturnValue(comment);

            handlePageCommentResolvedEvent(makeMessage({
                comment_id: 'c1',
                page_id: 'p1',
                resolved_at: 12345,
                resolved_by: 'userA',
            }));

            expect(mockDispatch).toHaveBeenCalledTimes(2);
            const action = mockDispatch.mock.calls[0][0];
            expect(action.type).toBe('RECEIVED_PAGE_COMMENT');
            expect(action.data.comment.props).toEqual({
                existing: 'value',
                comment_resolved: true,
                resolved_at: 12345,
                resolved_by: 'userA',
            });

            // Second dispatch syncs the updated comment into the posts store.
            const syncAction = mockDispatch.mock.calls[1][0];
            expect(syncAction.type).toBe('RECEIVED_POST');
            expect(syncAction.data).toBe(action.data.comment);

            // Original post must not be mutated (reducer relies on reference equality).
            expect(comment.props).toEqual({existing: 'value'});
            expect(action.data.comment).not.toBe(comment);
        });

        it('is a no-op when post is not cached', () => {
            mockGetPageCommentById.mockReturnValue(undefined);

            handlePageCommentResolvedEvent(makeMessage({
                comment_id: 'missing',
                page_id: 'p1',
                resolved_at: 1,
                resolved_by: 'u',
            }));

            expect(mockDispatch).not.toHaveBeenCalled();
        });
    });

    describe('handlePageCommentUnresolvedEvent', () => {
        it('strips resolved_at / resolved_by from post props before dispatching', () => {
            const comment = {
                id: 'c1',
                props: {existing: 'value', comment_resolved: true, resolved_at: 9, resolved_by: 'userA'},
            } as unknown as Post;
            mockGetPageCommentById.mockReturnValue(comment);

            handlePageCommentUnresolvedEvent(makeMessage({comment_id: 'c1', page_id: 'p1'}));

            expect(mockDispatch).toHaveBeenCalledTimes(2);
            const action = mockDispatch.mock.calls[0][0];
            expect(action.type).toBe('RECEIVED_PAGE_COMMENT');
            expect(action.data.comment.props).toEqual({existing: 'value'});
            expect(action.data.comment.props.comment_resolved).toBeUndefined();
            expect(action.data.comment.props.resolved_at).toBeUndefined();
            expect(action.data.comment.props.resolved_by).toBeUndefined();

            const syncAction = mockDispatch.mock.calls[1][0];
            expect(syncAction.type).toBe('RECEIVED_POST');
            expect(syncAction.data).toBe(action.data.comment);

            // Original post must not be mutated.
            expect(comment.props).toEqual({existing: 'value', comment_resolved: true, resolved_at: 9, resolved_by: 'userA'});
        });

        it('handles absent props object without throwing', () => {
            const comment: Post = {id: 'c1'} as Post;
            mockGetPageCommentById.mockReturnValue(comment);

            expect(() => handlePageCommentUnresolvedEvent(makeMessage({comment_id: 'c1', page_id: 'p1'}))).not.toThrow();
            expect(mockDispatch).toHaveBeenCalledTimes(2);
            expect(mockDispatch.mock.calls[0][0].data.comment.props).toEqual({});
            expect(mockDispatch.mock.calls[1][0].type).toBe('RECEIVED_POST');
        });
    });
});
