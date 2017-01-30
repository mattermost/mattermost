// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from 'utils/constants.jsx';
import EventEmitter from 'events';

const ActionTypes = Constants.ActionTypes;

const CHANGE_EVENT = 'changed';

class FileStore extends EventEmitter {
    constructor() {
        super();

        this.handleEventPayload = this.handleEventPayload.bind(this);
        this.dispatchToken = AppDispatcher.register(this.handleEventPayload);

        this.setMaxListeners(600);

        this.fileInfosByPost = new Map();
    }

    addChangeListener(callback) {
        this.on(CHANGE_EVENT, callback);
    }

    removeChangeListener(callback) {
        this.removeListener(CHANGE_EVENT, callback);
    }

    emitChange() {
        this.emit(CHANGE_EVENT);
    }

    hasInfosForPost(postId) {
        return this.fileInfosByPost.has(postId);
    }

    getInfosForPost(postId) {
        return this.fileInfosByPost.get(postId);
    }

    saveInfos(postId, infos) {
        this.fileInfosByPost.set(postId, infos);
    }

    getFileUrl(fileId) {
        return `/api/v3/files/${fileId}/get`;
    }

    getFileThumbnailUrl(fileId) {
        return `/api/v3/files/${fileId}/get_thumbnail`;
    }

    getFilePreviewUrl(fileId) {
        return `/api/v3/files/${fileId}/get_preview`;
    }

    handleEventPayload(payload) {
        const action = payload.action;

        switch (action.type) {
        case ActionTypes.RECEIVED_FILE_INFOS:
            // This assumes that all received file infos are for a single post
            this.saveInfos(action.postId, action.infos);
            this.emitChange(action.postId);
            break;
        }
    }
}

export default new FileStore();