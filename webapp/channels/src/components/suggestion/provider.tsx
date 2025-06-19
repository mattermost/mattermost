// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MessageDescriptor} from 'react-intl';

import type {RequireOnlyOne} from '@mattermost/types/utilities';

export type SuggestionGroup<Item> = {

    /**
     * Set hideLabel to true to prevent a visible label from being rendered in the UI. The group will still be given
     * an accessible label for non-visual users.
     */
    hideLabel?: boolean;

    label: MessageDescriptor;
} & ({
    items: Item[];
    terms: string[];
} | {
    loading: true;
});

export type ProviderResult<Item> = {
    matchedPretext: string;
    groups: Array<SuggestionGroup<Item>>;
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

    abstract handlePretextChanged(pretext: string, callback: (res: ProviderResult<unknown>) => void, teamId?: string): boolean;

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
