// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.


var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var UserStore = require('../stores/user_store.jsx');


module.exports = React.createClass({
    handleSubmit: function(e) {
         e.preventDefault();

        this.state.user.username = this.refs.name.getDOMNode().value.trim();
        if (!this.state.user.username) {
            this.setState({name_error: "This field is required", email_error: "", password_error: ""});
            return;
        }

        var username_error = utils.isValidUsername(this.state.user.username)
        if (username_error === "Cannot use a reserved word as a username.") {
            this.setState({name_error: "This username is reserved, please choose a new one." });
            return;
        } else if (username_error) {
            this.setState({name_error: "Username must begin with a letter, and contain between 3 to 15 lowercase characters made up of numbers, letters, and the symbols '.', '-' and '_'." });
            return;
        }

        this.state.user.email = this.refs.email.getDOMNode().value.trim();
        if (!this.state.user.email) {
            this.setState({name_error: "", email_error: "This field is required", password_error: ""});
            return;
        }

        this.state.user.password = this.refs.password.getDOMNode().value.trim();
        if (!this.state.user.password  || this.state.user.password .length < 5) {
            this.setState({name_error: "", email_error: "", password_error: "Please enter at least 5 characters"});
            return;
        }

        this.state.user.allow_marketing = this.refs.email_service.getDOMNode().checked;

        client.createUser(this.state.user, this.state.data, this.state.hash,
            function(data) {
                client.track('signup', 'signup_user_02_complete');

                if (data.email_verified) {
                    client.loginByEmail(this.props.domain, this.state.user.email, this.state.user.password,
                        function(data) {
                            UserStore.setLastDomain(this.props.domain);
                            UserStore.setLastEmail(this.state.user.email);
                            UserStore.setCurrentUser(data);
                            if (this.props.hash > 0)
                                localStorage.setItem(this.props.hash, JSON.stringify({wizard: "finished"}));
                            window.location.href = '/channels/town-square';
                        }.bind(this),
                        function(err) {
                            this.state.server_error = err.message;
                            this.setState(this.state);
                        }.bind(this)
                    );
                }
                else {
                    window.location.href = "/verify?email="+ encodeURIComponent(this.state.user.email) + "&domain=" + encodeURIComponent(this.props.domain);
                }
            }.bind(this),
            function(err) {
                this.state.server_error = err.message;
                this.setState(this.state);
            }.bind(this)
        );
    },
    getInitialState: function() {
        var props = null;
        try {
            props = JSON.parse(localStorage.getItem(this.props.hash));
        }
        catch(parse_error) {
        }

        if (!props) {
            props = {};
            props.wizard = "welcome";
            props.user = {};
            props.user.team_id = this.props.team_id;
            props.user.email = this.props.email;
            props.hash = this.props.hash;
            props.data = this.props.data;
            props.original_email = this.props.email;
        }

        return props ;
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

        var email =
                <div className={ this.state.original_email == "" ? "" : "hidden"} >
                <label className="control-label">Email</label>
                <div className={ email_error ? "form-group has-error" : "form-group" }>
                <input type="email" ref="email" className="form-control" defaultValue={ this.state.user.email } placeholder="" maxLength="128" />
                { email_error }
                </div>
                </div>

        return (
            <div>
                <img className="signup-team-logo" src="/static/images/logo.png" />
                <h4>Welcome to { config.SiteName }</h4>
                <p>{"Choose your username and password for the " + this.props.team_name + " " + strings.Team +"."}</p>
                <p>Your username can be made of lowercase letters and numbers.</p>
                <label className="control-label">Username</label>
                <div className={ name_error ? "form-group has-error" : "form-group" }>
                <input type="text" ref="name" className="form-control" placeholder="" maxLength="128" />
                { name_error }
                </div>
                { email }
                <label className="control-label">Password</label>
                <div className={ name_error ? "form-group has-error" : "form-group" }>
                <input type="password" ref="password" className="form-control" placeholder="" maxLength="128" />
                { password_error }
                </div>
                <p>{"Pick something " + strings.Team + "mates will recognize. Your username is how you will appear to others"}</p>
                <p className={ this.state.original_email == "" ? "hidden" : ""}>{ yourEmailIs } You’ll use this address to sign in to {config.SiteName}.</p>
                <div className="checkbox"><label><input type="checkbox" ref="email_service" /> It's ok to send me occassional email with updates about the {config.SiteName} service. </label></div>
                <p><button onClick={this.handleSubmit} className="btn-primary btn">Create Account</button></p>
                { server_error }
                <p>By proceeding to create your account and use { config.SiteName }, you agree to our <a href={ config.TermsLink }>Terms of Service</a> and <a href={ config.PrivacyLink }>Privacy Policy</a>. If you do not agree, you cannot use {config.SiteName}.</p>
            </div>
        );
    }
});


