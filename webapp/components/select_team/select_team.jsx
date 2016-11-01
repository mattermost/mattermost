// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import * as UserAgent from 'utils/user_agent.jsx';
import * as Utils from 'utils/utils.jsx';
import ErrorBar from 'components/error_bar.jsx';
import LoadingScreen from 'components/loading_screen.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import SelectTeamItem from './components/select_team_item.jsx';

import {Link} from 'react-router/es6';

import {FormattedMessage} from 'react-intl';

import React from 'react';
import logoImage from 'images/logo.png';

export default class SelectTeam extends React.Component {

    constructor(props) {
        super(props);
        this.onTeamChange = this.onTeamChange.bind(this);
        this.handleTeamClick = this.handleTeamClick.bind(this);

        const state = this.getStateFromStores(false);
        state.loadingTeamId = '';
        this.state = state;
    }

    componentDidMount() {
        TeamStore.addChangeListener(this.onTeamChange);
        AsyncClient.getAllTeamListings();
    }

    componentWillUnmount() {
        TeamStore.removeChangeListener(this.onTeamChange);
    }

    onTeamChange() {
        this.setState(this.getStateFromStores(true));
    }

    getStateFromStores(loaded) {
        return {
            teams: TeamStore.getAll(),
            teamMembers: TeamStore.getMyTeamMembers(),
            teamListings: TeamStore.getTeamListings(),
            loaded
        };
    }

    handleTeamClick(team) {
        this.setState({loadingTeamId: team.id});
    }

    render() {
        let content = null;
        let teamContents = [];
        const isAlreadyMember = new Map();
        const isSystemAdmin = Utils.isSystemAdmin(UserStore.getCurrentUser().roles);
        let teamMembersCount = 0;

        for (const teamMember of this.state.teamMembers) {
            const teamId = teamMember.team_id;
            const team = this.state.teams[teamId];
            isAlreadyMember[teamId] = true;
            teamMembersCount++;

            teamContents.push(
                <SelectTeamItem
                    key={'team_' + team.name}
                    team={team}
                    url={'/' + team.name + '/channels/town-square'}
                    onTeamClick={this.handleTeamClick}
                    loading={this.state.loadingTeamId === teamId}
                />
            );
        }

        var openTeamContents = [];

        for (const id in this.state.teamListings) {
            if (this.state.teamListings.hasOwnProperty(id) && !isAlreadyMember[id]) {
                const openTeam = this.state.teamListings[id];
                openTeamContents.push(
                    <SelectTeamItem
                        key={'team_' + openTeam.name}
                        team={openTeam}
                        url={`/signup_user_complete/?id=${openTeam.invite_id}`}
                        onTeamClick={this.handleTeamClick}
                        loading={this.state.loadingTeamId === openTeam.id}
                    />
                );
            }
        }

        if (teamMembersCount === 0 && teamContents.length === 0 && openTeamContents.length === 0 && (global.window.mm_config.EnableTeamCreation === 'true' || isSystemAdmin)) {
            teamContents = (
                <div className='signup-team-dir-err'>
                    <div>
                        <FormattedMessage
                            id='signup_team.no_open_teams_canCreate'
                            defaultMessage='No teams are available to join. Please create a new team or ask your administrator for an invite.'
                        />
                    </div>
                </div>
            );
        } else if (teamMembersCount === 0 && teamContents.length === 0 && openTeamContents.length === 0) {
            teamContents = (
                <div className='signup-team-dir-err'>
                    <div>
                        <FormattedMessage
                            id='signup_team.no_open_teams'
                            defaultMessage='No teams are available to join. Please ask your administrator for an invite.'
                        />
                    </div>
                </div>
            );
        } else if (teamContents.length === 0 && openTeamContents.length > 0) {
            teamContents = null;
        }

        if (teamContents) {
            content = (
                <div className='signup__content'>
                    <h4>
                        <FormattedMessage
                            id='signup_team.choose'
                            defaultMessage='Your teams:'
                        />
                    </h4>
                    <div className='signup-team-all'>
                        {teamContents}
                    </div>
                </div>
            );
        }

        var openContent;
        if (openTeamContents.length > 0) {
            openContent = (
                <div className='signup__content'>
                    <h4>
                        <FormattedMessage
                            id='signup_team.join_open'
                            defaultMessage='Teams you can join: '
                        />
                    </h4>
                    <div className='signup-team-all'>
                        {openTeamContents}
                    </div>
                </div>
            );
        }

        if (!this.state.loaded) {
            openContent = <LoadingScreen/>;
        }

        let teamHelp = null;
        if (isSystemAdmin && (global.window.mm_config.EnableTeamCreation === 'false')) {
            teamHelp = (
                <FormattedMessage
                    id='login.createTeamAdminOnly'
                    defaultMessage='This option is only available for System Administrators, and does not show up for other users.'
                />
            );
        }

        let teamSignUp;
        if (isSystemAdmin || (global.window.mm_config.EnableTeamCreation === 'true' && !UserAgent.isMobileApp())) {
            teamSignUp = (
                <div className='margin--extra'>
                    <Link
                        to='/create_team'
                        className='signup-team-login'
                    >
                        <FormattedMessage
                            id='login.createTeam'
                            defaultMessage='Create a new team'
                        />
                    </Link>
                    <div>
                        {teamHelp}
                    </div>
                </div>
            );
        }

        let adminConsoleLink;
        if (isSystemAdmin) {
            adminConsoleLink = (
                <div className='margin--extra hidden-xs'>
                    <Link
                        to='/admin_console'
                        className='signup-team-login'
                    >
                        <FormattedMessage
                            id='signup_team_system_console'
                            defaultMessage='Go to System Console'
                        />
                    </Link>
                </div>
            );
        }

        let description = null;
        if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.CustomBrand === 'true' && global.window.mm_config.EnableCustomBrand === 'true') {
            description = global.window.mm_config.CustomDescriptionText;
        } else {
            description = (
                <FormattedMessage
                    id='web.root.signup_info'
                    defaultMessage='All team communication in one place, searchable and accessible anywhere'
                />
            );
        }

        return (
            <div>
                <ErrorBar/>
                <div className='signup-header'>
                    <a
                        href='#'
                        onClick={GlobalActions.emitUserLoggedOutEvent}
                    >
                        <span className='fa fa-chevron-left'/>
                        <FormattedMessage
                            id='navbar_dropdown.logout'
                        />
                    </a>
                </div>
                <div className='col-sm-12'>
                    <div className={'signup-team__container'}>
                        <img
                            className='signup-team-logo'
                            src={logoImage}
                        />
                        <h1>{global.window.mm_config.SiteName}</h1>
                        <h4 className='color--light'>
                            {description}
                        </h4>
                        {content}
                        {openContent}
                        {teamSignUp}
                        {adminConsoleLink}
                    </div>
                </div>
            </div>
        );
    }
}
