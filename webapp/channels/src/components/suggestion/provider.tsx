// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {RequireOnlyOne} from '@mattermost/types/utilities';

export type ProviderResult<Item> = {
    matchedPretext: string;
    terms: string[];
    items: Array<Item | Loading>;
} & RequireOnlyOne<{
    component: React.ReactNode;
    components: React.ReactNode[];
}>;

export type Loading = {
    type: string;
    loading: boolean;
};

export type ResultsCallback<Item> = (result: ProviderResult<Item>) => void;

export default abstract class Provider {
    latestPrefix: string;
    latestComplete: boolean;
    disableDispatches: boolean;
    requestStarted: boolean;
    forceDispatch: boolean;

    triggerCharacter?: string;

    constructor() {
        this.latestPrefix = '';
        this.latestComplete = true;
        this.disableDispatches = false;
        this.requestStarted = false;
        this.forceDispatch = false;
    }

    abstract handlePretextChanged(pretext: string, callback: (res: ProviderResult<unknown>) => void): boolean;

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
