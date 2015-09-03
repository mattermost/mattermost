// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var SignupUserComplete = require('../components/signup_user_complete.jsx');

function setupSignupUserCompletePage(email, name, uiName, id, data, hash, authServices) {
    React.render(
        <SignupUserComplete
            teamId={id}
            teamName={name}
            teamDisplayName={uiName}
            email={email}
            hash={hash}
            data={data}
            authServices={authServices}
        />,
        document.getElementById('signup-user-complete')
    );
}

global.window.setup_signup_user_complete_page = setupSignupUserCompletePage;
