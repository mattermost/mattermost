// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var SignupTeam = require('../components/signup_team.jsx');

function setupSignupTeamPage(props) {
    var services = JSON.parse(props.AuthServices);

    React.render(
        <SignupTeam services={services} />,
        document.getElementById('signup-team')
    );
}

global.window.setup_signup_team_page = setupSignupTeamPage;
