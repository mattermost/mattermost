// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const ChoosePage = require('./team_signup_choose_auth.jsx');
const EmailSignUpPage = require('./team_signup_with_email.jsx');
const SSOSignupPage = require('./team_signup_with_sso.jsx');
const Constants = require('../utils/constants.jsx');

export default class TeamSignUp extends React.Component {
    constructor(props) {
        super(props);

        this.updatePage = this.updatePage.bind(this);

        var count = 0;

        if (global.window.config.EnableSignUpWithEmail === 'true') {
            count = count + 1;
        }

        if (global.window.config.EnableSignUpWithGitLab === 'true') {
            count = count + 1;
        }

        if (count > 1) {
            this.state = {page: 'choose'};
        } else if (global.window.config.EnableSignUpWithEmail === 'true') {
            this.state = {page: 'email'};
        } else if (global.window.config.EnableSignUpWithGitLab === 'true') {
            this.state = {page: 'gitlab'};
        }
    }

    updatePage(page) {
        this.setState({page});
    }

    render() {
        if (this.state.page === 'choose') {
            return (
                <ChoosePage
                    updatePage={this.updatePage}
                />
            );
        }

        if (this.state.page === 'email') {
            return <EmailSignUpPage />;
        } else if (this.state.page === 'gitlab') {
            return <SSOSignupPage service={Constants.GITLAB_SERVICE} />;
        }
    }
}
