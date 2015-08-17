// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var BrowserStore = require('../stores/browser_store.jsx');

module.exports = React.createClass({
    displayName: 'WelcomePage',
    propTypes: {
        state: React.PropTypes.object,
        updateParent: React.PropTypes.func
    },
    submitNext: function(e) {
        if (!BrowserStore.isLocalStorageSupported()) {
            this.setState({storageError: 'This service requires local storage to be enabled. Please enable it or exit private browsing.'});
            return;
        }
        e.preventDefault();
        this.props.state.wizard = 'team_display_name';
        this.props.updateParent(this.props.state);
    },
    handleDiffEmail: function(e) {
        e.preventDefault();
        this.setState({useDiff: true});
    },
    handleDiffSubmit: function(e) {
        e.preventDefault();

        var state = {useDiff: true, serverError: ''};

        var email = this.refs.email.getDOMNode().value.trim().toLowerCase();
        if (!email || !utils.isEmail(email)) {
            state.emailError = 'Please enter a valid email address';
            this.setState(state);
            return;
        } else if (!BrowserStore.isLocalStorageSupported()) {
            state.emailError = 'This service requires local storage to be enabled. Please enable it or exit private browsing.';
            this.setState(state);
            return;
        }
        state.emailError = '';

        client.signupTeam(email,
            function success(data) {
                if (data.follow_link) {
                    window.location.href = data.follow_link;
                } else {
                    this.props.state.wizard = 'finished';
                    this.props.updateParent(this.props.state);
                    window.location.href = '/signup_team_confirm/?email=' + encodeURIComponent(email);
                }
            }.bind(this),
            function error(err) {
                this.state.serverError = err.message;
                this.setState(this.state);
            }.bind(this)
        );
    },
    getInitialState: function() {
        return {useDiff: false};
    },
    handleKeyPress: function(event) {
        if (event.keyCode === 13) {
            this.submitNext(event);
        }
    },
    componentWillMount: function() {
        document.addEventListener('keyup', this.handleKeyPress, false);
    },
    componentWillUnmount: function() {
        document.removeEventListener('keyup', this.handleKeyPress, false);
    },
    render: function() {
        client.track('signup', 'signup_team_01_welcome');

        var storageError = null;
        if (this.state.storageError) {
            storageError = <label className='control-label'>{this.state.storageError}</label>;
        }

        var emailError = null;
        var emailDivClass = 'form-group';
        if (this.state.emailError) {
            emailError = <label className='control-label'>{this.state.emailError}</label>;
            emailDivClass += ' has-error';
        }

        var serverError = null;
        if (this.state.serverError) {
            serverError = (
                <div className='form-group has-error'>
                    <label className='control-label'>{this.state.serverError}</label>
                </div>
            );
        }

        var differentEmailLinkClass = '';
        var emailDivContainerClass = 'hidden';
        if (this.state.useDiff) {
            differentEmailLinkClass = 'hidden';
            emailDivContainerClass = '';
        }

        return (
            <div>
                <p>
                    <img className='signup-team-logo' src='/static/images/logo.png' />
                    <h3 className='sub-heading'>Welcome to:</h3>
                    <h1 className='margin--top-none'>{config.SiteName}</h1>
                </p>
                <p className='margin--less'>Let's set up your new team</p>
                <p>
                    Please confirm your email address:<br />
                    <div className='inner__content'>
                        <div className='block--gray'>{this.props.state.team.email}</div>
                    </div>
                </p>
                <p className='margin--extra color--light'>
                    Your account will administer the new team site. <br />
                    You can add other administrators later.
                </p>
                <div className='form-group'>
                    <button className='btn-primary btn form-group' type='submit' onClick={this.submitNext}><i className='glyphicon glyphicon-ok'></i>Yes, this address is correct</button>
                    {storageError}
                </div>
                <hr />
                <div className={emailDivContainerClass}>
                    <div className={emailDivClass}>
                        <div className='row'>
                            <div className='col-sm-9'>
                                <input type='email' ref='email' className='form-control' placeholder='Email Address' maxLength='128' />
                            </div>
                        </div>
                        {emailError}
                    </div>
                    {serverError}
                    <button className='btn btn-md btn-primary' type='button' onClick={this.handleDiffSubmit}>Use this instead</button>
                </div>
                <a href='#' onClick={this.handleDiffEmail} className={differentEmailLinkClass}>Use a different email</a>
            </div>
        );
    }
});
