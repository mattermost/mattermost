// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createBrowserHistory} from 'history';
import type {History} from 'history';

import {getModule} from 'module_registry';
import DesktopApp from 'utils/desktop_api';
import {isServerVersionGreaterThanOrEqualTo} from 'utils/server_version';
import {isDesktopApp, getDesktopVersion} from 'utils/user_agent';

const b = createBrowserHistory({basename: window.basename});
const isDesktop = isDesktopApp() && isServerVersionGreaterThanOrEqualTo(getDesktopVersion(), '5.0.0');
const browserHistory = {
    ...b,
    push: (path: string | { pathname: string }, ...args: string[]) => {
        if (isDesktop) {
            DesktopApp.doBrowserHistoryPush(typeof path === 'object' ? path.pathname : path);
        } else {
            b.push(path, ...args);
        }
    },
};

if (isDesktop) {
    DesktopApp.onBrowserHistoryPush((pathName) => b.push(pathName));
}

/**
 * Returns the current history object.
 *
 * If you're calling this from within a React component, consider using the useHistory hook from react-router-dom.
 */
export function getHistory() {
    return getModule<History>('utils/browser_history') ?? browserHistory;
}
