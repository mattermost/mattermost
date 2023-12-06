// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'utils/constants';

import {needsLoggedInLimitReachedCheck} from './admin';

describe('views/admin reducers', () => {
    describe('needsLoggedInLimitReachedCheck', () => {
        it('defaults to false', () => {
            const actual = needsLoggedInLimitReachedCheck(undefined, {type: 'asdf'});
            expect(actual).toBe(false);
        });

        it('is set by NEEDS_LOGGED_IN_LIMIT_REACHED_CHECK', () => {
            const falseValue = needsLoggedInLimitReachedCheck(
                undefined,
                {type: ActionTypes.NEEDS_LOGGED_IN_LIMIT_REACHED_CHECK, data: false},
            );
            expect(falseValue).toBe(false);

            const trueValue = needsLoggedInLimitReachedCheck(
                false,
                {type: ActionTypes.NEEDS_LOGGED_IN_LIMIT_REACHED_CHECK, data: true},
            );
            expect(trueValue).toBe(true);
        });
    });
});
