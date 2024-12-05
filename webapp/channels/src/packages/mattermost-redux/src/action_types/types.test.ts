// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @typescript-eslint/no-unused-vars */

import keyMirror from 'key-mirror';

import type {AnyActionFrom, SomeAction} from './types';

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

type TestAction2 = AnyActionFrom<typeof testRequestActions> | SomeAction<typeof testActions, TestActionTypes>;

const action4: TestAction2 = action1;
const action5: TestAction2 = action2;
const action6: TestAction2 = action3;
