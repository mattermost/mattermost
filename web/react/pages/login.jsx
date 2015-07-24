// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Login = require('../components/login.jsx');

global.window.setup_login_page = function(team_display_name, team_name, auth_services) {
    React.render(
        <Login teamDisplayName={team_display_name} teamName={team_name} authServices={auth_services} />,
        document.getElementById('login')
    );
};
