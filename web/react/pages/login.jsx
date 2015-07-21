// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Login = require('../components/login.jsx');

global.window.setup_login_page = function(teamDisplayName, teamName) {
    React.render(
        <Login teamDisplayName={teamDisplayName} teamName={teamName}/>,
        document.getElementById('login')
    );
};
