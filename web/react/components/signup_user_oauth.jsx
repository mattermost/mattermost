// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.


var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var UserStore = require('../stores/user_store.jsx');
var BrowserStore = require('../stores/browser_store.jsx');

module.exports = React.createClass({
    handleSubmit: function(e) {
         e.preventDefault();

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

        this.setState({name_error: "", server_error: ""});

        this.state.user.allow_marketing = this.refs.email_service.getDOMNode().checked;

        var user = this.state.user;
        client.createUser(user, "", "",
            function(data) {
                client.track('signup', 'signup_user_oauth_02');
                UserStore.setCurrentUser(data);
                UserStore.setLastEmail(data.email);

                window.location.href = '/' + this.props.teamName + '/login/' + user.auth_service + '?login_hint=' + user.email;
            }.bind(this),
            function(err) {
                this.state.server_error = err.message;
                this.setState(this.state);
            }.bind(this)
        );
    },
    handleChange: function() {
        var user = this.state.user;
        user.username = this.refs.name.getDOMNode().value;
        this.setState({ user: user });
    },
    getInitialState: function() {
        var user = JSON.parse(this.props.user);
        return { user: user };
    },
    render: function() {

        client.track('signup', 'signup_user_oauth_01');

        var name_error = this.state.name_error ? <label className='control-label'>{ this.state.name_error }</label> : null;
        var server_error = this.state.server_error ? <div className={ "form-group has-error" }><label className='control-label'>{ this.state.server_error }</label></div> : null;

        var yourEmailIs = this.state.user.email == "" ? "" : <span>Your email address is <b>{ this.state.user.email }.</b></span>;

        return (
            <div>
                <img className="signup-team-logo" src="/static/images/logo.png" />
                <h4>Welcome to { config.SiteName }</h4>
                <p>{"To continue signing up with " + this.state.user.auth_service + ", please register a username."}</p>
                <p>Your username can be made of lowercase letters and numbers.</p>
                <label className="control-label">Username</label>
                <div className={ name_error ? "form-group has-error" : "form-group" }>
                <input type="text" ref="name" className="form-control" placeholder="" maxLength="128" value={this.state.user.username} onChange={this.handleChange} />
                { name_error }
                </div>
                <p>{"Pick something " + strings.Team + "mates will recognize. Your username is how you will appear to others."}</p>
                <p>{ yourEmailIs } You’ll use this address to sign in to {config.SiteName}.</p>
                <div className="checkbox"><label><input type="checkbox" ref="email_service" /> It's ok to send me occassional email with updates about the {config.SiteName} service. </label></div>
                <p><button onClick={this.handleSubmit} className="btn-primary btn">Create Account</button></p>
                { server_error }
                <p>By proceeding to create your account and use { config.SiteName }, you agree to our <a href={ config.TermsLink }>Terms of Service</a> and <a href={ config.PrivacyLink }>Privacy Policy</a>. If you do not agree, you cannot use {config.SiteName}.</p>
            </div>
        );
    }
});


