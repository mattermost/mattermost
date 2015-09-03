// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var SignupTeamComplete = require('../components/signup_team_complete.jsx');

function setupSignupTeamCompletePage(email, data, hash) {
    React.render(
        <SignupTeamComplete
            email={email}
            hash={hash}
            data={data}
        />,
        document.getElementById('signup-team-complete')
    );
}

global.window.setup_signup_team_complete_page = setupSignupTeamCompletePage;
