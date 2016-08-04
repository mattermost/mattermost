// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import React from 'react';

import AdminStore from 'stores/admin_store.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import * as Utils from 'utils/utils.jsx';

import AdminSidebarHeader from './admin_sidebar_header.jsx';
import AdminSidebarTeam from './admin_sidebar_team.jsx';
import {FormattedMessage} from 'react-intl';
import {browserHistory} from 'react-router/es6';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';
import SelectTeamModal from './select_team_modal.jsx';
import AdminSidebarCategory from './admin_sidebar_category.jsx';
import AdminSidebarSection from './admin_sidebar_section.jsx';

export default class AdminSidebar extends React.Component {
    static get contextTypes() {
        return {
            router: React.PropTypes.object.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.handleAllTeamsChange = this.handleAllTeamsChange.bind(this);

        this.removeTeam = this.removeTeam.bind(this);

        this.showTeamSelect = this.showTeamSelect.bind(this);
        this.teamSelectedModal = this.teamSelectedModal.bind(this);
        this.teamSelectedModalDismissed = this.teamSelectedModalDismissed.bind(this);

        this.renderAddTeamButton = this.renderAddTeamButton.bind(this);
        this.renderTeams = this.renderTeams.bind(this);

        this.state = {
            teams: AdminStore.getAllTeams(),
            selectedTeams: AdminStore.getSelectedTeams(),
            showSelectModal: false
        };
    }

    componentDidMount() {
        AdminStore.addAllTeamsChangeListener(this.handleAllTeamsChange);
        AsyncClient.getAllTeams();
    }

    componentDidUpdate() {
        if (!Utils.isMobile()) {
            $('.admin-sidebar .nav-pills__container').perfectScrollbar();
        }
    }

    componentWillUnmount() {
        AdminStore.removeAllTeamsChangeListener(this.handleAllTeamsChange);
    }

    handleAllTeamsChange() {
        this.setState({
            teams: AdminStore.getAllTeams(),
            selectedTeams: AdminStore.getSelectedTeams()
        });
    }

    removeTeam(team) {
        const selectedTeams = Object.assign({}, this.state.selectedTeams);
        Reflect.deleteProperty(selectedTeams, team.id);
        AdminStore.saveSelectedTeams(selectedTeams);

        this.handleAllTeamsChange();

        if (this.context.router.isActive('/admin_console/team/' + team.id)) {
            browserHistory.push('/admin_console');
        }
    }

    showTeamSelect(e) {
        e.preventDefault();
        this.setState({showSelectModal: true});
    }

    teamSelectedModal(teamId) {
        this.setState({
            showSelectModal: false
        });

        const selectedTeams = Object.assign({}, this.state.selectedTeams);
        selectedTeams[teamId] = true;

        AdminStore.saveSelectedTeams(selectedTeams);

        this.handleAllTeamsChange();
    }

    teamSelectedModalDismissed() {
        this.setState({showSelectModal: false});
    }

    renderAddTeamButton() {
        const addTeamTooltip = (
            <Tooltip id='add-team-tooltip'>
                <FormattedMessage
                    id='admin.sidebar.addTeamSidebar'
                    defaultMessage='Add team from sidebar menu'
                />
            </Tooltip>
        );

        return (
            <span className='menu-icon--right'>
                <OverlayTrigger
                    delayShow={1000}
                    placement='top'
                    overlay={addTeamTooltip}
                >
                    <a
                        href='#'
                        onClick={this.showTeamSelect}
                    >
                        <i
                            className='fa fa-plus'
                        ></i>
                    </a>
                </OverlayTrigger>
            </span>
        );
    }

    renderTeams() {
        const teams = [];

        for (const key in this.state.selectedTeams) {
            if (!this.state.selectedTeams.hasOwnProperty(key)) {
                continue;
            }

            const team = this.state.teams[key];

            if (!team) {
                continue;
            }

            teams.push(
                <AdminSidebarTeam
                    key={team.id}
                    team={team}
                    onRemoveTeam={this.removeTeam}
                />
            );
        }

        return (
            <AdminSidebarCategory
                parentLink='/admin_console'
                icon='fa-user'
                title={
                    <FormattedMessage
                        id='admin.sidebar.teams'
                        defaultMessage='TEAMS ({count, number})'
                        values={{
                            count: Object.keys(this.state.teams).length
                        }}
                    />
                }
                action={this.renderAddTeamButton()}
            >
                {teams}
            </AdminSidebarCategory>
        );
    }

    render() {
        let oauthSettings = null;
        let ldapSettings = null;
        let samlSettings = null;
        let clusterSettings = null;
        let complianceSettings = null;

        let license = null;
        let audits = null;
        let policy = null;

        if (window.mm_config.BuildEnterpriseReady === 'true') {
            license = (
                <AdminSidebarSection
                    name='license'
                    title={
                        <FormattedMessage
                            id='admin.sidebar.license'
                            defaultMessage='Edition and License'
                        />
                    }
                />
            );
        }

        if (window.mm_license.IsLicensed === 'true') {
            if (global.window.mm_license.LDAP === 'true') {
                ldapSettings = (
                    <AdminSidebarSection
                        name='ldap'
                        title={
                            <FormattedMessage
                                id='admin.sidebar.ldap'
                                defaultMessage='LDAP'
                            />
                        }
                    />
                );
            }

            if (global.window.mm_license.Cluster === 'true') {
                clusterSettings = (
                    <AdminSidebarSection
                        name='cluster'
                        title={
                            <FormattedMessage
                                id='admin.sidebar.cluster'
                                defaultMessage='High Availability (Beta)'
                            />
                        }
                    />
                );
            }

            if (global.window.mm_license.SAML === 'true') {
                samlSettings = (
                    <AdminSidebarSection
                        name='saml'
                        title={
                            <FormattedMessage
                                id='admin.sidebar.saml'
                                defaultMessage='SAML'
                            />
                        }
                    />
                );
            }

            if (global.window.mm_license.Compliance === 'true') {
                complianceSettings = (
                    <AdminSidebarSection
                        name='compliance'
                        title={
                            <FormattedMessage
                                id='admin.sidebar.compliance'
                                defaultMessage='Compliance'
                            />
                        }
                    />
                );
            }

            oauthSettings = (
                <AdminSidebarSection
                    name='oauth'
                    title={
                        <FormattedMessage
                            id='admin.sidebar.oauth'
                            defaultMessage='OAuth 2.0'
                        />
                    }
                />
            );

            policy = (
                <AdminSidebarSection
                    name='policy'
                    title={
                        <FormattedMessage
                            id='admin.sidebar.policy'
                            defaultMessage='Policy'
                        />
                    }
                />
            );
        } else {
            oauthSettings = (
                <AdminSidebarSection
                    name='gitlab'
                    title={
                        <FormattedMessage
                            id='admin.sidebar.gitlab'
                            defaultMessage='GitLab'
                        />
                    }
                />
            );
        }

        if (window.mm_license.IsLicensed === 'true') {
            audits = (
                <AdminSidebarSection
                    name='audits'
                    title={
                        <FormattedMessage
                            id='admin.sidebar.audits'
                            defaultMessage='Complaince and Auditing'
                        />
                    }
                />
            );
        }

        let customBranding = null;

        if (window.mm_license.IsLicensed === 'true') {
            customBranding = (
                <AdminSidebarSection
                    name='custom_brand'
                    title={
                        <FormattedMessage
                            id='admin.sidebar.customBrand'
                            defaultMessage='Custom Branding'
                        />
                    }
                />
            );
        }

        return (
            <div className='admin-sidebar'>
                <AdminSidebarHeader/>
                <div className='nav-pills__container'>
                    <ul className='nav nav-pills nav-stacked'>
                        <AdminSidebarCategory
                            parentLink='/admin_console'
                            icon='fa-bar-chart'
                            title={
                                <FormattedMessage
                                    id='admin.sidebar.reports'
                                    defaultMessage='REPORTING'
                                />
                            }
                        >
                            <AdminSidebarSection
                                name='system_analytics'
                                title={
                                    <FormattedMessage
                                        id='admin.sidebar.view_statistics'
                                        defaultMessage='Site Statistics'
                                    />
                                }
                            />
                            {audits}
                            <AdminSidebarSection
                                name='logs'
                                title={
                                    <FormattedMessage
                                        id='admin.sidebar.logs'
                                        defaultMessage='Logs'
                                    />
                                }
                            />
                        </AdminSidebarCategory>
                        <AdminSidebarCategory
                            sectionClass='sections--settings'
                            parentLink='/admin_console'
                            icon='fa-gear'
                            title={
                                <FormattedMessage
                                    id='admin.sidebar.settings'
                                    defaultMessage='SETTINGS'
                                />
                            }
                        >
                            <AdminSidebarSection
                                name='general'
                                type='text'
                                title={
                                    <FormattedMessage
                                        id='admin.sidebar.general'
                                        defaultMessage='General'
                                    />
                                }
                            >
                                <AdminSidebarSection
                                    name='configuration'
                                    title={
                                        <FormattedMessage
                                            id='admin.sidebar.configuration'
                                            defaultMessage='Configuration'
                                        />
                                    }
                                />
                                <AdminSidebarSection
                                    name='localization'
                                    title={
                                        <FormattedMessage
                                            id='admin.sidebar.localization'
                                            defaultMessage='Localization'
                                        />
                                    }
                                />
                                <AdminSidebarSection
                                    name='users_and_teams'
                                    title={
                                        <FormattedMessage
                                            id='admin.sidebar.usersAndTeams'
                                            defaultMessage='Users and Teams'
                                        />
                                    }
                                />
                                {policy}
                                <AdminSidebarSection
                                    name='privacy'
                                    title={
                                        <FormattedMessage
                                            id='admin.sidebar.privacy'
                                            defaultMessage='Privacy'
                                        />
                                    }
                                />
                                {complianceSettings}
                                <AdminSidebarSection
                                    name='logging'
                                    title={
                                        <FormattedMessage
                                            id='admin.sidebar.logging'
                                            defaultMessage='Logging'
                                        />
                                    }
                                />
                            </AdminSidebarSection>
                            <AdminSidebarSection
                                name='authentication'
                                type='text'
                                title={
                                    <FormattedMessage
                                        id='admin.sidebar.authentication'
                                        defaultMessage='Authentication'
                                    />
                                }
                            >
                                <AdminSidebarSection
                                    name='email'
                                    title={
                                        <FormattedMessage
                                            id='admin.sidebar.email'
                                            defaultMessage='Email'
                                        />
                                    }
                                />
                                {oauthSettings}
                                {ldapSettings}
                                {samlSettings}
                            </AdminSidebarSection>
                            <AdminSidebarSection
                                name='security'
                                type='text'
                                title={
                                    <FormattedMessage
                                        id='admin.sidebar.security'
                                        defaultMessage='Security'
                                    />
                                }
                            >
                                <AdminSidebarSection
                                    name='sign_up'
                                    title={
                                        <FormattedMessage
                                            id='admin.sidebar.signUp'
                                            defaultMessage='Sign Up'
                                        />
                                    }
                                />
                                <AdminSidebarSection
                                    name='password'
                                    title={
                                        <FormattedMessage
                                            id='admin.sidebar.password'
                                            defaultMessage='Password'
                                        />
                                    }
                                />
                                <AdminSidebarSection
                                    name='public_links'
                                    title={
                                        <FormattedMessage
                                            id='admin.sidebar.publicLinks'
                                            defaultMessage='Public Links'
                                        />
                                    }
                                />
                                <AdminSidebarSection
                                    name='sessions'
                                    title={
                                        <FormattedMessage
                                            id='admin.sidebar.sessions'
                                            defaultMessage='Sessions'
                                        />
                                    }
                                />
                                <AdminSidebarSection
                                    name='connections'
                                    title={
                                        <FormattedMessage
                                            id='admin.sidebar.connections'
                                            defaultMessage='Connections'
                                        />
                                    }
                                />
                            </AdminSidebarSection>
                            <AdminSidebarSection
                                name='notifications'
                                type='text'
                                title={
                                    <FormattedMessage
                                        id='admin.sidebar.notifications'
                                        defaultMessage='Notifications'
                                    />
                                }
                            >
                                <AdminSidebarSection
                                    name='email'
                                    title={
                                        <FormattedMessage
                                            id='admin.sidebar.email'
                                            defaultMessage='Email'
                                        />
                                    }
                                />
                                <AdminSidebarSection
                                    name='push'
                                    title={
                                        <FormattedMessage
                                            id='admin.sidebar.push'
                                            defaultMessage='Mobile Push'
                                        />
                                    }
                                />
                            </AdminSidebarSection>
                            <AdminSidebarSection
                                name='integrations'
                                type='text'
                                title={
                                    <FormattedMessage
                                        id='admin.sidebar.integrations'
                                        defaultMessage='Integrations'
                                    />
                                }
                            >
                                <AdminSidebarSection
                                    name='custom'
                                    title={
                                        <FormattedMessage
                                            id='admin.sidebar.customIntegrations'
                                            defaultMessage='Custom Integrations'
                                        />
                                    }
                                />
                                <AdminSidebarSection
                                    name='external'
                                    title={
                                        <FormattedMessage
                                            id='admin.sidebar.external'
                                            defaultMessage='External Services'
                                        />
                                    }
                                />
                            </AdminSidebarSection>
                            <AdminSidebarSection
                                name='files'
                                type='text'
                                title={
                                    <FormattedMessage
                                        id='admin.sidebar.files'
                                        defaultMessage='Files'
                                    />
                                }
                            >
                                <AdminSidebarSection
                                    name='storage'
                                    title={
                                        <FormattedMessage
                                            id='admin.sidebar.storage'
                                            defaultMessage='Storage'
                                        />
                                    }
                                />
                                <AdminSidebarSection
                                    name='images'
                                    title={
                                        <FormattedMessage
                                            id='admin.sidebar.images'
                                            defaultMessage='Images'
                                        />
                                    }
                                />
                            </AdminSidebarSection>
                            <AdminSidebarSection
                                name='customization'
                                type='text'
                                title={
                                    <FormattedMessage
                                        id='admin.sidebar.customization'
                                        defaultMessage='Customization'
                                    />
                                }
                            >
                                {customBranding}
                                <AdminSidebarSection
                                    name='custom_emoji'
                                    title={
                                        <FormattedMessage
                                            id='admin.sidebar.customEmoji'
                                            defaultMessage='Custom Emoji'
                                        />

                                    }
                                />
                                <AdminSidebarSection
                                    name='legal_and_support'
                                    title={
                                        <FormattedMessage
                                            id='admin.sidebar.legalAndSupport'
                                            defaultMessage='Legal and Support'
                                        />
                                    }
                                />
                                <AdminSidebarSection
                                    name='native_app_links'
                                    title={
                                        <FormattedMessage
                                            id='admin.sidebar.nativeAppLinks'
                                            defaultMessage='Native App Links'
                                        />

                                    }
                                />
                            </AdminSidebarSection>
                            <AdminSidebarSection
                                name='advanced'
                                type='text'
                                title={
                                    <FormattedMessage
                                        id='admin.sidebar.advanced'
                                        defaultMessage='Advanced'
                                    />
                                }
                            >
                                <AdminSidebarSection
                                    name='rate'
                                    title={
                                        <FormattedMessage
                                            id='admin.sidebar.rateLimiting'
                                            defaultMessage='Rate Limiting'
                                        />
                                    }
                                />
                                <AdminSidebarSection
                                    name='database'
                                    title={
                                        <FormattedMessage
                                            id='admin.sidebar.database'
                                            defaultMessage='Database'
                                        />
                                    }
                                />
                                <AdminSidebarSection
                                    name='developer'
                                    title={
                                        <FormattedMessage
                                            id='admin.sidebar.developer'
                                            defaultMessage='Developer'
                                        />
                                    }
                                />
                                {clusterSettings}
                            </AdminSidebarSection>
                        </AdminSidebarCategory>
                        {this.renderTeams()}
                        <AdminSidebarCategory
                            parentLink='/admin_console'
                            icon='fa-wrench'
                            title={
                                <FormattedMessage
                                    id='admin.sidebar.other'
                                    defaultMessage='OTHER'
                                />
                            }
                        >
                            {license}
                        </AdminSidebarCategory>
                    </ul>
                </div>
                <SelectTeamModal
                    teams={this.state.teams}
                    show={this.state.showSelectModal}
                    onModalSubmit={this.teamSelectedModal}
                    onModalDismissed={this.teamSelectedModalDismissed}
                />
            </div>
        );
    }
}
