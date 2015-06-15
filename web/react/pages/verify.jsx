// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var EmailVerify = require('../components/email_verify.jsx');

global.window.setup_verify_page = function(is_verified) {

    React.render(
        <EmailVerify isVerified={is_verified} />,
        document.getElementById('verify')
    );

};
