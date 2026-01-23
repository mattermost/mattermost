// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'utils/constants';

import type {MMAction} from 'types/store';

export type ReadoutState = {
    message: string | null;
};

const initialState: ReadoutState = {
    message: null,
};

function readout(state: ReadoutState = initialState, action: MMAction): ReadoutState {
    switch (action.type) {
    case ActionTypes.SET_READOUT:
        return {
            message: action.data,
        };
    case ActionTypes.CLEAR_READOUT:
        return {
            message: null,
        };
    default:
        return state;
    }
}

export default readout;
