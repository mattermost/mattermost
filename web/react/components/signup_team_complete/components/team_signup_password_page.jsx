// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../../../utils/client.jsx';
import BrowserStore from '../../../stores/browser_store.jsx';
import UserStore from '../../../stores/user_store.jsx';
import Constants from '../../../utils/constants.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage, FormattedHTMLMessage} from 'mm-intl';
import {browserHistory} from 'react-router';

const holders = defineMessages({
    passwordError: {
        id: 'team_signup_password.passwordError',
        defaultMessage: 'Please enter at least {chars} characters'
    },
    creating: {
        id: 'team_signup_password.creating',
        defaultMessage: 'Creating team...'
    }
});

class TeamSignupPasswordPage extends React.Component {
    constructor(props) {
        super(props);

        this.submitBack = this.submitBack.bind(this);
        this.submitNext = this.submitNext.bind(this);

        this.state = {};
    }
    submitBack(e) {
        e.preventDefault();
        this.props.state.wizard = 'username';
        this.props.updateParent(this.props.state);
    }
    submitNext(e) {
        e.preventDefault();

        var password = ReactDOM.findDOMNode(this.refs.password).value.trim();
        if (!password || password.length < Constants.MIN_PASSWORD_LENGTH) {
            this.setState({passwordError: this.props.intl.formatMessage(holders.passwordError, {chars: Constants.MIN_PASSWORD_LENGTH})});
            return;
        }

        this.setState({passwordError: null, serverError: null});
        $('#finish-button').button('loading');
        var teamSignup = JSON.parse(JSON.stringify(this.props.state));
        teamSignup.user.password = password;
        teamSignup.user.allow_marketing = true;
        delete teamSignup.wizard;

        Client.createTeamFromSignup(teamSignup,
            () => {
                Client.track('signup', 'signup_team_08_complete');

                var props = this.props;

                Client.loginByEmail(teamSignup.team.name, teamSignup.team.email, teamSignup.user.password,
                    () => {
                        UserStore.setLastEmail(teamSignup.team.email);
                        if (this.props.hash > 0) {
                            BrowserStore.setGlobalItem(this.props.hash, JSON.stringify({wizard: 'finished'}));
                        }

                        $('#sign-up-button').button('reset');
                        props.state.wizard = 'finished';
                        props.updateParent(props.state, true);

                        browserHistory.push('/' + teamSignup.team.name + '/channels/town-square');
                    },
                    (err) => {
                        if (err.id === 'api.user.login.not_verified.app_error') {
                            browserHistory.push('/verify_email?email=' + encodeURIComponent(teamSignup.team.email) + '&teamname=' + encodeURIComponent(teamSignup.team.name));
                        } else {
                            this.setState({serverError: err.message});
                            $('#finish-button').button('reset');
                        }
                    }
                );
            },
            (err) => {
                this.setState({serverError: err.message});
                $('#finish-button').button('reset');
            }
        );
    }
    render() {
        Client.track('signup', 'signup_team_07_password');

        var passwordError = null;
        var passwordDivStyle = 'form-group';
        if (this.state.passwordError) {
            passwordError = <div className='form-group has-error'><label className='control-label'>{this.state.passwordError}</label></div>;
            passwordDivStyle = ' has-error';
        }

        var serverError = null;
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        return (
            <div>
                <form>
                    <img
                        className='signup-team-logo'
                        src='/static/images/logo.png'
                    />
                    <h2 className='margin--less'>
                        <FormattedMessage
                            id='team_signup_password.yourPassword'
                            defaultMessage='Your password'
                        />
                    </h2>
                    <h5 className='color--light'>
                        <FormattedMessage
                            id='team_signup_password.selectPassword'
                            defaultMessage="Select a password that you'll use to login with your email address:"
                        />
                    </h5>
                    <div className='inner__content margin--extra'>
                        <h5><strong>
                            <FormattedMessage
                                id='team_signup_password.email'
                                defaultMessage='Email'
                            />
                        </strong></h5>
                        <div className='block--gray form-group'>{this.props.state.team.email}</div>
                        <div className={passwordDivStyle}>
                            <div className='row'>
                                <div className='col-sm-11'>
                                    <h5><strong>
                                        <FormattedMessage
                                            id='team_signup_password.choosePwd'
                                            defaultMessage='Choose your password'
                                        />
                                    </strong></h5>
                                    <input
                                        autoFocus={true}
                                        type='password'
                                        ref='password'
                                        className='form-control'
                                        placeholder=''
                                        maxLength='128'
                                        spellCheck='false'
                                    />
                                    <span className='color--light help-block'>
                                        <FormattedMessage
                                            id='team_signup_password.hint'
                                            defaultMessage='Passwords must contain {min} to {max} characters. Your password will be strongest if it contains a mix of symbols, numbers, and upper and lowercase characters.'
                                            values={{
                                                min: Constants.MIN_PASSWORD_LENGTH,
                                                max: Constants.MAX_PASSWORD_LENGTH
                                            }}
                                        />
                                    </span>
                                </div>
                            </div>
                            {passwordError}
                            {serverError}
                        </div>
                    </div>
                    <div className='form-group'>
                        <button
                            type='submit'
                            className='btn btn-primary margin--extra'
                            id='finish-button'
                            data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> ' + this.props.intl.formatMessage(holders.creating)}
                            onClick={this.submitNext}
                        >
                            <FormattedMessage
                                id='team_signup_password.finish'
                                defaultMessage='Finish'
                            />
                        </button>
                    </div>
                    <p>
                        <FormattedHTMLMessage
                            id='team_signup_password.agreement'
                            defaultMessage="By proceeding to create your account and use {siteName}, you agree to our <a href='/static/help/terms.html'>Terms of Service</a> and <a href='/static/help/privacy.html'>Privacy Policy</a>. If you do not agree, you cannot use {siteName}."
                            values={{
                                siteName: global.window.mm_config.SiteName
                            }}
                        />
                    </p>
                    <div className='margin--extra'>
                        <a
                            href='#'
                            onClick={this.submitBack}
                        >
                            <FormattedMessage
                                id='team_signup_password.back'
                                defaultMessage='Back to previous step'
                            />
                        </a>
                    </div>
                </form>
            </div>
        );
    }
}

TeamSignupPasswordPage.defaultProps = {
    state: {},
    hash: ''
};
TeamSignupPasswordPage.propTypes = {
    intl: intlShape.isRequired,
    state: React.PropTypes.object,
    hash: React.PropTypes.string,
    updateParent: React.PropTypes.func
};

export default injectIntl(TeamSignupPasswordPage);
