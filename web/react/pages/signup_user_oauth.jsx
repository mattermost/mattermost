// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var SignupUserOAuth = require('../components/signup_user_oauth.jsx');

global.window.setup_signup_user_oauth_page = function(user) {
    React.render(
        <SignupUserOAuth user={user} />,
        document.getElementById('signup-user-complete')
    );
};
