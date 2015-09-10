// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var UserStore = require('../stores/user_store.jsx');

module.exports = React.createClass({
    handleAllow: function() {
        var response_type = this.props.responseType;
        var client_id = this.props.clientId;
        var redirect_uri = this.props.redirectUri;
        var state = this.props.state;
        var scope = this.props.scope;

        client.allowOAuth2(response_type, client_id, redirect_uri, state, scope,
            function(data) {
                if (data.redirect) {
                    window.location.replace(data.redirect);
                }
            }.bind(this),
            function(err) {
                console.log(err);
            }.bind(this)
        );
    },
    handleDeny: function() {
        window.location.replace(this.props.redirectUri + "?error=access_denied");
    },
    getInitialState: function() {
        return { };
    },
    render: function() {
        var server_error = this.state.server_error ? <label className="control-label">{this.state.server_error}</label> : null;

        return (
            <div className="authorize-box">
                <div className="authorize-inner">
                    <h3>An application would like to connect to your {this.props.TeamName} account</h3>
                    <label>The app {this.props.appName} would like the ability to access and modify your basic information.</label>
                    <br/>
                    <br/>
                    <label>Allow {this.props.appName} access?</label>
                    <br/>
                    <button type="submit" className="btn authorize-btn" onClick={this.handleDeny}>Deny</button>
                    <button type="submit" className="btn btn-primary authorize-btn" onClick={this.handleAllow}>Allow</button>
                </div>
            </div>
        );
    }
});
