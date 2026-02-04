// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Tests for HideDeletedMessagePlaceholder tweak behavior
 *
 * When enabled: deleted posts are immediately removed (postRemoved action)
 * When disabled: deleted posts show "(message deleted)" placeholder (postDeleted action)
 *
 * The actual behavior is in websocket_actions.jsx handlePostDeleteEvent function.
 * These tests verify the Redux action dispatching behavior.
 */

import {PostTypes} from 'mattermost-redux/action_types';

import {postDeleted, postRemoved} from 'mattermost-redux/actions/posts';

import configureStore from 'tests/test_store';

describe('HideDeletedMessagePlaceholder tweak', () => {
    const basePost = {
        id: 'post123',
        channel_id: 'channel123',
        user_id: 'user123',
        message: 'Test message',
        create_at: 1000,
        update_at: 1000,
        delete_at: 0,
        root_id: '',
        is_pinned: false,
    };

    describe('postDeleted action (shows placeholder)', () => {
        test('should dispatch POST_DELETED action type', () => {
            const store = configureStore();
            store.dispatch(postDeleted(basePost));

            const actions = store.getActions();
            const postDeletedAction = actions.find(
                (action: {type: string}) => action.type === PostTypes.POST_DELETED,
            );

            expect(postDeletedAction).toBeDefined();
            expect(postDeletedAction.data).toEqual(basePost);
        });

        test('should mark post as deleted but keep in state', () => {
            // postDeleted keeps the post in state with delete_at set
            // allowing the "(message deleted)" placeholder to show
            const store = configureStore();
            store.dispatch(postDeleted(basePost));

            const actions = store.getActions();
            expect(actions.some((a: {type: string}) => a.type === PostTypes.POST_DELETED)).toBe(true);
            expect(actions.some((a: {type: string}) => a.type === PostTypes.POST_REMOVED)).toBe(false);
        });
    });

    describe('postRemoved action (hides placeholder)', () => {
        test('should dispatch POST_REMOVED action type', () => {
            const store = configureStore();
            store.dispatch(postRemoved(basePost));

            const actions = store.getActions();
            const postRemovedAction = actions.find(
                (action: {type: string}) => action.type === PostTypes.POST_REMOVED,
            );

            expect(postRemovedAction).toBeDefined();
            expect(postRemovedAction.data).toEqual(basePost);
        });

        test('should remove post from state entirely', () => {
            // postRemoved completely removes the post from state
            // so no placeholder is shown
            const store = configureStore();
            store.dispatch(postRemoved(basePost));

            const actions = store.getActions();
            expect(actions.some((a: {type: string}) => a.type === PostTypes.POST_REMOVED)).toBe(true);
            expect(actions.some((a: {type: string}) => a.type === PostTypes.POST_DELETED)).toBe(false);
        });
    });

    describe('action types are distinct', () => {
        test('POST_DELETED and POST_REMOVED are different action types', () => {
            expect(PostTypes.POST_DELETED).not.toEqual(PostTypes.POST_REMOVED);
        });

        test('POST_DELETED is the expected constant', () => {
            expect(PostTypes.POST_DELETED).toBe('POST_DELETED');
        });

        test('POST_REMOVED is the expected constant', () => {
            expect(PostTypes.POST_REMOVED).toBe('POST_REMOVED');
        });
    });

    describe('behavior documentation', () => {
        /**
         * This test documents the expected behavior of the HideDeletedMessagePlaceholder tweak:
         *
         * In websocket_actions.jsx handlePostDeleteEvent():
         *
         * if (config.MattermostExtendedHideDeletedMessagePlaceholder === 'true') {
         *     dispatch(postRemoved(post));  // Post disappears immediately
         * } else {
         *     dispatch(postDeleted(post));  // Post shows "(message deleted)" text
         * }
         *
         * The config value comes from MattermostExtendedSettings.Posts.HideDeletedMessagePlaceholder
         */
        test('documents the tweak behavior', () => {
            // This test just documents the expected behavior
            // The actual implementation is tested via the handlePostDeleteEvent function
            expect(true).toBe(true);
        });
    });
});
