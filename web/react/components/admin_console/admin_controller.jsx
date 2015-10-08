// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var AdminSidebar = require('./admin_sidebar.jsx');
var AdminStore = require('../../stores/admin_store.jsx');
var TeamStore = require('../../stores/team_store.jsx');
var AsyncClient = require('../../utils/async_client.jsx');
var LoadingScreen = require('../loading_screen.jsx');

var EmailSettingsTab = require('./email_settings.jsx');
var LogSettingsTab = require('./log_settings.jsx');
var LogsTab = require('./logs.jsx');
var FileSettingsTab = require('./image_settings.jsx');
var PrivacySettingsTab = require('./privacy_settings.jsx');
var RateSettingsTab = require('./rate_settings.jsx');
var GitLabSettingsTab = require('./gitlab_settings.jsx');
var SqlSettingsTab = require('./sql_settings.jsx');
var TeamSettingsTab = require('./team_settings.jsx');
var ServiceSettingsTab = require('./service_settings.jsx');
var TeamUsersTab = require('./team_users.jsx');

export default class AdminController extends React.Component {
    constructor(props) {
        super(props);

        this.selectTab = this.selectTab.bind(this);
        this.removeSelectedTeam = this.removeSelectedTeam.bind(this);
        this.addSelectedTeam = this.addSelectedTeam.bind(this);
        this.onConfigListenerChange = this.onConfigListenerChange.bind(this);
        this.onAllTeamsListenerChange = this.onAllTeamsListenerChange.bind(this);

        var selectedTeams = AdminStore.getSelectedTeams();
        if (selectedTeams == null) {
            selectedTeams = {};
            selectedTeams[TeamStore.getCurrentId()] = 'true';
            AdminStore.saveSelectedTeams(selectedTeams);
        }

        this.state = {
            config: AdminStore.getConfig(),
            teams: AdminStore.getAllTeams(),
            selectedTeams,
            selected: 'service_settings',
            selectedTeam: null
        };
    }

    componentDidMount() {
        AdminStore.addConfigChangeListener(this.onConfigListenerChange);
        AsyncClient.getConfig();

        AdminStore.addAllTeamsChangeListener(this.onAllTeamsListenerChange);
        AsyncClient.getAllTeams();
    }

    componentWillUnmount() {
        AdminStore.removeConfigChangeListener(this.onConfigListenerChange);
        AdminStore.removeAllTeamsChangeListener(this.onAllTeamsListenerChange);
    }

    onConfigListenerChange() {
        this.setState({
            config: AdminStore.getConfig(),
            teams: AdminStore.getAllTeams(),
            selectedTeams: AdminStore.getSelectedTeams(),
            selected: this.state.selected,
            selectedTeam: this.state.selectedTeam
        });
    }

    onAllTeamsListenerChange() {
        this.setState({
            config: AdminStore.getConfig(),
            teams: AdminStore.getAllTeams(),
            selectedTeams: AdminStore.getSelectedTeams(),
            selected: this.state.selected,
            selectedTeam: this.state.selectedTeam

        });
    }

    selectTab(tab, teamId) {
        this.setState({
            config: AdminStore.getConfig(),
            teams: AdminStore.getAllTeams(),
            selectedTeams: AdminStore.getSelectedTeams(),
            selected: tab,
            selectedTeam: teamId
        });
    }

    removeSelectedTeam(teamId) {
        var selectedTeams = AdminStore.getSelectedTeams();
        Reflect.deleteProperty(selectedTeams, teamId);
        AdminStore.saveSelectedTeams(selectedTeams);

        this.setState({
            config: AdminStore.getConfig(),
            teams: AdminStore.getAllTeams(),
            selectedTeams: AdminStore.getSelectedTeams(),
            selected: this.state.selected,
            selectedTeam: this.state.selectedTeam
        });
    }

    addSelectedTeam(teamId) {
        var selectedTeams = AdminStore.getSelectedTeams();
        selectedTeams[teamId] = 'true';
        AdminStore.saveSelectedTeams(selectedTeams);

        this.setState({
            config: AdminStore.getConfig(),
            teams: AdminStore.getAllTeams(),
            selectedTeams: AdminStore.getSelectedTeams(),
            selected: this.state.selected,
            selectedTeam: this.state.selectedTeam
        });
    }

    render() {
        var tab = <LoadingScreen />;

        if (this.state.config != null) {
            if (this.state.selected === 'email_settings') {
                tab = <EmailSettingsTab config={this.state.config} />;
            } else if (this.state.selected === 'log_settings') {
                tab = <LogSettingsTab config={this.state.config} />;
            } else if (this.state.selected === 'logs') {
                tab = <LogsTab />;
            } else if (this.state.selected === 'image_settings') {
                tab = <FileSettingsTab config={this.state.config} />;
            } else if (this.state.selected === 'privacy_settings') {
                tab = <PrivacySettingsTab config={this.state.config} />;
            } else if (this.state.selected === 'rate_settings') {
                tab = <RateSettingsTab config={this.state.config} />;
            } else if (this.state.selected === 'gitlab_settings') {
                tab = <GitLabSettingsTab config={this.state.config} />;
            } else if (this.state.selected === 'sql_settings') {
                tab = <SqlSettingsTab config={this.state.config} />;
            } else if (this.state.selected === 'team_settings') {
                tab = <TeamSettingsTab config={this.state.config} />;
            } else if (this.state.selected === 'service_settings') {
                tab = <ServiceSettingsTab config={this.state.config} />;
            } else if (this.state.selected === 'team_users') {
                tab = <TeamUsersTab team={this.state.teams[this.state.selectedTeam]} />;
            }
        }

        return (
            <div>
                <div
                    className='sidebar--menu'
                    id='sidebar-menu'
                />
                <AdminSidebar
                    selected={this.state.selected}
                    selectedTeam={this.state.selectedTeam}
                    selectTab={this.selectTab}
                    teams={this.state.teams}
                    selectedTeams={this.state.selectedTeams}
                    removeSelectedTeam={this.removeSelectedTeam}
                    addSelectedTeam={this.addSelectedTeam}
                />
                <div className='inner__wrap channel__wrap'>
                    <div className='row header'>
                    </div>
                    <div className='row main'>
                        <div
                            id='app-content'
                            className='app__content admin'
                        >
                        {tab}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}