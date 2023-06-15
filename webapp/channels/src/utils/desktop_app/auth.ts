// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import crypto from 'crypto';

import {isDesktopApp} from 'utils/user_agent';

export const getExternalLoginURL = (url: string, search: string, token: string) => {
    const params = new URLSearchParams(search);
    if (isDesktopApp() && token) {
        params.set('desktop_token', token);
    }
    const externalurl = `${url}${params.toString().length ? `?${params.toString()}` : ''}`;

    return externalurl;
};

export const generateDesktopToken = () => {
    return crypto.randomBytes(32).toString('hex');
};
