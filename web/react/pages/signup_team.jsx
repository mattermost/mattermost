// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var SignupTeam = require('../components/signup_team.jsx');

var AsyncClient = require('../utils/async_client.jsx');

function setupSignupTeamPage(authServices) {
    AsyncClient.getConfig();

    var services = JSON.parse(authServices);

    React.render(
        <SignupTeam services={services} />,
        document.getElementById('signup-team')
    );
}

global.window.setup_signup_team_page = setupSignupTeamPage;
