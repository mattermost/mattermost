// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @typescript-eslint/no-unused-vars */

import keyMirror from 'key-mirror';

import type {AnyActionFrom, SomeAction} from './types';

test('should type check these actions properly', () => {
    const testRequestActions = keyMirror({
        SEND_REQUESTED: null,
        SEND_SUCCESS: null,
        SEND_FAILED: null,
    });

    const testActions = keyMirror({
        SOMETHING_OCCURRED: null,

        RECEIVED_SOMETHING: null,
        SOMETHING_DELETED: null,
    });

    type TestActionTypes = {
        RECEIVED_USER_PROFILE: {
            type: 'RECEIVED_SOMETHING';
            data: {
                id: string;
                name: 'something';
            };
        };
        SOMETHING_DELETED: {
            type: 'SOMETHING_DELETED';
            data: {
                id: string;
            };
        };
    };

    // Test when all of the types in a single place
    type TestAction1 = SomeAction<typeof testRequestActions & typeof testActions, TestActionTypes>;

    const action1: TestAction1 = {
        type: 'RECEIVED_SOMETHING',
        data: {
            id: 'something1',
            name: 'something',
        },
    };

    const action2: TestAction1 = {
        type: 'SOMETHING_DELETED',
        data: {
            id: 'something1',

            // @ts-expect-error This field should be rejected
            name: 'something',
        },
    };

    const action3: TestAction1 = {
        type: 'SEND_SUCCESS',

        // Arbitrary fields should be allowed
        data: 456,
        someOthervalue: 'aaaa',
    };

    const action4: TestAction1 = {

        // @ts-expect-error This action type doesn't exist
        type: 'INVALID_VALUE',
    };

    // Test when types are defined in different places and then combined later
    type RequestAction = AnyActionFrom<typeof testRequestActions>;
    type TestAction = SomeAction<typeof testActions, TestActionTypes>
    type TestAction2 = RequestAction | TestAction;

    const action5: TestAction2 = action1;
    const action6: TestAction2 = action2;
    const action7: TestAction2 = action3;

    const action8: TestAction2 = {

        // @ts-expect-error This action type doesn't exist
        type: 'INVALID_VALUE',
    };
});
