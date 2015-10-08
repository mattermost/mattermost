// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var SignupUserComplete = require('../components/signup_user_complete.jsx');

function setupSignupUserCompletePage(props) {
    React.render(
        <SignupUserComplete
            teamId={props.TeamId}
            teamName={props.TeamName}
            teamDisplayName={props.TeamDisplayName}
            email={props.Email}
            hash={props.Hash}
            data={props.Data}
        />,
        document.getElementById('signup-user-complete')
    );
}

global.window.setup_signup_user_complete_page = setupSignupUserCompletePage;
