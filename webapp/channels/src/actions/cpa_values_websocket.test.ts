// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserTypes} from 'mattermost-redux/action_types';
import {getCustomProfileAttributeValues} from 'mattermost-redux/actions/users';

import {handleCustomAttributeValuesUpdated} from 'actions/websocket_actions';

import mockStore from 'tests/test_store';

const USER_ID = 'user_id_1';
const FIELD_ID = 'field_id_1';
const OTHER_FIELD_ID = 'field_id_2';

jest.mock('mattermost-redux/actions/users', () => ({
    ...jest.requireActual('mattermost-redux/actions/users'),
    getCustomProfileAttributeValues: jest.fn(() => ({type: ''})),
}));

function dispatchEvent(values: Record<string, unknown>) {
    const store = mockStore({
        entities: {
            general: {config: {}, license: {}},
            users: {currentUserId: USER_ID, profiles: {}},
        },
    });

    const msg = {
        event: 'custom_attribute_values_updated',
        data: {user_id: USER_ID, values},
        broadcast: {omit_users: null, user_id: '', channel_id: '', team_id: ''},
        seq: 1,
    };

    store.dispatch(handleCustomAttributeValuesUpdated(msg as any) as any);
    return store.getActions();
}

describe('custom_attribute_values_updated withheld entries', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('a mixed event dispatches RECEIVED_CPA_VALUES with only the real entry', () => {
        const actions = dispatchEvent({
            [FIELD_ID]: 'AURORA',
            [OTHER_FIELD_ID]: {withheld: true},
        });

        const received = actions.find((a: any) => a.type === UserTypes.RECEIVED_CPA_VALUES);
        expect(received.data.customAttributeValues).toEqual({[FIELD_ID]: 'AURORA'});
    });

    test('an event whose every entry is withheld dispatches no RECEIVED_CPA_VALUES', () => {
        const actions = dispatchEvent({[FIELD_ID]: {withheld: true}});

        expect(actions.some((a: any) => a.type === UserTypes.RECEIVED_CPA_VALUES)).toBe(false);
    });

    test('either case triggers a refetch of the user', () => {
        dispatchEvent({[FIELD_ID]: 'AURORA', [OTHER_FIELD_ID]: {withheld: true}});
        expect(getCustomProfileAttributeValues).toHaveBeenCalledWith(USER_ID);

        jest.clearAllMocks();

        dispatchEvent({[FIELD_ID]: {withheld: true}});
        expect(getCustomProfileAttributeValues).toHaveBeenCalledWith(USER_ID);
    });

    test('an event with no withheld entries behaves exactly as today: one dispatch, no refetch', () => {
        const actions = dispatchEvent({[FIELD_ID]: 'AURORA'});

        const received = actions.find((a: any) => a.type === UserTypes.RECEIVED_CPA_VALUES);
        expect(received.data.customAttributeValues).toEqual({[FIELD_ID]: 'AURORA'});
        expect(getCustomProfileAttributeValues).not.toHaveBeenCalled();
    });
});
