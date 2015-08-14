// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var UserStore = require('../stores/user_store.jsx');
var BrowserStore = require('../stores/browser_store.jsx');
var Constants = require('../utils/constants.jsx');

module.exports = React.createClass({
    handleSubmit: function(e) {
        e.preventDefault();
        var state = {};

        var name = this.props.teamName;
        if (!name) {
            state.serverError = 'Bad team name';
            this.setState(state);
            return;
        }

        var email = this.refs.email.getDOMNode().value.trim();
        if (!email) {
            state.serverError = 'An email is required';
            this.setState(state);
            return;
        }

        var password = this.refs.password.getDOMNode().value.trim();
        if (!password) {
            state.serverError = 'A password is required';
            this.setState(state);
            return;
        }

        if (!BrowserStore.isLocalStorageSupported()) {
            state.serverError = 'This service requires local storage to be enabled. Please enable it or exit private browsing.';
            this.setState(state);
            return;
        }

        state.serverError = '';
        this.setState(state);

        client.loginByEmail(name, email, password,
            function loggedIn(data) {
                UserStore.setCurrentUser(data);
                UserStore.setLastEmail(email);

                var redirect = utils.getUrlParameter('redirect');
                if (redirect) {
                    window.location.pathname = decodeURI(redirect);
                } else {
                    window.location.pathname = '/' + name + '/channels/town-square';
                }
            },
            function loginFailed(err) {
                if (err.message === 'Login failed because email address has not been verified') {
                    window.location.href = '/verify_email?name=' + encodeURIComponent(name) + '&email=' + encodeURIComponent(email);
                    return;
                }
                state.serverError = err.message;
                this.valid = false;
                this.setState(state);
            }.bind(this)
        );
    },
    getInitialState: function() {
        return { };
    },
    render: function() {
        var serverError;
        if (this.state.serverError) {
            serverError = <label className='control-label'>{this.state.serverError}</label>;
        }
        var priorEmail = UserStore.getLastEmail();

        var emailParam = utils.getUrlParameter('email');
        if (emailParam) {
            priorEmail = decodeURIComponent(emailParam);
        }

        var teamDisplayName = this.props.teamDisplayName;
        var teamName = this.props.teamName;

        var focusEmail = false;
        var focusPassword = false;
        if (priorEmail !== '') {
            focusPassword = true;
        } else {
            focusEmail = true;
        }

        var authServices = JSON.parse(this.props.authServices);

        var loginMessage = [];
        if (authServices.indexOf(Constants.GITLAB_SERVICE) >= 0) {
            loginMessage.push(
                <div className='form-group form-group--small'>
                    <span><a href={'/' + teamName + '/login/gitlab'}>{'Log in with GitLab'}</a></span>
                </div>
            );
        }
        if (authServices.indexOf(Constants.GOOGLE_SERVICE) >= 0) {
            loginMessage.push(
                <div className='form-group form-group--small'>
                    <span><a href={'/' + teamName + '/login/google'}>{'Log in with Google'}</a></span>
                </div>
            );
        }

        var errorClass = '';
        if (serverError) {
            errorClass = ' has-error';
        }

        return (
            <div className='signup-team__container'>
                <h5 className='margin--less'>Sign in to:</h5>
                <h2 className='signup-team__name'>{teamDisplayName}</h2>
                <h2 className='signup-team__subdomain'>on {config.SiteName}</h2>
                <form onSubmit={this.handleSubmit}>
                    <div className={'form-group' + errorClass}>
                        {serverError}
                    </div>
                    <div className={'form-group' + errorClass}>
                        <input autoFocus={focusEmail} type='email' className='form-control' name='email' defaultValue={priorEmail} ref='email' placeholder='Email' />
                    </div>
                    <div className={'form-group' + errorClass}>
                        <input autoFocus={focusPassword} type='password' className='form-control' name='password' ref='password' placeholder='Password' />
                    </div>
                    <div className='form-group'>
                        <button type='submit' className='btn btn-primary'>Sign in</button>
                    </div>
                    {loginMessage}
                    <div className='form-group margin--extra form-group--small'>
                        <span><a href='/find_team'>{'Find other ' + strings.TeamPlural}</a></span>
                    </div>
                    <div className='form-group'>
                        <a href={'/' + teamName + '/reset_password'}>I forgot my password</a>
                    </div>
                    <div className='margin--extra'>
                        <span>{'Want to create your own ' + strings.Team + '?'} <a href='/' className='signup-team-login'>Sign up now</a></span>
                    </div>
                </form>
            </div>
        );
    }
});
