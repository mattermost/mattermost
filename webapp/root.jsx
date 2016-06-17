// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
require('perfect-scrollbar/jquery')($);

import React from 'react';
import ReactDOM from 'react-dom';
import {Router, browserHistory} from 'react-router/es6';
import * as GlobalActions from 'actions/global_actions.jsx';
import * as Websockets from 'actions/websocket_actions.jsx';
import BrowserStore from 'stores/browser_store.jsx';
import * as I18n from 'i18n/i18n.jsx';

// Import our styles
import 'bootstrap-colorpicker/dist/css/bootstrap-colorpicker.css';
import 'google-fonts/google-fonts.css';
import 'sass/styles.scss';

// Import the root of our routing tree
import rRoot from 'routes/route_root.jsx';

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
            window.ErrorStore.storeLastError({type: 'developer', message: 'DEVELOPER MODE: A javascript error has occured.  Please use the javascript console to capture and report the error (row: ' + line + ' col: ' + column + ').'});
            window.ErrorStore.emitChange();
        }
    };

    var d1 = $.Deferred(); //eslint-disable-line new-cap

    GlobalActions.emitInitialLoad(
        () => {
            d1.resolve();
        }
    );

    // Make sure the websockets close and reset version
    $(window).on('beforeunload',
         () => {
             BrowserStore.setLastServerVersion('');
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
        <Router
            history={browserHistory}
            routes={rRoot}
        />
    ),
    document.getElementById('root'));
}

global.window.setup_root = () => {
    // Do the pre-render setup and call renderRootComponent when done
    preRenderSetup(renderRootComponent);
};
