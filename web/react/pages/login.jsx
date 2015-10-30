// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Login = require('../components/login.jsx');

function setupLoginPage(props) {
    ReactDOM.render(
        <Login
            teamDisplayName={props.TeamDisplayName}
            teamName={props.TeamName}
            inviteId={props.InviteId}
        />,
        document.getElementById('login')
    );
}

global.window.setup_login_page = setupLoginPage;
