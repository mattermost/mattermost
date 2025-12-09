// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Static imports for React core - these MUST be static to ensure single React instance
import React from 'react';
import ReactDOM from 'react-dom';
import * as ReactIs from 'react-is';

// Expose React globally for CJS modules that use require('react') at runtime
// This is needed for Rolldown's CJS interop with libraries like styled-components
// eslint-disable-next-line no-underscore-dangle
(globalThis as any).__cjs_modules__ = {
    react: React,
    'react-dom': ReactDOM,
    'react-is': ReactIs,
};

// Import styles statically
import 'bootstrap/dist/css/bootstrap.css';
import 'font-awesome/css/font-awesome.css';
import './sass/styles.scss';
import 'katex/dist/katex.min.css';
import '@mattermost/compass-icons/css/compass-icons.css';
import '@mattermost/components/dist/index.esm.css';

// Bootstrap the application by initializing the store first, then loading the rest of the app.
// This breaks circular dependency chains by ensuring the store exists before any module tries to access it.

async function bootstrap() {
    // Step 1: Initialize the store FIRST using dynamic import
    // This MUST be done before importing any components that use the store
    const {default: configureStore} = await import('store');
    const store = configureStore();
    (window as any).store = store;
    // eslint-disable-next-line no-underscore-dangle
    (window as any).__MM_STORE__ = store;

    // Step 2: Now that store is initialized, load the rest of the app
    const [
        {logError, LogErrorBarMode},
        {default: App},
        {AnnouncementBarTypes},
        {setCSRFFromCookie},
    ] = await Promise.all([
        import('mattermost-redux/actions/errors'),
        import('components/app'),
        import('utils/constants'),
        import('utils/utils'),
    ]);

    // This is for anything that needs to be done for ALL react components.
    // This runs before we start to render anything.
    function preRenderSetup(onPreRenderSetupReady: () => void) {
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
                    {errorBarMode: LogErrorBarMode.InDevMode},
                ),
            );
        };

        setCSRFFromCookie();

        onPreRenderSetupReady();
    }

    function renderReactRootComponent() {
        // We're using React 18, but we're using the deprecated way of starting React because ReactDOM.createRoot enables
        // new features such as automatic batching which breaks some components. This will need to be changed in the future
        // because this method of starting the app will be removed in React 19.
        ReactDOM.render(<App/>, document.getElementById('root')!);
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
}

// Start the application
bootstrap().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to bootstrap application:', error);
});
