// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;

import * as IntegrationActions from 'mattermost-redux/actions/integrations';

export function deleteOAuthApp(id, success, error) {
    IntegrationActions.deleteOAuthApp(id)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.integrations.deleteOAuthApp.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}
