// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape} from 'react-intl';

import type {AppBinding, AppCallRequest, AppCallResponse, AppContext, AppForm} from '@mattermost/types/apps';
import type {Post} from '@mattermost/types/posts';

export type DoAppCallResult<Res=unknown> = {
    data?: AppCallResponse<Res>;
    error?: AppCallResponse<Res>;
}

export interface HandleBindingClick<Res=unknown> {
    (binding: AppBinding, context: AppContext, intl: IntlShape): Promise<DoAppCallResult<Res>>;
}

export interface DoAppSubmit<Res=unknown> {
    (call: AppCallRequest, intl: IntlShape): Promise<DoAppCallResult<Res>>;
}

export interface DoAppFetchForm<Res=unknown> {
    (call: AppCallRequest, intl: IntlShape): Promise<DoAppCallResult<Res>>;
}

export interface DoAppLookup<Res=unknown> {
    (call: AppCallRequest, intl: IntlShape): Promise<DoAppCallResult<Res>>;
}

export interface PostEphemeralCallResponseForPost {
    (response: AppCallResponse, message: string, post: Post): void;
}

export interface PostEphemeralCallResponseForChannel {
    (response: AppCallResponse, message: string, channelID: string): void;
}

export interface PostEphemeralCallResponseForContext {
    (response: AppCallResponse, message: string, context: AppContext): void;
}

export interface OpenAppsModal {
    (form: AppForm, context: AppContext): void;
}
