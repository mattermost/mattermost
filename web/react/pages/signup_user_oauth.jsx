// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var SignupUserOAuth = require('../components/signup_user_oauth.jsx');

global.window.setup_signup_user_oauth_page = function(user, team_name, team_display_name) {
    React.render(
        <SignupUserOAuth user={user} teamName={team_name} teamDisplayName={team_display_name} />,
        document.getElementById('signup-user-complete')
    );
};
