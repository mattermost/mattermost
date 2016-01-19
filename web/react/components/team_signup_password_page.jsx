// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as Client from '../utils/client.jsx';
import BrowserStore from '../stores/browser_store.jsx';
import UserStore from '../stores/user_store.jsx';

const messages = defineMessages({
    passwordError: {
        id: 'team_signup_password.passwordError',
        defaultMessage: 'Please enter at least 5 characters'
    },
    verifiedError: {
        id: 'team_signup_password.verifiedError',
        defaultMessage: 'Login failed because email address has not been verified'
    },
    yourPassword: {
        id: 'team_signup_password.yourPassword',
        defaultMessage: 'Your password'
    },
    selectPassword: {
        id: 'team_signup_password.selectPassword',
        defaultMessage: "Select a password that you'll use to login with your email address:"
    },
    email: {
        id: 'team_signup_password.email',
        defaultMessage: 'Email'
    },
    choosePwd: {
        id: 'team_signup_password.choosePwd',
        defaultMessage: 'Choose your password'
    },
    hint: {
        id: 'team_signup_password.hint',
        defaultMessage: 'Passwords must contain 5 to 50 characters. Your password will be strongest if it contains a mix of symbols, numbers, and upper and lowercase characters.'
    },
    creating: {
        id: 'team_signup_password.creating',
        defaultMessage: 'Creating team...'
    },
    finish: {
        id: 'team_signup_password.finish',
        defaultMessage: 'Finish'
    },
    proceeding: {
        id: 'team_signup_password.proceeding',
        defaultMessage: 'By proceeding to create your account and use'
    },
    agree: {
        id: 'team_signup_password.agree',
        defaultMessage: 'you agree to our'
    },
    terms: {
        id: 'team_signup_password.terms',
        defaultMessage: 'Terms of Service'
    },
    and: {
        id: 'team_signup_password.and',
        defaultMessage: 'and'
    },
    privacy: {
        id: 'team_signup_password.privacy',
        defaultMessage: 'Privacy Policy'
    },
    dontAgree: {
        id: 'team_signup_password.dontAgree',
        defaultMessage: 'If you do not agree, you cannot use'
    },
    back: {
        id: 'team_signup_password.back',
        defaultMessage: 'Back to previous step'
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

        const {formatMessage} = this.props.intl;
        var password = ReactDOM.findDOMNode(this.refs.password).value.trim();
        if (!password || password.length < 5) {
            this.setState({passwordError: formatMessage(messages.passwordError)});
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

                        window.location.href = '/' + teamSignup.team.name + '/channels/general';
                    },
                    (err) => {
                        if (err.message === formatMessage(messages.verifiedError)) {
                            window.location.href = '/verify_email?email=' + encodeURIComponent(teamSignup.team.email) + '&teamname=' + encodeURIComponent(teamSignup.team.name);
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
        const {formatMessage} = this.props.intl;
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
                    <h2 className='margin--less'>{formatMessage(messages.yourPassword)}</h2>
                    <h5 className='color--light'>{formatMessage(messages.selectPassword)}</h5>
                    <div className='inner__content margin--extra'>
                        <h5><strong>{formatMessage(messages.email)}</strong></h5>
                        <div className='block--gray form-group'>{this.props.state.team.email}</div>
                        <div className={passwordDivStyle}>
                            <div className='row'>
                                <div className='col-sm-11'>
                                    <h5><strong>{formatMessage(messages.choosePwd)}</strong></h5>
                                    <input
                                        autoFocus={true}
                                        type='password'
                                        ref='password'
                                        className='form-control'
                                        placeholder=''
                                        maxLength='128'
                                        spellCheck='false'
                                    />
                                    <span className='color--light help-block'>{formatMessage(messages.hint)}</span>
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
                            data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> ' + formatMessage(messages.creating)}
                            onClick={this.submitNext}
                        >
                            {formatMessage(messages.finish)}
                        </button>
                    </div>
                    <p>{formatMessage(messages.proceeding)} {global.window.mm_config.SiteName}, {formatMessage(messages.agree)} <a href='/static/help/terms.html'>{formatMessage(messages.terms)}</a> {formatMessage(messages.and)} <a href='/static/help/privacy.html'>{formatMessage(messages.privacy)}</a>. {formatMessage(messages.dontAgree)} {global.window.mm_config.SiteName}.</p>
                    <div className='margin--extra'>
                        <a
                            href='#'
                            onClick={this.submitBack}
                        >
                            {formatMessage(messages.back)}
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