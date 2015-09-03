// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Login = require('../components/login.jsx');

function setupLoginPage(teamDisplayName, teamName, authServices) {
    React.render(
        <Login
            teamDisplayName={teamDisplayName}
            teamName={teamName}
            authServices={authServices}
        />,
        document.getElementById('login')
    );
}

global.window.setup_login_page = setupLoginPage;
