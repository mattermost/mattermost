// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../utils/utils.jsx';
import * as Client from '../utils/client.jsx';

import {injectIntl, intlShape, defineMessages, FormattedMessage} from 'mm-intl';
import {browserHistory} from 'react-router';

const holders = defineMessages({
    emailError: {
        id: 'email_signup.emailError',
        defaultMessage: 'Please enter a valid email address'
    },
    address: {
        id: 'email_signup.address',
        defaultMessage: 'Email Address'
    }
});

class EmailSignUpPage extends React.Component {
    constructor() {
        super();

        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {};
    }
    handleSubmit(e) {
        e.preventDefault();
        const team = {};
        const state = {serverError: null};
        let isValid = true;

        team.email = ReactDOM.findDOMNode(this.refs.email).value.trim().toLowerCase();
        if (!team.email || !Utils.isEmail(team.email)) {
            state.emailError = this.props.intl.formatMessage(holders.emailError);
            isValid = false;
        } else {
            state.emailError = null;
        }

        if (!isValid) {
            this.setState(state);
            return;
        }

        Client.signupTeam(team.email,
            (data) => {
                if (data.follow_link) {
                    browserHistory.push(data.follow_link);
                } else {
                    browserHistory.push(`/signup_team_confirm/?email=${encodeURIComponent(team.email)}`);
                }
            },
            (err) => {
                state.serverError = err.message;
                this.setState(state);
            }
        );
    }
    render() {
        let serverError = null;
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        let emailError = null;
        if (this.state.emailError) {
            emailError = <div className='form-group has-error'><label className='control-label'>{this.state.emailError}</label></div>;
        }

        return (
            <form
                role='form'
                onSubmit={this.handleSubmit}
            >
                <div className='form-group'>
                    <input
                        autoFocus={true}
                        type='email'
                        ref='email'
                        className='form-control'
                        placeholder={this.props.intl.formatMessage(holders.address)}
                        maxLength='128'
                        spellCheck='false'
                    />
                    {emailError}
                </div>
                <div className='form-group'>
                    <button
                        className='btn btn-md btn-primary'
                        type='submit'
                    >
                        <FormattedMessage
                            id='email_signup.createTeam'
                            defaultMessage='Create Team'
                        />
                    </button>
                    {serverError}
                </div>
                <div className='form-group margin--extra-2x'>
                    <span><a href='/find_team'>
                        <FormattedMessage
                            id='email_signup.find'
                            defaultMessage='Find my teams'
                        />
                    </a></span>
                </div>
            </form>
        );
    }
}

EmailSignUpPage.defaultProps = {
};
EmailSignUpPage.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(EmailSignUpPage);
