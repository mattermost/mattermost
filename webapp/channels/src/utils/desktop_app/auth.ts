// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import crypto from 'crypto';

import {isDesktopApp} from 'utils/user_agent';

export enum DesktopAuthStatus {
    None,
    Polling,
    Expired,
    Complete,
}

export const getExternalLoginURL = (url: string, search: string, token: string) => {
    const params = new URLSearchParams(search);
    if (isDesktopApp() && token) {
        params.set('desktop_token', token);
    }

    // Only add the parameters if we need them
    let paramsString = '';
    if (params.toString().length) {
        paramsString = `?${params.toString()}`;
    }

    return `${url}${paramsString}`;
};

export const generateDesktopToken = () => {
    return crypto.randomBytes(32).toString('hex');
};
