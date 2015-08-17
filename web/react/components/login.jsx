// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var UserStore = require('../stores/user_store.jsx');
var TeamStore = require('../stores/team_store.jsx');
var BrowserStore = require('../stores/browser_store.jsx');
var Constants = require('../utils/constants.jsx');

module.exports = React.createClass({
    handleSubmit: function(e) {
        e.preventDefault();
        var state = { }

        var name = this.props.teamName
        if (!name) {
            state.server_error = "Bad team name"
            this.setState(state);
            return;
        }

        var email = this.refs.email.getDOMNode().value.trim();
        if (!email) {
            state.server_error = "An email is required"
            this.setState(state);
            return;
        }

        var password = this.refs.password.getDOMNode().value.trim();
        if (!password) {
            state.server_error = "A password is required"
            this.setState(state);
            return;
        }

        if (!BrowserStore.isLocalStorageSupported()) {
            state.server_error = "This service requires local storage to be enabled. Please enable it or exit private browsing.";
            this.setState(state);
            return;
        }

        state.server_error = "";
        this.setState(state);

        client.loginByEmail(name, email, password,
            function(data) {
                UserStore.setCurrentUser(data);
                UserStore.setLastEmail(email);

                var redirect = utils.getUrlParameter("redirect");
                if (redirect) {
                    window.location.pathname = decodeURIComponent(redirect);
                } else {
                    window.location.pathname = '/' + name + '/channels/town-square';
                }

            }.bind(this),
            function(err) {
                if (err.message == "Login failed because email address has not been verified") {
                    window.location.href = '/verify_email?name=' + encodeURIComponent(name) + '&email=' + encodeURIComponent(email);
                    return;
                }
                state.server_error = err.message;
                this.valid = false;
                this.setState(state);
            }.bind(this)
        );
    },
    getInitialState: function() {
        return { };
    },
    render: function() {
        var server_error = this.state.server_error ? <label className="control-label">{this.state.server_error}</label> : null;
        var priorEmail = UserStore.getLastEmail() !== "undefined" ? UserStore.getLastEmail() : ""

        var emailParam = utils.getUrlParameter("email");
        if (emailParam) {
            priorEmail = decodeURIComponent(emailParam);
        }

        var teamDisplayName = this.props.teamDisplayName;
        var teamName = this.props.teamName;

        var focusEmail = false;
        var focusPassword = false;
        if (priorEmail != "") {
            focusPassword = true;
        } else {
            focusEmail = true;
        }

        var auth_services = JSON.parse(this.props.authServices);

        var login_message;
        if (auth_services.indexOf("gitlab") >= 0) {
            login_message = (
                <div className="form-group form-group--small">
                    <span><a href={"/"+teamName+"/login/gitlab"}>{"Log in with GitLab"}</a></span>
                </div>
            );
        }

        return (
            <div className="signup-team__container">
                <h5 className="margin--less">Sign in to:</h5>
                <h2 className="signup-team__name">{ teamDisplayName }</h2>
                <h2 className="signup-team__subdomain">on { config.SiteName }</h2>
                <form onSubmit={this.handleSubmit}>
                    <div className={server_error ? 'form-group has-error' : 'form-group'}>
                        { server_error }
                    </div>
                    <div className={server_error ? 'form-group has-error' : 'form-group'}>
                        <input autoFocus={focusEmail} type="email" className="form-control" name="email" defaultValue={priorEmail}  ref="email" placeholder="Email" />
                    </div>
                    <div className={server_error ? 'form-group has-error' : 'form-group'}>
                        <input autoFocus={focusPassword} type="password" className="form-control" name="password" ref="password" placeholder="Password" />
                    </div>
                    <div className="form-group">
                        <button type="submit" className="btn btn-primary">Sign in</button>
                    </div>
                    { login_message }
                    <div className="form-group margin--extra form-group--small">
                        <span><a href="/find_team">{"Find other " + strings.TeamPlural}</a></span>
                    </div>
                    <div className="form-group">
                        <a href={"/" + teamName + "/reset_password"}>I forgot my password</a>
                    </div>
                    <div className="margin--extra">
                        <span>{"Want to create your own " + strings.Team + "?"} <a href="/" className="signup-team-login">Sign up now</a></span>
                    </div>
                </form>
            </div>
        );
    }
});
