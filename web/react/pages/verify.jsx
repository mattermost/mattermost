// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import EmailVerify from '../components/email_verify.jsx';

global.window.setupVerifyPage = function setupVerifyPage(props) {
    ReactDOM.render(
        <EmailVerify
            isVerified={props.IsVerified}
            teamURL={props.TeamURL}
            userEmail={props.UserEmail}
            resendSuccess={props.ResendSuccess}
        />,
        document.getElementById('verify')
    );
};
