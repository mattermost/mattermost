// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var EmailVerify = require('../components/email_verify.jsx');

global.window.setupVerifyPage = function setupVerifyPage(isVerified, teamURL, userEmail) {
    React.render(
        <EmailVerify
            isVerified={isVerified}
            teamURL={teamURL}
            userEmail={userEmail}
        />,
        document.getElementById('verify')
    );
};
