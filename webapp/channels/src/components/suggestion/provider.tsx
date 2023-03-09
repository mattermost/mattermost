// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type ProviderResult = {
    matchedPretext: string;
    terms: string[];
    items: Array<Record<string, any>>;
    component?: React.ReactNode;
}

export default class Provider {
    latestPrefix: string;
    latestComplete: boolean;
    disableDispatches: boolean;
    requestStarted: boolean;
    forceDispatch: boolean;

    constructor() {
        this.latestPrefix = '';
        this.latestComplete = true;
        this.disableDispatches = false;
        this.requestStarted = false;
        this.forceDispatch = false;
    }

    handlePretextChanged(pretext: string, callback: (res: ProviderResult) => void) {// eslint-disable-line @typescript-eslint/no-unused-vars
        // NO-OP for inherited classes to override
    }

    resetRequest() {
        this.requestStarted = false;
    }

    startNewRequest(prefix: string) {
        this.latestPrefix = prefix;
        this.latestComplete = false;
        this.requestStarted = true;
    }

    shouldCancelDispatch(prefix: string) {
        if (this.forceDispatch) {
            return false;
        }

        if (this.disableDispatches) {
            return true;
        }

        if (!this.requestStarted) {
            return true;
        }

        if (prefix === this.latestPrefix) {
            this.latestComplete = true;
        } else if (this.latestComplete) {
            return true;
        }

        return false;
    }

    allowDividers() {
        return true;
    }

    presentationType() {
        return 'text';
    }
}
