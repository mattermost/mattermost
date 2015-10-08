// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var SignupTeam = require('../components/signup_team.jsx');

function setupSignupTeamPage() {
    React.render(
        <SignupTeam />,
        document.getElementById('signup-team')
    );
}

global.window.setup_signup_team_page = setupSignupTeamPage;
