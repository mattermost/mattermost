// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WebsocketEvents} from 'mattermost-redux/constants';

import typingReducer from 'mattermost-redux/reducers/entities/typing';

import TestHelper from '../../../test/test_helper';
import {GenericAction} from 'mattermost-redux/types/actions';

describe('Reducers.Typing', () => {
    it('initial state', async () => {
        let state = {};

        state = typingReducer(
            state,
            {} as GenericAction,
        );
        expect(state).toEqual({});
    });

    it('WebsocketEvents.TYPING', async () => {
        let state = {};

        const id1 = TestHelper.generateId();
        const userId1 = TestHelper.generateId();
        const now1 = 1234;

        state = typingReducer(
            state,
            {
                type: WebsocketEvents.TYPING,
                data: {
                    id: id1,
                    userId: userId1,
                    now: now1,
                },
            },
        );

        // first user typing
        expect(state).toEqual({
            [id1]: {
                [userId1]: now1,
            },
        });

        const id2 = TestHelper.generateId();
        const now2 = 1235;

        state = typingReducer(
            state,
            {
                type: WebsocketEvents.TYPING,
                data: {
                    id: id2,
                    userId: userId1,
                    now: now2,
                },
            },
        );

        // user typing in second channel
        expect(state).toEqual({
            [id1]: {
                [userId1]: now1,
            },
            [id2]: {
                [userId1]: now2,
            },
        });

        const userId2 = TestHelper.generateId();
        const now3 = 1237;

        state = typingReducer(
            state,
            {
                type: WebsocketEvents.TYPING,
                data: {
                    id: id1,
                    userId: userId2,
                    now: now3,
                },
            },
        );

        // second user typing in channel
        expect(state).toEqual({
            [id1]: {
                [userId1]: now1,
                [userId2]: now3,
            },
            [id2]: {
                [userId1]: now2,
            },
        });

        const now4 = 1238;

        state = typingReducer(
            state,
            {
                type: WebsocketEvents.TYPING,
                data: {
                    id: id2,
                    userId: userId2,
                    now: now4,
                },
            },
        );

        // second user typing in second channel
        expect(state).toEqual({
            [id1]: {
                [userId1]: now1,
                [userId2]: now3,
            },
            [id2]: {
                [userId1]: now2,
                [userId2]: now4,
            },
        });
    });

    it('WebsocketEvents.STOP_TYPING', async () => {
        const id1 = TestHelper.generateId();
        const id2 = TestHelper.generateId();

        const userId1 = TestHelper.generateId();
        const userId2 = TestHelper.generateId();

        const now1 = 1234;
        const now2 = 1235;
        const now3 = 1236;
        const now4 = 1237;

        let state = {
            [id1]: {
                [userId1]: now1,
                [userId2]: now3,
            },
            [id2]: {
                [userId1]: now2,
                [userId2]: now4,
            },
        };

        state = typingReducer(
            state,
            {
                type: WebsocketEvents.STOP_TYPING,
                data: {
                    id: id1,
                    userId: userId1,
                    now: now1,
                },
            },
        );

        // deleting first user from first channel
        expect(state).toEqual({
            [id1]: {
                [userId2]: now3,
            },
            [id2]: {
                [userId1]: now2,
                [userId2]: now4,
            },
        });

        state = typingReducer(
            state,
            {
                type: WebsocketEvents.STOP_TYPING,
                data: {
                    id: id2,
                    userId: userId1,
                    now: now2,
                },
            },
        );

        // deleting first user from second channel
        expect(state).toEqual({
            [id1]: {
                [userId2]: now3,
            },
            [id2]: {
                [userId2]: now4,
            },
        });

        state = typingReducer(
            state,
            {
                type: WebsocketEvents.STOP_TYPING,
                data: {
                    id: id1,
                    userId: userId2,
                    now: now3,
                },
            },
        );

        // deleting second user from first channel
        expect(state).toEqual({
            [id2]: {
                [userId2]: now4,
            },
        },
        );

        state = typingReducer(
            state,
            {
                type: WebsocketEvents.STOP_TYPING,
                data: {
                    id: id2,
                    userId: userId2,
                    now: now4,
                },
            },
        );

        // deleting second user from second channel
        expect(state).toEqual({});

        state = {
            [id1]: {
                [userId1]: now2,
            },
        };
        state = typingReducer(
            state,
            {
                type: WebsocketEvents.STOP_TYPING,
                data: {
                    id: id1,
                    userId: userId1,
                    now: now1,
                },
            },
        );

        // shouldn't delete when the timestamp is older
        expect(state).toEqual({
            [id1]: {
                [userId1]: now2,
            },
        });

        state = typingReducer(
            state,
            {
                type: WebsocketEvents.STOP_TYPING,
                data: {
                    id: id1,
                    userId: userId1,
                    now: now3,
                },
            },
        );

        // should delete when the timestamp is newer
        expect(state).toEqual({});
    });
});
