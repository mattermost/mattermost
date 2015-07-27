// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.


var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var UserStore = require('../stores/user_store.jsx');
var BrowserStore = require('../stores/browser_store.jsx');

module.exports = React.createClass({
    handleSubmit: function(e) {
         e.preventDefault();

        this.state.user.username = this.refs.name.getDOMNode().value.trim();
        if (!this.state.user.username) {
            this.setState({name_error: "This field is required", email_error: "", password_error: "", server_error: ""});
            return;
        }

        var username_error = utils.isValidUsername(this.state.user.username);
        if (username_error === "Cannot use a reserved word as a username.") {
            this.setState({name_error: "This username is reserved, please choose a new one.", email_error: "", password_error: "", server_error: ""});
            return;
        } else if (username_error) {
            this.setState({name_error: "Username must begin with a letter, and contain between 3 to 15 lowercase characters made up of numbers, letters, and the symbols '.', '-' and '_'.", email_error: "", password_error: "", server_error: ""});
            return;
        }

        this.state.user.email = this.refs.email.getDOMNode().value.trim();
        if (!this.state.user.email) {
            this.setState({name_error: "", email_error: "This field is required", password_error: ""});
            return;
        }

        this.state.user.password = this.refs.password.getDOMNode().value.trim();
        if (!this.state.user.password  || this.state.user.password .length < 5) {
            this.setState({name_error: "", email_error: "", password_error: "Please enter at least 5 characters", server_error: ""});
            return;
        }

        this.setState({name_error: "", email_error: "", password_error: "", server_error: ""});

        this.state.user.allow_marketing = this.refs.email_service.getDOMNode().checked;

        client.createUser(this.state.user, this.state.data, this.state.hash,
            function(data) {
                client.track('signup', 'signup_user_02_complete');

                client.loginByEmail(this.props.teamName, this.state.user.email, this.state.user.password,
                    function(data) {
                        UserStore.setLastEmail(this.state.user.email);
                        UserStore.setCurrentUser(data);
                        if (this.props.hash > 0)
                        {
                            BrowserStore.setGlobalItem(this.props.hash, JSON.stringify({wizard: "finished"}));
                        }
                        window.location.href = '/';
                    }.bind(this),
                    function(err) {
                        if (err.message == "Login failed because email address has not been verified") {
                            window.location.href = "/verify_email?email="+ encodeURIComponent(this.state.user.email) + "&domain=" + encodeURIComponent(this.props.teamName);
                        } else {
                            this.state.server_error = err.message;
                            this.setState(this.state);
                        }
                    }.bind(this)
                );
            }.bind(this),
            function(err) {
                this.state.server_error = err.message;
                this.setState(this.state);
            }.bind(this)
        );
    },
    getInitialState: function() {
        var props = BrowserStore.getGlobalItem(this.props.hash);

        if (!props) {
            props = {};
            props.wizard = "welcome";
            props.user = {};
            props.user.team_id = this.props.teamId;
            props.user.email = this.props.email;
            props.hash = this.props.hash;
            props.data = this.props.data;
            props.original_email = this.props.email;
        }

        return props;
    },
    render: function() {

        client.track('signup', 'signup_user_01_welcome');

        if (this.state.wizard == "finished") {
            return (<div>You've already completed the signup process for this invitation or this invitation has expired.</div>);
        }

        var email_error = this.state.email_error ? <label className='control-label'>{ this.state.email_error }</label> : null;
        var name_error = this.state.name_error ? <label className='control-label'>{ this.state.name_error }</label> : null;
        var password_error = this.state.password_error ? <label className='control-label'>{ this.state.password_error }</label> : null;
        var server_error = this.state.server_error ? <div className={ "form-group has-error" }><label className='control-label'>{ this.state.server_error }</label></div> : null;

        var yourEmailIs = this.state.user.email == "" ? "" : <span>Your email address is { this.state.user.email }.  </span>

        var email = (
                <div className={ this.state.original_email == "" ? "margin--extra" : "hidden"} >
                <h5><strong>What's your email address?</strong></h5>
                <div className={ email_error ? "form-group has-error" : "form-group" }>
                <input type="email" ref="email" className="form-control" defaultValue={ this.state.user.email } placeholder="" maxLength="128" />
                { email_error }
                </div>
                </div>
        );

        var auth_services = JSON.parse(this.props.authServices);

        var signup_message;
        if (auth_services.indexOf("gitlab") >= 0) {
            signup_message = <div><a className="btn btn-custom-login gitlab" href={"/"+this.props.teamName+"/signup/gitlab"+window.location.search}><span className="icon" />{"with GitLab"}</a>
            <div className="or__container"><span>or</span></div></div>;
        }

        return (
            <div>
                <img className="signup-team-logo" src="/static/images/logo.png" />
                <h5 className="margin--less">Welcome to:</h5>
                <h2 className="signup-team__name"> "teamDisplayName" </h2>
                <h2 className="signup-team__subdomain">on { config.SiteName }</h2>
                <h4 className="color--light">Let's create your account</h4>
                { signup_message }
                <div className="inner__content">
                    { email }
                    <p className={ this.state.original_email == "" ? "hidden" : ""}>{ yourEmailIs } You’ll use this address to sign in to {config.SiteName}.</p>
                    <div className="margin--extra">
                        <h5><strong>Choose your username</strong></h5>
                        <div className={ name_error ? "form-group has-error" : "form-group" }>
                        <input type="text" ref="name" className="form-control" placeholder="" maxLength="128" />
                        { name_error }
                        <p className="form__hint">Username must begin with a letter, and contain between 3 to 15 lowercase characters made up of numbers, letters, and the symbols '.', '-' and '_'"</p>
                        </div>
                    </div>
                    <div className="margin--extra">
                        <h5><strong>Choose your password</strong></h5>
                        <div className={ password_error ? "form-group has-error" : "form-group" }>
                        <input type="password" ref="password" className="form-control" placeholder="" maxLength="128" />
                        { password_error }
                        </div>
                    </div>
                    <div className="checkbox"><label><input type="checkbox" ref="email_service" /> It's ok to send me occassional email with updates about the {config.SiteName} service. </label></div>
                    </div>
                <p className="margin--extra"><button onClick={this.handleSubmit} className="btn-primary btn">Create Account</button></p>
                { server_error }
                <p>By creating an account and using Mattermost you are agreeing to our <a href={ config.TermsLink }>Terms of Service</a>. If you do not agree, you cannot use this service.</p>
            </div>
        );
    }
});


