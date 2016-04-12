// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import * as Utils from 'utils/utils.jsx';
import ErrorBar from 'components/error_bar.jsx';
import Client from 'utils/web_client.jsx';

import * as TextFormatting from 'utils/text_formatting.jsx';

import {Link} from 'react-router';

import {FormattedMessage} from 'react-intl';

//import {browserHistory, Link} from 'react-router';

import React from 'react';
import logoImage from 'images/logo.png';

export default class Login extends React.Component {

    constructor(props) {
        super(props);
        this.onTeamChange = this.onTeamChange.bind(this);

        const state = this.getStateFromStores();
        this.state = state;
    }

    componentDidMount() {
        TeamStore.addChangeListener(this.onTeamChange);
    }

    componentWillUnmount() {
        TeamStore.removeChangeListener(this.onTeamChange);
    }

    onTeamChange() {
        this.setState(this.getStateFromStores());
    }

    getStateFromStores() {
        return {
            teams: TeamStore.getAll(),
            teamMembers: TeamStore.getTeamMembers()
        };
    }

    createCustomLogin() {
        if (global.window.mm_license.IsLicensed === 'true' &&
                global.window.mm_license.CustomBrand === 'true' &&
                global.window.mm_config.EnableCustomBrand === 'true') {
            const text = global.window.mm_config.CustomBrandText || '';

            return (
                <div>
                    <img
                        src={Client.getAdminRoute() + '/get_brand_image'}
                    />
                    <p dangerouslySetInnerHTML={{__html: TextFormatting.formatText(text)}}/>
                </div>
            );
        }

        return null;
    }

    render() {
        var content;

        let customClass;
        const customContent = this.createCustomLogin();
        if (customContent) {
            customClass = 'branded';
        }

        var teamContents = [];

        for (var index in this.state.teamMembers) {
            if (this.state.teamMembers.hasOwnProperty(index)) {
                var teamMember = this.state.teamMembers[index];
                var team = this.state.teams[teamMember.team_id];
                teamContents.push(
                    <div
                        key={'team_' + team.name}
                        className='signup-team-dir'
                    >
                        <Link
                            to={'/' + team.name + '/channels/town-square'}
                        >
                            <span className='signup-team-dir__name'>{team.display_name}</span>
                            <span
                                className='glyphicon glyphicon-menu-right right signup-team-dir__arrow'
                                aria-hidden='true'
                            />
                        </Link>
                    </div>
                );
            }
        }

        if (!teamContents || teamContents.length === 0) {
            content = (
                <div className='signup__content'>
                    <div>
                        {'You do not appear to be a member of any teams.  Please ask your administrator for an invite or create a new team.'}
                    </div>
                </div>
            );
        } else {
            content = (
                <div className='signup__content'>
                    <h4>
                        <FormattedMessage
                            id='signup_team.choose'
                            defaultMessage='Choose a Team'
                        />
                    </h4>
                    <div className='signup-team-all'>
                        {teamContents}
                    </div>
                </div>
            );
        }

        var isSystemAdmin = Utils.isSystemAdmin(UserStore.getCurrentUser().roles);

        let teamSignUp;
        if (isSystemAdmin || (global.window.mm_config.EnableTeamCreation === 'true' && !Utils.isMobileApp())) {
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
                </div>
            );
        }

        let adminConsoleLink;
        if (isSystemAdmin) {
            adminConsoleLink = (
                <div className='margin--extra'>
                    <Link
                        to='/admin_console'
                        className='signup-team-login'
                    >
                        <FormattedMessage
                            id='navbar_dropdown.console'
                            defaultMessage='System Console'
                        />
                    </Link>
                </div>
            );
        }

        return (
            <div>
                <ErrorBar/>
                <div className='signup-header'>
                    <Link to='/logout'>
                        <span className='fa fa-chevron-left'/>
                        <FormattedMessage
                            id='navbar_dropdown.logout'
                        />
                    </Link>
                </div>
                <div className='col-sm-12'>
                    <div className={'signup-team__container ' + customClass}>
                        <div className='signup__markdown'>
                            {customContent}
                        </div>
                        <img
                            className='signup-team-logo'
                            src={logoImage}
                        />
                        <h1>{global.window.mm_config.SiteName}</h1>
                        <h4 className='color--light'>
                            <FormattedMessage
                                id='web.root.singup_info'
                            />
                        </h4>
                        {content}
                        {teamSignUp}
                        {adminConsoleLink}
                    </div>
                </div>
            </div>
        );
    }
}
