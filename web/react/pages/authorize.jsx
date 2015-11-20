// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Authorize from '../components/authorize.jsx';

function setupAuthorizePage(props) {
    ReactDOM.render(
        <Authorize
            teamName={props.TeamName}
            appName={props.AppName}
            responseType={props.ResponseType}
            clientId={props.ClientId}
            redirectUri={props.RedirectUri}
            scope={props.Scope}
            state={props.State}
        />,
        document.getElementById('authorize')
    );
}

global.window.setup_authorize_page = setupAuthorizePage;
