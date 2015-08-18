// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var utils = require('../utils/utils.jsx');
var NotificationsTab = require('./user_settings_notifications.jsx');
var SecurityTab = require('./user_settings_security.jsx');
var GeneralTab = require('./user_settings_general.jsx');
var AppearanceTab = require('./user_settings_appearance.jsx');

module.exports = React.createClass({
    displayName: 'UserSettings',
    componentDidMount: function() {
        UserStore.addChangeListener(this._onChange);
    },
    componentWillUnmount: function() {
        UserStore.removeChangeListener(this._onChange);
    },
    _onChange: function () {
        var user = UserStore.getCurrentUser();
        if (!utils.areStatesEqual(this.state.user, user)) {
            this.setState({ user: user });
        }
    },
    getInitialState: function() {
        return { user: UserStore.getCurrentUser() };
    },
    render: function() {
        if (this.props.activeTab === 'general') {
            return (
                <div>
                    <GeneralTab user={this.state.user} activeSection={this.props.activeSection} updateSection={this.props.updateSection} />
                </div>
            );
        } else if (this.props.activeTab === 'security') {
            return (
                <div>
                    <SecurityTab user={this.state.user} activeSection={this.props.activeSection} updateSection={this.props.updateSection} updateTab={this.props.updateTab} />
                </div>
            );
        } else if (this.props.activeTab === 'notifications') {
            return (
                <div>
                    <NotificationsTab user={this.state.user} activeSection={this.props.activeSection} updateSection={this.props.updateSection} updateTab={this.props.updateTab} />
                </div>
            );
        } else if (this.props.activeTab === 'appearance') {
            return (
                <div>
                    <AppearanceTab activeSection={this.props.activeSection} updateSection={this.props.updateSection} updateTab={this.props.updateTab} />
                </div>
            );
        } else {
            return <div/>;
        }
    }
});
