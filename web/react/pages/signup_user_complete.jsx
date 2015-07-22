// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var SignupUserComplete =require('../components/signup_user_complete.jsx');

global.window.setup_signup_user_complete_page = function(email, name, ui_name, id, data, hash, auth_services) {
    React.render(
        <SignupUserComplete teamId={id} teamName={name} teamDisplayName={ui_name} email={email} hash={hash} data={data} authServices={auth_services} />,
        document.getElementById('signup-user-complete')
    );
};
