// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Login = require('../components/login.jsx');

function setupLoginPage(props) {
    React.render(
        <Login
            teamDisplayName={props.TeamDisplayName}
            teamName={props.TeamName}
        />,
        document.getElementById('login')
    );
}

global.window.setup_login_page = setupLoginPage;
