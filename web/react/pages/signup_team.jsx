// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var SignupTeam = require('../components/signup_team.jsx');

var AsyncClient = require('../utils/async_client.jsx');

global.window.setup_signup_team_page = function() {
    AsyncClient.getConfig();

    React.render(
        <SignupTeam />,
        document.getElementById('signup-team')
    );
};
