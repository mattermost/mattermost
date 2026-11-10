// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOMClient from 'react-dom/client';

import App from 'components/app';

import {registerGlobalErrorHandlers} from 'utils/global_error_handler';
import {setCSRFFromCookie} from 'utils/utils';

// Import our styles
import './sass/styles.scss';
import 'katex/dist/katex.min.css';

import '@mattermost/compass-icons/css/compass-icons.css';
import '@mattermost/compass-ui/styles';
import '@mattermost/components/dist/index.esm.css';

declare global {
    interface Window {
        publicPath?: string;
    }
}

// This is for anything that needs to be done for ALL react components.
// This runs before we start to render anything.
function preRenderSetup(onPreRenderSetupReady: () => void) {
    registerGlobalErrorHandlers();
    setCSRFFromCookie();
    onPreRenderSetupReady();
}

function renderReactRootComponent() {
    const container = document.getElementById('root')!;
    ReactDOMClient.createRoot(container).render(<App/>);
}

/**
 * Adds a function to be invoked when the DOM content is loaded.
 */
function appendOnDOMContentLoadedEvent(onDomContentReady: () => void) {
    if (document.readyState === 'loading') {
        // If the DOM hasn't finished loading, add an event listener and call the function when it does
        document.addEventListener('DOMContentLoaded', onDomContentReady);
    } else {
        // If the DOM is already loaded, call the function immediately
        onDomContentReady();
    }
}

appendOnDOMContentLoadedEvent(() => {
    // Do the pre-render setup and call renderReactRootComponent when done
    preRenderSetup(renderReactRootComponent);
});
