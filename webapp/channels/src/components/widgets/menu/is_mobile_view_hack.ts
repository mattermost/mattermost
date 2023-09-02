// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getIsMobileView} from 'selectors/views/browser';

import store from 'stores/redux_store';

/**
 * @deprecated This is a horrible hack that shouldn't used done elsewhere because we shouldn't be accessing the global
 * store directly, but it's too hard to get this value into these component properly without rewriting everything.
 * These components will eventually be replaced by the newer components in `components/menu` anyway.
 */
export function isMobile() {
    return getIsMobileView(store.getState());
}
