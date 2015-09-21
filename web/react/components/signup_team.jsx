// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

const ChoosePage = require('./team_signup_choose_auth.jsx');
const EmailSignUpPage = require('./team_signup_with_email.jsx');
const SSOSignupPage = require('./team_signup_with_sso.jsx');
var Constants = require('../utils/constants.jsx');

export default class TeamSignUp extends React.Component {
    constructor(props) {
        super(props);

        this.updatePage = this.updatePage.bind(this);

        if (global.window.config.AllowSignUpWithEmail && global.window.config.AllowSignUpWithGitLab) {
            this.state = {page: 'choose'};
        } else if (global.window.config.AllowSignUpWithEmail) {
            this.state = {page: 'email'};
        } else if (global.window.config.AllowSignUpWithGitLab) {
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
