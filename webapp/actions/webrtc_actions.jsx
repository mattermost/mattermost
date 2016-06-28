// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

export function makeVideoCall(userId) {
    AppDispatcher.handleServerAction({
        type: ActionTypes.VIDEO_CALL_INITIALIZE,
        user_id: userId
    });
}

export function notifyIncomingVideoCall(incoming) {
    AppDispatcher.handleServerAction({
        type: ActionTypes.VIDEO_CALL_INCOMING,
        incoming
    });
}

export function cancelVideoCall(call) {
    AppDispatcher.handleServerAction({
        type: ActionTypes.VIDEO_CALL_CANCEL,
        call
    });
}

export function answerVideoCall(userId) {
    AppDispatcher.handleServerAction({
        type: ActionTypes.VIDEO_CALL_ANSWER,
        user_id: userId
    });
}

export function rejectedVideoCall() {
    AppDispatcher.handleServerAction({
        type: ActionTypes.VIDEO_CALL_DECLINED
    });
}

export function notSupportedVideoCall() {
    AppDispatcher.handleServerAction({
        type: ActionTypes.VIDEO_CALL_NOT_SUPPORTED
    });
}

export function connectVideoCall(call) {
    AppDispatcher.handleServerAction({
        type: ActionTypes.VIDEO_CALL_CONNECT,
        call
    });
}

export function videoCallFailed(call) {
    AppDispatcher.handleServerAction({
        type: ActionTypes.VIDEO_CALL_FAILED,
        call
    });
}

export function noAnswerVideoCall() {
    AppDispatcher.handleServerAction({
        type: ActionTypes.VIDEO_CALL_NO_ANSWER
    });
}