// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import rhsSuppressed from 'reducers/views/rhs_suppressed';
import {ActionTypes} from 'utils/constants';

import type {GenericAction} from 'mattermost-redux/types/actions';

describe('Reducers.views.rhsSuppressed', () => {
    test('initialState', () => {
        expect(rhsSuppressed(undefined, {} as GenericAction)).toBe(false);
    });

    test('should handle SUPPRESS_RHS', () => {
        const action = {
            type: ActionTypes.SUPPRESS_RHS,
        };
        expect(rhsSuppressed(false, action)).toEqual(true);
    });

    test.each([
        [{type: ActionTypes.UNSUPPRESS_RHS}],
        [{type: ActionTypes.UPDATE_RHS_STATE}],
        [{type: ActionTypes.SELECT_POST}],
        [{type: ActionTypes.SELECT_POST_CARD}],
    ])('receiving an action that opens the RHS should unsuppress it', (action) => {
        expect(rhsSuppressed(true, action)).toEqual(false);
    });

    test.each([
        [{type: ActionTypes.UPDATE_RHS_STATE, state: null}],
        [{type: ActionTypes.SELECT_POST, postId: ''}],
        [{type: ActionTypes.SELECT_POST_CARD, postId: ''}],
    ])('receiving an action that closes the RHS should do nothing', (action) => {
        expect(rhsSuppressed(true, action)).toEqual(true);
        expect(rhsSuppressed(false, action)).toEqual(false);
    });
});
