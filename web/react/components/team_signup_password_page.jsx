// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../utils/client.jsx');
var BrowserStore = require('../stores/browser_store.jsx');
var UserStore = require('../stores/user_store.jsx');

export default class TeamSignupPasswordPage extends React.Component {
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

        var password = React.findDOMNode(this.refs.password).value.trim();
        if (!password || password.length < 5) {
            this.setState({passwordError: 'Please enter at least 5 characters'});
            return;
        }

        this.setState({passwordError: null, serverError: null});
        $('#finish-button').button('loading');
        var teamSignup = JSON.parse(JSON.stringify(this.props.state));
        teamSignup.user.password = password;
        teamSignup.user.allow_marketing = true;
        delete teamSignup.wizard;

        Client.createTeamFromSignup(teamSignup,
            function success() {
                Client.track('signup', 'signup_team_08_complete');

                var props = this.props;

                Client.loginByEmail(teamSignup.team.name, teamSignup.team.email, teamSignup.user.password,
                    function loginSuccess(data) {
                        UserStore.setLastEmail(teamSignup.team.email);
                        UserStore.setCurrentUser(data);
                        if (this.props.hash > 0) {
                            BrowserStore.setGlobalItem(this.props.hash, JSON.stringify({wizard: 'finished'}));
                        }

                        $('#sign-up-button').button('reset');
                        props.state.wizard = 'finished';
                        props.updateParent(props.state, true);

                        window.location.href = '/';
                    }.bind(this),
                    function loginFail(err) {
                        if (err.message === 'Login failed because email address has not been verified') {
                            window.location.href = '/verify_email?email=' + encodeURIComponent(teamSignup.team.email) + '&teamname=' + encodeURIComponent(teamSignup.team.name);
                        } else {
                            this.setState({serverError: err.message});
                            $('#finish-button').button('reset');
                        }
                    }.bind(this)
                );
            }.bind(this),
            function error(err) {
                this.setState({serverError: err.message});
                $('#finish-button').button('reset');
            }.bind(this)
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
                    <h2 className='margin--less'>Your password</h2>
                    <h5 className='color--light'>Select a password that you'll use to login with your email address:</h5>
                    <div className='inner__content margin--extra'>
                        <h5><strong>Email</strong></h5>
                        <div className='block--gray form-group'>{this.props.state.team.email}</div>
                        <div className={passwordDivStyle}>
                            <div className='row'>
                                <div className='col-sm-11'>
                                    <h5><strong>Choose your password</strong></h5>
                                    <input
                                        autoFocus={true}
                                        type='password'
                                        ref='password'
                                        className='form-control'
                                        placeholder=''
                                        maxLength='128'
                                    />
                                    <div className='color--light form__hint'>Passwords must contain 5 to 50 characters. Your password will be strongest if it contains a mix of symbols, numbers, and upper and lowercase characters.</div>
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
                            data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> Creating ' + strings.Team + '...'}
                            onClick={this.submitNext}
                        >
                            Finish
                        </button>
                    </div>
                    <p>By proceeding to create your account and use {config.SiteName}, you agree to our <a href={config.TermsLink}>Terms of Service</a> and <a href={config.PrivacyLink}>Privacy Policy</a>. If you do not agree, you cannot use {config.SiteName}.</p>
                    <div className='margin--extra'>
                        <a
                            href='#'
                            onClick={this.submitBack}
                        >
                            Back to previous step
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
    state: React.PropTypes.object,
    hash: React.PropTypes.string,
    updateParent: React.PropTypes.func
};
