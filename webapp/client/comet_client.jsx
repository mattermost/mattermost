// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';

const MIN_COMET_RETRY_TIME = 3000; // 3 sec
const MAX_COMET_RETRY_TIME = 300000; // 5 mins

export default class CometClient {
    constructor() {
        this.isActive = false;
        this.connectionUrl = null;
        this.xhr = null;
        this.resumeToken = '';
        this.failureCount = 0;
        this.didFirstConnect = false;

        this.eventCallback = null;
        this.firstConnectCallback = null;
        this.reconnectCallback = null;
        this.missedEventCallback = null;
        this.errorCallback = null;
        this.closeCallback = null;
    }

    initialize(connectionUrl = this.connectionUrl, token) {
        if (this.isActive) {
            return;
        }

        if (connectionUrl == null) {
            console.log('comet must have connection url'); //eslint-disable-line no-console
            return;
        }

        this.connectionUrl = connectionUrl;
        this.resumeToken = '';
        this.failureCount = 0;
        this.isActive = true;
        this.didFirstConnect = false;

        this.poll()
    }

    poll() {
        if (!this.isActive) {
            return;
        }

        this.xhr = $.ajax({
            type: 'GET',
            url: this.connectionUrl + '?resume_token=' + encodeURIComponent(this.resumeToken),
            context: this,
        }).done(this.handleSuccess).fail(this.handleFailure);
    }

    handleSuccess(data, textStatus, jqXHR) {
        if (!this.didFirstConnect) {
            this.didFirstConnect = true;
            if (this.firstConnectCallback) {
                this.firstConnectCallback();
            }
        }
        if (this.failureCount > 0) {
            if (this.reconnectCallback) {
                this.reconnectCallback();
            }
            this.failureCount = 0;
        }

        this.resumeToken = data.resume_token;
        if (this.eventCallback) {
            for (let i = 0; i < data.events.length; i++) {
                this.eventCallback(data.events[i]);
            }
        }

        this.poll();
    }

    handleFailure(jqXHR, textStatus, errorThrown) {
        if (jqXHR.status != 408) {
            this.failureCount += 1;
            if (this.errorCallback) {
                this.errorCallback(errorThrown);
            }
            let delay = this.failureCount * this.failureCount * MIN_COMET_RETRY_TIME;
            if (delay > MAX_COMET_RETRY_TIME) {
                delay = MAX_COMET_RETRY_TIME;
            }
            setTimeout(
                () => {
                    this.poll();
                },
                delay
            );
            return;
        }

        this.poll();
    }

    setEventCallback(callback) {
        this.eventCallback = callback;
    }

    setFirstConnectCallback(callback) {
        this.firstConnectCallback = callback;
    }

    setReconnectCallback(callback) {
        this.reconnectCallback = callback;
    }

    setMissedEventCallback(callback) {
        this.missedEventCallback = callback;
    }

    setErrorCallback(callback) {
        this.errorCallback = callback;
    }

    setCloseCallback(callback) {
        this.closeCallback = callback;
    }

    close() {
        if (this.isActive) {
            if (this.xhr !== null) {
                this.xhr.abort();
            }
            this.isActive = false;

            if (this.closeCallback) {
                this.closeCallback(this.connectFailCount);
            }
        }
    }

    sendMessage(action, data, responseCallback) {
        // TODO
    }

    userTyping(channelId, parentId, callback) {
        const data = {};
        data.channel_id = channelId;
        data.parent_id = parentId;

        this.sendMessage('user_typing', data, callback);
    }

    getStatuses(callback) {
        this.sendMessage('get_statuses', null, callback);
    }

    getStatusesByIds(userIds, callback) {
        const data = {};
        data.user_ids = userIds;
        this.sendMessage('get_statuses_by_ids', data, callback);
    }
}

