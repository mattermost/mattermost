// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from '../../stores/user_store.jsx';
import * as utils from '../../utils/utils.jsx';
import NotificationsTab from './user_settings_notifications.jsx';
import SecurityTab from './user_settings_security.jsx';
import GeneralTab from './user_settings_general.jsx';
import AppearanceTab from './user_settings_appearance.jsx';
import DeveloperTab from './user_settings_developer.jsx';
import IntegrationsTab from './user_settings_integrations.jsx';
import DisplayTab from './user_settings_display.jsx';
import AdvancedTab from './user_settings_advanced.jsx';
import LanguagesTab from './user_settings_language.jsx';

export default class UserSettings extends React.Component {
    constructor(props) {
        super(props);

        this.getActiveTab = this.getActiveTab.bind(this);
        this.onListenerChange = this.onListenerChange.bind(this);

        this.state = {user: UserStore.getCurrentUser()};
    }

    componentDidMount() {
        UserStore.addChangeListener(this.onListenerChange);
    }

    componentWillUnmount() {
        UserStore.removeChangeListener(this.onListenerChange);
    }

    getActiveTab() {
        return this.refs.activeTab;
    }

    onListenerChange() {
        var user = UserStore.getCurrentUser();
        if (!utils.areObjectsEqual(this.state.user, user)) {
            this.setState({user});
        }
    }

    render() {
        if (this.props.activeTab === 'general') {
            return (
                <div>
                    <GeneralTab
                        ref='activeTab'
                        user={this.state.user}
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                        updateTab={this.props.updateTab}
                        closeModal={this.props.closeModal}
                        collapseModal={this.props.collapseModal}
                    />
                </div>
            );
        } else if (this.props.activeTab === 'security') {
            return (
                <div>
                    <SecurityTab
                        ref='activeTab'
                        user={this.state.user}
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                        updateTab={this.props.updateTab}
                        closeModal={this.props.closeModal}
                        collapseModal={this.props.collapseModal}
                        setEnforceFocus={this.props.setEnforceFocus}
                    />
                </div>
            );
        } else if (this.props.activeTab === 'notifications') {
            return (
                <div>
                    <NotificationsTab
                        ref='activeTab'
                        user={this.state.user}
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                        updateTab={this.props.updateTab}
                        closeModal={this.props.closeModal}
                        collapseModal={this.props.collapseModal}
                    />
                </div>
            );
        } else if (this.props.activeTab === 'appearance') {
            return (
                <div>
                    <AppearanceTab
                        ref='activeTab'
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                        updateTab={this.props.updateTab}
                        closeModal={this.props.closeModal}
                        collapseModal={this.props.collapseModal}
                        setEnforceFocus={this.props.setEnforceFocus}
                        setRequireConfirm={this.props.setRequireConfirm}
                    />
                </div>
            );
        } else if (this.props.activeTab === 'developer') {
            return (
                <div>
                    <DeveloperTab
                        ref='activeTab'
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                        closeModal={this.props.closeModal}
                        collapseModal={this.props.collapseModal}
                    />
                </div>
            );
        } else if (this.props.activeTab === 'integrations') {
            return (
                <div>
                    <IntegrationsTab
                        ref='activeTab'
                        user={this.state.user}
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                        updateTab={this.props.updateTab}
                        closeModal={this.props.closeModal}
                        collapseModal={this.props.collapseModal}
                    />
                </div>
            );
        } else if (this.props.activeTab === 'display') {
            return (
                <div>
                    <DisplayTab
                        ref='activeTab'
                        user={this.state.user}
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                        updateTab={this.props.updateTab}
                        closeModal={this.props.closeModal}
                        collapseModal={this.props.collapseModal}
                    />
                </div>
            );
        } else if (this.props.activeTab === 'advanced') {
            return (
                <div>
                    <AdvancedTab
                        ref='activeTab'
                        user={this.state.user}
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                        updateTab={this.props.updateTab}
                        closeModal={this.props.closeModal}
                        collapseModal={this.props.collapseModal}
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
    updateTab: React.PropTypes.func,
    closeModal: React.PropTypes.func.isRequired,
    collapseModal: React.PropTypes.func.isRequired,
    setEnforceFocus: React.PropTypes.func.isRequired,
    setRequireConfirm: React.PropTypes.func.isRequired
};
