// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var UserStore = require('../stores/user_store.jsx');

SendResetPasswordLink = React.createClass({
    handleSendLink: function(e) {
        e.preventDefault();
        var state = {};

        var email = this.refs.email.getDOMNode().value.trim();
        if (!email) {
            state.error = "Please enter a valid email address."
            this.setState(state);
            return;
        }

        state.error = null;
        this.setState(state);

        data = {};
        data['email'] = email;
        data['name'] = this.props.teamName;

        client.sendPasswordReset(data,
             function(data) {
                 this.setState({ error: null, update_text: <p>A password reset link has been sent to <b>{email}</b> for your <b>{this.props.teamDisplayName}</b> team on {window.location.hostname}.</p>, more_update_text: "Please check your inbox." });
                 $(this.refs.reset_form.getDOMNode()).hide();
             }.bind(this),
             function(err) {
                 this.setState({ error: err.message, update_text: null, more_update_text: null });
             }.bind(this)
            );
    },
    getInitialState: function() {
        return {};
    },
    render: function() {
        var update_text = this.state.update_text ? <div className="reset-form alert alert-success">{this.state.update_text}{this.state.more_update_text}</div> : null;
        var error = this.state.error ? <div className="form-group has-error"><label className="control-label">{this.state.error}</label></div> : null;

        return (
            <div className="col-sm-12">
                <div className="signup-team__container">
                    <h3>Password Reset</h3>
                    { update_text }
                    <form onSubmit={this.handleSendLink} ref="reset_form">
                        <p>{"To reset your password, enter the email address you used to sign up for " + this.props.teamDisplayName + "."}</p>
                        <div className={error ? 'form-group has-error' : 'form-group'}>
                            <input type="text" className="form-control" name="email" ref="email" placeholder="Email" />
                        </div>
                        { error }
                        <button type="submit" className="btn btn-primary">Reset my password</button>
                    </form>
                </div>
            </div>
        );
    }
});

ResetPassword = React.createClass({
    handlePasswordReset: function(e) {
        e.preventDefault();
        var state = {};

        var password = this.refs.password.getDOMNode().value.trim();
        if (!password || password.length < 5) {
            state.error = "Please enter at least 5 characters."
            this.setState(state);
            return;
        }

        state.error = null;
        this.setState(state);

        data = {};
        data['new_password'] = password;
        data['hash'] = this.props.hash;
        data['data'] = this.props.data;
        data['name'] = this.props.teamName;

        client.resetPassword(data,
             function(data) {
                 this.setState({ error: null, update_text: "Your password has been updated successfully." });
             }.bind(this),
             function(err) {
                 this.setState({ error: err.message, update_text: null });
             }.bind(this)
            );
    },
    getInitialState: function() {
        return {};
    },
    render: function() {
        var update_text = this.state.update_text ? <div className="form-group"><br/><label className="control-label reset-form">{this.state.update_text} Click <a href={"/" + this.props.teamName + "/login"}>here</a> to log in.</label></div> : null;
        var error = this.state.error ? <div className="form-group has-error"><label className="control-label">{this.state.error}</label></div> : null;

        return (
            <div className="col-sm-12">
                <div className="signup-team__container">
                    <h3>Password Reset</h3>
                    <form onSubmit={this.handlePasswordReset}>
                        <p>{"Enter a new password for your " + this.props.teamDisplayName + " " + config.SiteName + " account."}</p>
                        <div className={error ? 'form-group has-error' : 'form-group'}>
                            <input type="password" className="form-control" name="password" ref="password" placeholder="Password" />
                        </div>
                        { error }
                        <button type="submit" className="btn btn-primary">Change my password</button>
                        { update_text }
                    </form>
                </div>
            </div>
        );
    }
});

module.exports = React.createClass({
    getInitialState: function() {
        return {};
    },
    render: function() {

        if (this.props.isReset === "false") {
            return (
                <SendResetPasswordLink
                    teamDisplayName={this.props.teamDisplayName}
                    teamName={this.props.teamName}
                />
            );
        } else {
            return (
                <ResetPassword
                    teamDisplayName={this.props.teamDisplayName}
                    teamName={this.props.teamName}
                    hash={this.props.hash}
                    data={this.props.data}
                />
            );
        }
    }
});
