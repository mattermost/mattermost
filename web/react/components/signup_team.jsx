// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

const ChoosePage = require('./team_signup_choose_auth.jsx');
const EmailSignUpPage = require('./team_signup_with_email.jsx');
const SSOSignupPage = require('./team_signup_with_sso.jsx');
const Constants = require('../utils/constants.jsx');

export default class TeamSignUp extends React.Component {
    constructor(props) {
        super(props);

        this.updatePage = this.updatePage.bind(this);

        if (props.services.length === 1) {
            if (props.services[0] === Constants.EMAIL_SERVICE) {
                this.state = {page: 'email', service: ''};
            } else {
                this.state = {page: 'service', service: props.services[0]};
            }
        } else {
            this.state = {page: 'choose', service: ''};
        }
    }
    updatePage(page, service) {
        this.setState({page: page, service: service});
    }
    render() {
        if (this.state.page === 'email') {
            return <EmailSignUpPage />;
        } else if (this.state.page === 'service' && this.state.service !== '') {
            return <SSOSignupPage service={this.state.service} />;
        }

        return (
            <ChoosePage
                services={this.props.services}
                updatePage={this.updatePage}
            />
        );
    }
}

TeamSignUp.defaultProps = {
    services: []
};
TeamSignUp.propTypes = {
    services: React.PropTypes.array
};
