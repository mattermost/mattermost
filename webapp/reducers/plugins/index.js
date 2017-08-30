// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {combineReducers} from 'redux';
import {ActionTypes} from 'utils/constants.jsx';

function components(state = {}, action) {
    switch (action.type) {
    case ActionTypes.RECEIVED_PLUGIN_COMPONENTS: {
        if (action.data) {
            return {...action.data, ...state};
        }
        return state;
    }
    default:
        return state;
    }
}

export default combineReducers({
    components
});
