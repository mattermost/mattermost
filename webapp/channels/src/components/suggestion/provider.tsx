// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ProviderResults} from './suggestion_results';

export type ResultsCallback<Item> = (result: ProviderResults<Item>) => void;

/**
 * A Provider as seen by SuggestionBox, including the optional hooks that SuggestionBox calls on any provider which
 * implements them. These aren't declared on Provider itself because doing so would either require every subclass to
 * implement them or would emit instance fields that shadow the subclasses which do.
 */
export type SuggestionProvider = Provider & {

    /** Called after a suggestion from this provider has been completed into the input. */
    handleCompleteWord?: (term: string, matchedPretext: string, callback: (pretext: string) => void) => void;

    /** Called to open a command's form in a modal instead of completing it as text. */
    openAppsModalFromCommand?: (pretext: string) => void;
};

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

    abstract handlePretextChanged(pretext: string, callback: (res: ProviderResults<unknown>) => void, teamId?: string): boolean;

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
