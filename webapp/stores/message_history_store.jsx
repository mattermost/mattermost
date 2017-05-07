// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from 'utils/constants.jsx';

const TYPE_POST = 'post';
const TYPE_COMMENT = 'comment';

class MessageHistoryStoreClass {
    constructor() {
        this.messageHistory = [];
        this.index = [];
        this.index[TYPE_POST] = 0;
        this.index[TYPE_COMMENT] = 0;
    }

    getMessageInHistory(type) {
        if (this.index[type] >= this.messageHistory.length) {
            return '';
        } else if (this.index[type] < 0) {
            return null;
        }

        return this.messageHistory[this.index[type]];
    }

    getHistoryLength() {
        if (this.messageHistory === null) {
            return 0;
        }
        return this.messageHistory.length;
    }

    storeMessageInHistory(message) {
        this.messageHistory.push(message);
        this.resetAllHistoryIndex();
        if (this.messageHistory.length > Constants.MAX_PREV_MSGS) {
            this.messageHistory = this.messageHistory.slice(1, Constants.MAX_PREV_MSGS + 1);
        }
    }

    storeMessageInHistoryByIndex(index, message) {
        this.messageHistory[index] = message;
    }

    resetAllHistoryIndex() {
        this.index[TYPE_POST] = this.messageHistory.length;
        this.index[TYPE_COMMENT] = this.messageHistory.length;
    }

    resetHistoryIndex(type) {
        this.index[type] = this.messageHistory.length;
    }

    nextMessageInHistory(keyCode, messageText, type) {
        if (messageText !== '' && messageText !== this.getMessageInHistory(type)) {
            return null;
        }

        if (keyCode === Constants.KeyCodes.UP) {
            this.index[type]--;
        } else if (keyCode === Constants.KeyCodes.DOWN) {
            this.index[type]++;
        }

        if (this.index[type] < 0) {
            this.index[type] = 0;
            return null;
        } else if (this.index[type] >= this.getHistoryLength()) {
            this.index[type] = this.getHistoryLength();
        }

        return this.getMessageInHistory(type);
    }
}

var MessageHistoryStore = new MessageHistoryStoreClass();

export default MessageHistoryStore;
