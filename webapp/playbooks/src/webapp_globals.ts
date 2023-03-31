// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {History} from 'history';

export const {
    formatText,
    messageHtmlToComponent,

    // @ts-ignore
} = global.PostUtils ?? {};

export const {
    modals,
    browserHistory,

// @ts-ignore
}: {modals: any, browserHistory: History} = global.WebappUtils ?? {};

export const {
    Timestamp,
    Textbox,

    // @ts-ignore
} = global.Components ?? {};

