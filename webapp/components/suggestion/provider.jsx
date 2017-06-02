// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SuggestionStore from 'stores/suggestion_store.jsx';

export default class Provider {
    constructor() {
        this.latestPrefix = '';
        this.latestComplete = true;
        this.disableDispatches = false;
    }

    handlePretextChanged(suggestionId, pretext) { // eslint-disable-line no-unused-vars
        // NO-OP for inherited classes to override
    }

    startNewRequest(suggestionId, prefix) {
        this.latestPrefix = prefix;
        this.latestComplete = false;

        // Don't use the dispatcher here since this is only called while handling an event
        SuggestionStore.setSuggestionsPending(suggestionId, true);
    }

    shouldCancelDispatch(prefix) {
        if (this.disableDispatches) {
            return true;
        }

        if (prefix === this.latestPrefix) {
            this.latestComplete = true;
        } else if (this.latestComplete) {
            return true;
        }

        return false;
    }
}
