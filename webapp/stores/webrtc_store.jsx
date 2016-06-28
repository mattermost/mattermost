/**
 * Created by enahum on 3/24/16.
 */

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';
import Constants from 'utils/constants.jsx';

const ActionTypes = Constants.ActionTypes;

const CALL_EVENT = 'call';
const CALL_INCOMING_EVENT = 'incoming_call';
const CALL_CANCEL_EVENT = 'cancel_call';
const CALL_DECLINED_EVENT = 'declined_call';
const CALL_CONNECT_EVENT = 'connect_call';
const CALL_NOT_SUPPORTED_EVENT = 'not_supported_call';
const CALL_FAILED_EVENT = 'call_failed';
const CALL_NO_ANSWER_EVENT = 'call_no_answer';

class WebrtcStoreClass extends EventEmitter {
    emitCall(userId, isCaller) {
        this.emit(CALL_EVENT, userId, isCaller);
    }

    addCallListener(callback) {
        this.on(CALL_EVENT, callback);
    }

    removeCallListener(callback) {
        this.removeListener(CALL_EVENT, callback);
    }

    emitIncomingCall(incoming) {
        this.emit(CALL_INCOMING_EVENT, incoming);
    }

    addIncomingCallListener(callback) {
        this.on(CALL_INCOMING_EVENT, callback);
    }

    removeIncomingCallListener(callback) {
        this.removeListener(CALL_INCOMING_EVENT, callback);
    }

    emitCancelCall(call) {
        this.emit(CALL_CANCEL_EVENT, call);
    }

    addCancelCallListener(callback) {
        this.on(CALL_CANCEL_EVENT, callback);
    }

    removeCancelCallListener(callback) {
        this.removeListener(CALL_CANCEL_EVENT, callback);
    }

    emitRejectedCall() {
        this.emit(CALL_DECLINED_EVENT);
    }

    addRejectedCallListener(callback) {
        this.on(CALL_DECLINED_EVENT, callback);
    }

    removeRejectedCallListener(callback) {
        this.removeListener(CALL_DECLINED_EVENT, callback);
    }

    emitNotSupportedCall() {
        this.emit(CALL_NOT_SUPPORTED_EVENT);
    }

    addNotSupportedCallListener(callback) {
        this.on(CALL_NOT_SUPPORTED_EVENT, callback);
    }

    removeNotSupportedCallListener(callback) {
        this.removeListener(CALL_NOT_SUPPORTED_EVENT, callback);
    }

    emitConnectCall(call) {
        this.emit(CALL_CONNECT_EVENT, call);
    }

    addConnectCallListener(callback) {
        this.on(CALL_CONNECT_EVENT, callback);
    }

    removeConnectCallListener(callback) {
        this.removeListener(CALL_CONNECT_EVENT, callback);
    }

    emitFailedCall(call) {
        this.emit(CALL_FAILED_EVENT, call);
    }

    addFailedCallListener(callback) {
        this.on(CALL_FAILED_EVENT, callback);
    }

    removeFailedCallListener(callback) {
        this.removeListener(CALL_FAILED_EVENT, callback);
    }

    emitNoAnswerCall() {
        this.emit(CALL_NO_ANSWER_EVENT);
    }

    addNoAnswerListener(callback) {
        this.on(CALL_NO_ANSWER_EVENT, callback);
    }

    removeNoAnswerListener(callback) {
        this.removeListener(CALL_NO_ANSWER_EVENT, callback);
    }
}

var WebrtcStore = new WebrtcStoreClass();
WebrtcStore.setMaxListeners(0);

WebrtcStore.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.VIDEO_CALL_INITIALIZE:
        WebrtcStore.emitCall(action.user_id, true);
        break;
    case ActionTypes.VIDEO_CALL_INCOMING:
        WebrtcStore.emitIncomingCall(action.incoming);
        break;
    case ActionTypes.VIDEO_CALL_CANCEL:
        WebrtcStore.emitCancelCall(action.call);
        break;
    case ActionTypes.VIDEO_CALL_ANSWER:
        WebrtcStore.emitCall(action.user_id, false);
        break;
    case ActionTypes.VIDEO_CALL_DECLINED:
        WebrtcStore.emitRejectedCall();
        break;
    case ActionTypes.VIDEO_CALL_CONNECT:
        WebrtcStore.emitConnectCall(action.call);
        break;
    case ActionTypes.VIDEO_CALL_NOT_SUPPORTED:
        WebrtcStore.emitNotSupportedCall();
        break;
    case ActionTypes.VIDEO_CALL_FAILED:
        WebrtcStore.emitFailedCall(action.call);
        break;
    case ActionTypes.VIDEO_CALL_NO_ANSWER:
        WebrtcStore.emitNoAnswerCall();
        break;
    default:
    }
});

export default WebrtcStore;