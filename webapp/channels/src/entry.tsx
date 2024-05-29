// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';

import {logError} from 'mattermost-redux/actions/errors';

import store from 'stores/redux_store';

import App from 'components/app';

import {AnnouncementBarTypes} from 'utils/constants';
import {setCSRFFromCookie} from 'utils/utils';

// Import our styles
import './sass/styles.scss';
import 'katex/dist/katex.min.css';

import '@mattermost/compass-icons/css/compass-icons.css';
import '@mattermost/components/dist/index.esm.css';

declare global {
    interface Window {
        publicPath?: string;
    }
}

// This is for anything that needs to be done for ALL react components.
// This runs before we start to render anything.
function preRenderSetup(callwhendone: () => void) {
    window.onerror = (msg, url, line, column, error) => {
        if (msg === 'ResizeObserver loop limit exceeded') {
            return;
        }

        store.dispatch(
            logError(
                {
                    type: AnnouncementBarTypes.DEVELOPER,
                    message: 'A JavaScript error in the webapp client has occurred. (msg: ' + msg + ', row: ' + line + ', col: ' + column + ').',
                    stack: error?.stack,
                    url,
                },
                true,
                true,
            ),
        );
    };
    setCSRFFromCookie();

    callwhendone();
}

function renderRootComponent() {
    ReactDOM.render((
        <App/>
    ),
    document.getElementById('root'));
}

/**
 * Adds a function to be invoked when the DOM content is loaded.
 */
function appendOnDOMContentLoadedEvent(fn: (evt: Event) => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn);
    } else {
        // If the DOM is already loaded, call the function immediately
        fn(new Event('DOMContentLoaded'));
    }
}

appendOnDOMContentLoadedEvent(() => {
    // Do the pre-render setup and call renderRootComponent when done
    preRenderSetup(renderRootComponent);
});
