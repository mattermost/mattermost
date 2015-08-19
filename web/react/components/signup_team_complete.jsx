// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var WelcomePage = require('./team_signup_welcome_page.jsx');
var TeamDisplayNamePage = require('./team_signup_display_name_page.jsx');
var TeamURLPage = require('./team_signup_url_page.jsx');
var AllowedDomainsPage = require('./team_signup_allowed_domains_page.jsx');
var SendInivtesPage = require('./team_signup_send_invites_page.jsx');
var UsernamePage = require('./team_signup_username_page.jsx');
var PasswordPage = require('./team_signup_password_page.jsx');
var BrowserStore = require('../stores/browser_store.jsx');

module.exports = React.createClass({
    displayName: 'SignupTeamComplete',
    propTypes: {
        hash: React.PropTypes.string,
        email: React.PropTypes.string,
        data: React.PropTypes.string
    },
    updateParent: function(state, skipSet) {
        BrowserStore.setGlobalItem(this.props.hash, state);

        if (!skipSet) {
            this.setState(state);
        }
    },
    getInitialState: function() {
        var props = BrowserStore.getGlobalItem(this.props.hash);

        if (!props) {
            props = {};
            props.wizard = 'welcome';
            props.team = {};
            props.team.email = this.props.email;
            props.team.allowed_domains = '';
            props.invites = [];
            props.invites.push('');
            props.invites.push('');
            props.invites.push('');
            props.user = {};
            props.hash = this.props.hash;
            props.data = this.props.data;
        }

        return props;
    },
    render: function() {
        if (this.state.wizard === 'welcome') {
            return <WelcomePage state={this.state} updateParent={this.updateParent} />;
        }

        if (this.state.wizard === 'team_display_name') {
            return <TeamDisplayNamePage state={this.state} updateParent={this.updateParent} />;
        }

        if (this.state.wizard === 'team_url') {
            return <TeamURLPage state={this.state} updateParent={this.updateParent} />;
        }

        if (this.state.wizard === 'allowed_domains') {
            return <AllowedDomainsPage state={this.state} updateParent={this.updateParent} />;
        }

        if (this.state.wizard === 'send_invites') {
            return <SendInivtesPage state={this.state} updateParent={this.updateParent} />;
        }

        if (this.state.wizard === 'username') {
            return <UsernamePage state={this.state} updateParent={this.updateParent} />;
        }

        if (this.state.wizard === 'password') {
            return <PasswordPage state={this.state} updateParent={this.updateParent} />;
        }

        return (<div>You've already completed the signup process for this invitation or this invitation has expired.</div>);
    }
});
