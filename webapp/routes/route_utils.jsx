// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from 'utils/utils.jsx';

export function importComponentSuccess(callback) {
    return (comp) => callback(null, comp.default);
}

export function createGetChildComponentsFunction(arrayOfComponents) {
    return (locaiton, callback) => callback(null, arrayOfComponents);
}

export const notFoundParams = {
    title: Utils.localizeMessage('error.not_found.title', 'Page not found'),
    message: Utils.localizeMessage('error.not_found.message', 'The page you were trying to reach does not exist'),
    link: '/',
    linkmessage: Utils.localizeMessage('error.not_found.link_message', 'Back to Mattermost')
};

