// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var AdminSidebar = require('./admin_sidebar.jsx');
var AdminStore = require('../../stores/admin_store.jsx');
var AsyncClient = require('../../utils/async_client.jsx');
var LoadingScreen = require('../loading_screen.jsx');

var EmailSettingsTab = require('./email_settings.jsx');
var LogSettingsTab = require('./log_settings.jsx');
var LogsTab = require('./logs.jsx');
var ImageSettingsTab = require('./image_settings.jsx');
var PrivacySettingsTab = require('./privacy_settings.jsx');
var RateSettingsTab = require('./rate_settings.jsx');
var GitLabSettingsTab = require('./gitlab_settings.jsx');
var SqlSettingsTab = require('./sql_settings.jsx');
var TeamSettingsTab = require('./team_settings.jsx');
var ServiceSettingsTab = require('./service_settings.jsx');

export default class AdminController extends React.Component {
    constructor(props) {
        super(props);

        this.selectTab = this.selectTab.bind(this);
        this.onConfigListenerChange = this.onConfigListenerChange.bind(this);

        this.state = {
            config: null,
            selected: 'service_settings'
        };
    }

    componentDidMount() {
        AdminStore.addConfigChangeListener(this.onConfigListenerChange);
        AsyncClient.getConfig();
    }

    componentWillUnmount() {
        AdminStore.removeConfigChangeListener(this.onConfigListenerChange);
    }

    onConfigListenerChange() {
        this.setState({
            config: AdminStore.getConfig(),
            selected: this.state.selected
        });
    }

    selectTab(tab) {
        this.setState({selected: tab});
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
                tab = <ImageSettingsTab config={this.state.config} />;
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
            }
        }

        return (
            <div className='container-fluid'>
                <div
                    className='sidebar--menu'
                    id='sidebar-menu'
                />
                <AdminSidebar
                    selected={this.state.selected}
                    selectTab={this.selectTab}
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