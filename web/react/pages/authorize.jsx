// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Authorize = require('../components/authorize.jsx');

function setupAuthorizePage(teamName, appName, responseType, clientId, redirectUri, scope, state) {
    React.render(
        <Authorize
            teamName={teamName}
            appName={appName}
            responseType={responseType}
            clientId={clientId}
            redirectUri={redirectUri}
            scope={scope}
            state={state}
        />,
        document.getElementById('authorize')
    );
}

global.window.setup_authorize_page = setupAuthorizePage;
