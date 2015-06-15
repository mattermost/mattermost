// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var PasswordReset = require('../components/password_reset.jsx');

global.window.setup_password_reset_page = function(is_reset, team_name, domain, hash, data) {

    React.render(
        <PasswordReset
            isReset={is_reset}
            teamName={team_name}
            domain={domain}
            hash={hash}
            data={data}
        />,
        document.getElementById('reset')
    );

};
