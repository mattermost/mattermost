// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var SignupTeamComplete = require('../components/signup_team_complete.jsx');

function setupSignupTeamCompletePage(props) {
    React.render(
        <SignupTeamComplete
            email={props.Email}
            hash={props.Hash}
            data={props.Data}
        />,
        document.getElementById('signup-team-complete')
    );
}

global.window.setup_signup_team_complete_page = setupSignupTeamCompletePage;
