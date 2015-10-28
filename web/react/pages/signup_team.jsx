// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var SignupTeam = require('../components/signup_team.jsx');

function setupSignupTeamPage(props) {
    var teams = [];

    for (var prop in props) {
        if (props.hasOwnProperty(prop)) {
            if (prop !== 'Title') {
                teams.push({name: prop, display_name: props[prop]});
            }
        }
    }

    ReactDOM.render(
        <SignupTeam teams={teams} />,
        document.getElementById('signup-team')
    );
}

global.window.setup_signup_team_page = setupSignupTeamPage;
