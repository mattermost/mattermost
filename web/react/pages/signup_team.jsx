// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var SignupTeam =require('../components/signup_team.jsx');

global.window.setup_signup_team_page = function() {
    React.render(
        <SignupTeam />,
        document.getElementById('signup-team')
    );
};