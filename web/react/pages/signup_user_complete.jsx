// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var SignupUserComplete =require('../components/signup_user_complete.jsx');

global.window.setup_signup_user_complete_page = function(email, domain, name, id, data, hash) {
    React.render(
        <SignupUserComplete team_id={id} domain={domain} team_name={name} email={email} hash={hash} data={data} />,
        document.getElementById('signup-user-complete')
    );
};