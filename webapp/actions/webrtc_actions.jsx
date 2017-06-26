// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import {WebrtcActionTypes} from 'utils/constants.jsx';

import {Client4} from 'mattermost-redux/client';

export function initWebrtc(userId, isCalling) {
    AppDispatcher.handleServerAction({
        type: WebrtcActionTypes.INITIALIZE,
        user_id: userId,
        is_calling: isCalling
    });
}

export function handle(message) {
    AppDispatcher.handleServerAction({
        type: message.action,
        message
    });
}

export function webrtcToken(success, error) {
    Client4.webrtcToken().then(
        (data) => {
            if (success) {
                success(data);
            }
        }
    ).catch(
        () => {
            if (error) {
                error();
            }
        }
    );
}
