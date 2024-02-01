// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import type {RequestStatusType} from '@mattermost/types/requests';

import {AdminTypes} from 'mattermost-redux/action_types';

import {handleRequest, initialRequestState} from './helpers';

function createCompliance(state: RequestStatusType = initialRequestState(), action: AnyAction): RequestStatusType {
    return handleRequest(
        AdminTypes.CREATE_COMPLIANCE_REQUEST,
        AdminTypes.CREATE_COMPLIANCE_SUCCESS,
        AdminTypes.CREATE_COMPLIANCE_FAILURE,
        state,
        action,
    );
}

export default combineReducers({
    createCompliance,
});
