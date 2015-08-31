// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var PasswordReset = require('../components/password_reset.jsx');

function setupPasswordResetPage(isReset, teamDisplayName, teamName, hash, data) {
    React.render(
        <PasswordReset
            isReset={isReset}
            teamDisplayName={teamDisplayName}
            teamName={teamName}
            hash={hash}
            data={data}
        />,
        document.getElementById('reset')
    );
}

global.window.setup_password_reset_page = setupPasswordResetPage;
