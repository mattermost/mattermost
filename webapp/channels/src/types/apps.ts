// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape} from 'react-intl';

import type {AppCallRequest, AppCallResponse, AppContext} from '@mattermost/types/apps';

export type DoAppCallResult<Res=unknown> = {
    data?: AppCallResponse<Res>;
    error?: AppCallResponse<Res>;
};

export interface DoAppSubmit<Res=unknown> {
    (call: AppCallRequest, intl: IntlShape): Promise<DoAppCallResult<Res>>;
}

export interface DoAppFetchForm<Res=unknown> {
    (call: AppCallRequest, intl: IntlShape): Promise<DoAppCallResult<Res>>;
}

export interface DoAppLookup<Res=unknown> {
    (call: AppCallRequest, intl: IntlShape): Promise<DoAppCallResult<Res>>;
}

export interface PostEphemeralCallResponseForContext {
    (response: AppCallResponse, message: string, context: AppContext): void;
}
