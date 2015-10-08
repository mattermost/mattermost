// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var PasswordReset = require('../components/password_reset.jsx');

function setupPasswordResetPage(props) {
    React.render(
        <PasswordReset
            isReset={props.IsReset}
            teamDisplayName={props.TeamDisplayName}
            teamName={props.TeamName}
            hash={props.Hash}
            data={props.Data}
        />,
        document.getElementById('reset')
    );
}

global.window.setup_password_reset_page = setupPasswordResetPage;
