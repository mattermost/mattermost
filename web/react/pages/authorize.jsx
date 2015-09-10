// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Authorize = require('../components/authorize.jsx');

global.window.setup_authorize_page = function(team_name, app_name, response_type, client_id, redirect_uri, scope, state) {
    React.render(
        <Authorize
            teamName={team_name}
            appName={app_name}
            responseType={response_type}
            clientId={client_id}
            redirectUri={redirect_uri}
            scope={scope}
            state={state}
        />,
        document.getElementById('authorize')
    );
};
