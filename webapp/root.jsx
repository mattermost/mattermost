// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
require('perfect-scrollbar/jquery')($);

import React from 'react';
import ReactDOM from 'react-dom';
import {Provider} from 'react-redux';
import {Router, browserHistory} from 'react-router/es6';
import PDFJS from 'pdfjs-dist';

import * as Websockets from 'actions/websocket_actions.jsx';
import {loadMe} from 'actions/user_actions.jsx';
import BrowserStore from 'stores/browser_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';
import * as I18n from 'i18n/i18n.jsx';
import * as AsyncClient from 'utils/async_client.jsx';

import {getClientConfig, getLicenseConfig, setUrl} from 'mattermost-redux/actions/general';

// Import our styles
import 'bootstrap-colorpicker/dist/css/bootstrap-colorpicker.css';
import 'google-fonts/google-fonts.css';
import 'sass/styles.scss';
import 'katex/dist/katex.min.css';

import store from 'stores/redux_store.jsx';

// Import the root of our routing tree
import rRoot from 'routes/route_root.jsx';

PDFJS.disableWorker = true;

// This is for anything that needs to be done for ALL react components.
// This runs before we start to render anything.
function preRenderSetup(callwhendone) {
    window.onerror = (msg, url, line, column, stack) => {
        var l = {};
        l.level = 'ERROR';
        l.message = 'msg: ' + msg + ' row: ' + line + ' col: ' + column + ' stack: ' + stack + ' url: ' + url;

        $.ajax({
            url: '/api/v3/general/log_client',
            dataType: 'json',
            contentType: 'application/json',
            type: 'POST',
            data: JSON.stringify(l)
        });

        if (window.mm_config && window.mm_config.EnableDeveloper === 'true') {
            window.ErrorStore.storeLastError({type: 'developer', message: 'DEVELOPER MODE: A JavaScript error has occurred.  Please use the JavaScript console to capture and report the error (row: ' + line + ' col: ' + column + ').'});
            window.ErrorStore.emitChange();
        }
    };

    var d1 = $.Deferred(); //eslint-disable-line new-cap

    setUrl(window.location.origin);

    const currentUserId = localStorage.getItem('currentUserId');

    if (currentUserId) {
        loadMe(() => d1.resolve());
    } else {
        getClientConfig()(store.dispatch, store.getState).then(
            (config) => {
                global.window.mm_config = config;

                getLicenseConfig()(store.dispatch, store.getState).then(
                    (license) => {
                        global.window.mm_license = license;
                        d1.resolve();
                    }
                );
            }
        );
    }

    // Make sure the websockets close and reset version
    $(window).on('beforeunload',
         () => {
             // Turn off to prevent getting stuck in a loop
             $(window).off('beforeunload');
             BrowserStore.setLastServerVersion('');
             if (UserStore.getCurrentUser()) {
                 AsyncClient.viewChannel('', ChannelStore.getCurrentId() || '');
             }
             Websockets.close();
         }
    );

    function afterIntl() {
        $.when(d1).done(() => {
            I18n.doAddLocaleData();
            callwhendone();
        });
    }

    if (global.Intl) {
        afterIntl();
    } else {
        I18n.safariFix(afterIntl);
    }
}

function renderRootComponent() {
    ReactDOM.render((
        <Provider store={store}>
            <Router
                history={browserHistory}
                routes={rRoot}
            />
        </Provider>
    ),
    document.getElementById('root'));
}

global.window.setup_root = () => {
    // Do the pre-render setup and call renderRootComponent when done
    preRenderSetup(renderRootComponent);
};
