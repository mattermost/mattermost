// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../../stores/user_store.jsx');
var utils = require('../../utils/utils.jsx');
var NotificationsTab = require('./user_settings_notifications.jsx');
var SecurityTab = require('./user_settings_security.jsx');
var GeneralTab = require('./user_settings_general.jsx');
var AppearanceTab = require('./user_settings_appearance.jsx');
var DeveloperTab = require('./user_settings_developer.jsx');
var IntegrationsTab = require('./user_settings_integrations.jsx');

export default class UserSettings extends React.Component {
    constructor(props) {
        super(props);

        this.onListenerChange = this.onListenerChange.bind(this);

        this.state = {user: UserStore.getCurrentUser()};
    }

    componentDidMount() {
        UserStore.addChangeListener(this.onListenerChange);
    }

    componentWillUnmount() {
        UserStore.removeChangeListener(this.onListenerChange);
    }

    onListenerChange() {
        var user = UserStore.getCurrentUser();
        if (!utils.areStatesEqual(this.state.user, user)) {
            this.setState({user: user});
        }
    }

    render() {
        if (this.props.activeTab === 'general') {
            return (
                <div>
                    <GeneralTab
                        user={this.state.user}
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                        updateTab={this.props.updateTab}
                    />
                </div>
            );
        } else if (this.props.activeTab === 'security') {
            return (
                <div>
                    <SecurityTab
                        user={this.state.user}
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                        updateTab={this.props.updateTab}
                    />
                </div>
            );
        } else if (this.props.activeTab === 'notifications') {
            return (
                <div>
                    <NotificationsTab
                        user={this.state.user}
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                        updateTab={this.props.updateTab}
                    />
                </div>
            );
        } else if (this.props.activeTab === 'appearance') {
            return (
                <div>
                    <AppearanceTab
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                        updateTab={this.props.updateTab}
                    />
                </div>
            );
        } else if (this.props.activeTab === 'developer') {
            return (
                <div>
                    <DeveloperTab
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                    />
                </div>
            );
        } else if (this.props.activeTab === 'integrations') {
            return (
                <div>
                    <IntegrationsTab
                        user={this.state.user}
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                        updateTab={this.props.updateTab}
                    />
                </div>
            );
        }

        return <div/>;
    }
}

UserSettings.propTypes = {
    activeTab: React.PropTypes.string,
    activeSection: React.PropTypes.string,
    updateSection: React.PropTypes.func,
    updateTab: React.PropTypes.func
};
