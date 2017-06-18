// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;
import {uploadFile as uploadFileRedux} from 'mattermost-redux/actions/files';

export function uploadFile(file, name, channelId, clientId, success, error) {
    const fileFormData = new FormData();
    fileFormData.append('files', file, name);
    fileFormData.append('channel_id', channelId);
    fileFormData.append('client_ids', clientId);

    uploadFileRedux(channelId, null, [clientId], fileFormData)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.files.uploadFiles.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}
